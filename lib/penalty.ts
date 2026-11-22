// Pay or Dare penalties: the whole state machine as one pure reducer (docs/PENALTIES_SPEC.md, section 3).
// The API routes and the 9am check call step() inside a Firestore transaction; nothing else changes a penalty.
// Pure TS, no Firebase, so every transition is covered by tests/penalty.test.ts.
import { addDays, dayKey, nextNine, nineAm } from "./logic.ts";
import { pickDare, type Dare } from "./dares.ts";

export type PStatus = "open" | "dare" | "voting" | "retry" | "pay" | "paid" | "passed" | "kicked";
export type PayState = "owed" | "marked" | "confirmed";
export type Payment = { s: PayState; at: number; confirmBy?: number | null; how?: "payee" | "auto" | "kicked" | null };
export type Tally = { attempt: number; done: number; notDone: number; eligible: number; outcome: "passed" | "rejected"; at: number };
export type Reason = "noproof" | "notdone" | "easier" | "other";
export const REASONS: Record<Reason, string> = {
  noproof: "Didn't get any proof",
  notdone: "Didn't actually do it",
  easier: "Did a different or easier version",
  other: "Other",
};
export type Vote = { voter: string; attempt: number; vote: "done" | "not"; reason: Reason | null; note: string | null; ts: number };

export type Penalty = {
  id: string;
  uid: string; // the player who missed
  day: string; // the missed day
  round: number;
  createdAt: number;
  stake: number; // per payee, fixed at creation
  payees: string[]; // every other member at creation
  status: PStatus;
  due: number | null; // the one deadline the next check acts on
  actBy: number; // 9am, two days after the creation day
  locked: boolean; // dare no longer allowed (after a second rejection)
  dare: Dare | null;
  rerollsLeft: number;
  attempt: number; // 0 = no proof yet, 1 = first vote, 2 = retry vote
  doneAt: number | null;
  voters: string[]; // fixed when "Done" is tapped
  voteEnds: number | null;
  tallies: Tally[];
  payments: Record<string, Payment>;
  closedAt: number | null;
  closedWhy: string | null;
  updatedAt: number;
};

export type KickWhy = "timeout" | "unpaid" | "streak";
export type Effect =
  | { e: "chose-pay" }
  | { e: "spun"; dare: Dare }
  | { e: "rerolled"; dare: Dare }
  | { e: "done"; attempt: number }
  | { e: "passed"; tally: Tally }
  | { e: "rejected"; tally: Tally }
  | { e: "marked"; payees: string[] }
  | { e: "got"; payee: string; how: "payee" | "auto" | "kicked" }
  | { e: "notgot"; payee: string }
  | { e: "vote"; vote: Vote }
  | { e: "kick"; uid: string; why: KickWhy }
  | { e: "closed" };

export type Event =
  | { type: "pay" | "dare" | "reroll" | "paid" | "done" | "again" | "got" | "notgot" | "tick" }
  | { type: "vote"; vote: string; reason?: string | null; note?: string | null }
  | { type: "close"; why: KickWhy };

export type Ctx = {
  now: number;
  actor?: string; // who's asking (absent for the 9am check)
  members: string[]; // current members
  votes?: Vote[]; // votes on this penalty (any attempt)
  deck?: Dare[];
  had?: string[]; // dare ids this player already had this round
  rand?: () => number;
};
export type Result =
  | { ok: true; p: Penalty; fx: Effect[]; changed: boolean }
  | { ok: false; code: 400 | 403 | 409 | 410; error: string };

const H = 3_600_000;
export const UNFINISHED: readonly PStatus[] = ["open", "dare", "voting", "retry", "pay"];
export const isUnfinished = (p: Pick<Penalty, "status">) => UNFINISHED.includes(p.status);
export const penaltyId = (uid: string, day: string) => `${uid}_${day}`;

/** A fresh penalty for a missed day. The id makes creating the same one twice impossible. */
export function newPenalty(o: { uid: string; day: string; round: number; stake: number; members: string[]; now: number }): Penalty {
  const payees = o.members.filter((m) => m !== o.uid);
  const actBy = nineAm(addDays(dayKey(new Date(o.now)), 2));
  return {
    id: penaltyId(o.uid, o.day), uid: o.uid, day: o.day, round: o.round, createdAt: o.now, stake: o.stake, payees,
    status: "open", due: actBy, actBy, locked: false, dare: null, rerollsLeft: 0, attempt: 0, doneAt: null,
    voters: [], voteEnds: null, tallies: [],
    payments: Object.fromEntries(payees.map((u) => [u, { s: "owed", at: o.now }])),
    closedAt: null, closedWhy: null, updatedAt: o.now,
  };
}

/** Rejected only if more than half of ALL eligible voters said ❌. Not voting counts as ✅, so a tie or no votes passes. */
export function tally(eligible: string[], votes: Vote[], attempt: number, now: number): Tally {
  const latest = new Map<string, Vote>();
  for (const v of votes) if (v.attempt === attempt && eligible.includes(v.voter)) latest.set(v.voter, v);
  let done = 0, notDone = 0;
  for (const v of latest.values()) if (v.vote === "not") notDone++; else done++;
  return { attempt, done, notDone, eligible: eligible.length, outcome: notDone * 2 > eligible.length ? "rejected" : "passed", at: now };
}

const fail = (code: 400 | 403 | 409 | 410, error: string): Result => ({ ok: false, code, error });

/** Applies one event to a penalty. Guards first (who, which state, before the deadline), then the transition. */
export function step(p0: Penalty, ev: Event, c: Ctx): Result {
  const p: Penalty = JSON.parse(JSON.stringify(p0));
  const now = c.now;
  const fx: Effect[] = [];
  const isPlayer = c.actor === p.uid;
  const late = p.due !== null && now >= p.due;
  const eligible = () => p.voters.filter((v) => c.members.includes(v));
  const finish = (): Result => {
    const changed = JSON.stringify(p) !== JSON.stringify(p0);
    if (changed) p.updatedAt = now;
    return { ok: true, p, fx, changed };
  };

  const settle = () => {
    if (p.status === "pay" && Object.values(p.payments).every((x) => x.s !== "owed")) { p.status = "paid"; p.due = null; }
  };
  const close = (why: string) => {
    p.status = "kicked"; p.due = null; p.voteEnds = null; p.closedAt = now; p.closedWhy = why;
  };
  const applyTally = (t: Tally) => {
    p.tallies.push(t);
    p.voteEnds = null;
    if (t.outcome === "passed") {
      p.status = "passed"; p.due = null; p.closedAt = now; p.closedWhy = "passed";
    } else if (p.attempt < 2) {
      p.status = "retry"; p.due = nextNine(now, 24);
    } else {
      p.status = "pay"; p.locked = true; p.due = nextNine(now, 24);
      settle();
    }
    fx.push(t.outcome === "passed" ? { e: "passed", tally: t } : { e: "rejected", tally: t });
  };
  const allVoted = (votes: Vote[]) => {
    const el = eligible();
    const voted = new Set(votes.filter((v) => v.attempt === p.attempt).map((v) => v.voter));
    return el.every((u) => voted.has(u));
  };
  const startVote = () => {
    p.status = "voting"; p.doneAt = now;
    p.voters = c.members.filter((m) => m !== p.uid);
    p.voteEnds = nextNine(now, 24); p.due = p.voteEnds;
    fx.push({ e: "done", attempt: p.attempt });
    if (!p.voters.length) applyTally(tally([], [], p.attempt, now));
  };

  switch (ev.type) {
    case "pay": {
      if (!isPlayer) return fail(403, "Only the player who missed can choose.");
      if (p.status === "pay" || p.status === "paid") return finish();
      if (!["open", "dare", "voting", "retry"].includes(p.status)) return fail(409, "This penalty is already settled.");
      if (p.status !== "voting" && late) return fail(410, "Too late: the deadline passed.");
      const base = p.status === "voting" ? p.actBy : (p.due as number);
      p.due = base - now >= 24 * H ? base : nextNine(now, 24);
      p.status = "pay"; p.voteEnds = null;
      fx.push({ e: "chose-pay" });
      settle();
      return finish();
    }
    case "dare": {
      if (!isPlayer) return fail(403, "Only the player who missed can choose.");
      if (p.status === "dare") return finish();
      if (p.status !== "open" || p.locked) return fail(409, "You can't take a dare on this one now.");
      if (late) return fail(410, "Too late: the deadline passed.");
      const pick = pickDare(c.deck || [], { avoid: c.had, rand: c.rand || Math.random });
      if (!pick) return fail(409, "The deck's empty. Add or restore a dare in Settings, or pay.");
      p.status = "dare"; p.dare = pick; p.rerollsLeft = 1;
      fx.push({ e: "spun", dare: pick });
      return finish();
    }
    case "reroll": {
      if (!isPlayer) return fail(403, "Only the player who missed can reroll.");
      if (p.status !== "dare") return fail(409, "There's no dare to reroll.");
      if (p.rerollsLeft < 1) return fail(409, "No rerolls left.");
      if (late) return fail(410, "Too late: the deadline passed.");
      const pick = pickDare(c.deck || [], { exclude: p.dare?.id, avoid: c.had, rand: c.rand || Math.random });
      if (!pick) return fail(409, "There's no other dare in the deck.");
      p.dare = pick; p.rerollsLeft = 0;
      fx.push({ e: "rerolled", dare: pick });
      return finish();
    }
    case "done": {
      if (!isPlayer) return fail(403, "Only the player who missed can say it's done.");
      if (p.status === "voting" && p.attempt === 1) return finish();
      if (p.status !== "dare") return fail(409, "There's no dare waiting for proof.");
      if (late) return fail(410, "Too late: the deadline passed.");
      p.attempt = 1;
      startVote();
      return finish();
    }
    case "again": {
      if (!isPlayer) return fail(403, "Only the player who missed can resend proof.");
      if (p.status === "voting" && p.attempt === 2) return finish();
      if (p.status !== "retry") return fail(409, "There's no retry waiting.");
      if (late) return fail(410, "Too late: the retry window closed.");
      p.attempt = 2;
      startVote();
      return finish();
    }
    case "vote": {
      const voter = c.actor || "";
      if (voter === p.uid || !p.voters.includes(voter) || !c.members.includes(voter)) return fail(403, "You can't vote on this one.");
      if (p.status !== "voting" || p.voteEnds === null || now >= p.voteEnds) return fail(409, "Voting's closed.");
      if (ev.vote !== "done" && ev.vote !== "not") return fail(400, "Vote done or not done.");
      let reason: Reason | null = null, note: string | null = null;
      if (ev.vote === "not") {
        if (!ev.reason || !(ev.reason in REASONS)) return fail(400, "Pick a reason.");
        reason = ev.reason as Reason;
        if (reason === "other") {
          note = String(ev.note ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim().slice(0, 80);
          if (!note) return fail(400, "Say what was wrong.");
        }
      }
      const v: Vote = { voter, attempt: p.attempt, vote: ev.vote, reason, note, ts: now };
      fx.push({ e: "vote", vote: v });
      const votes = [...(c.votes || []).filter((x) => !(x.voter === voter && x.attempt === p.attempt)), v];
      if (allVoted(votes)) applyTally(tally(eligible(), votes, p.attempt, now));
      return finish();
    }
    case "paid": {
      if (!isPlayer) return fail(403, "Only the player who missed can mark it paid.");
      if (p.status === "pay") { if (late) return fail(410, "Too late: the deadline passed."); }
      else if (p.status !== "paid") return fail(409, "Choose Pay first.");
      const marked: string[] = [];
      for (const to of p.payees) {
        if (p.payments[to]?.s !== "owed") continue;
        if (c.members.includes(to)) { p.payments[to] = { s: "marked", at: now, confirmBy: nextNine(now, 48) }; marked.push(to); }
        else { p.payments[to] = { s: "confirmed", at: now, how: "kicked" }; fx.push({ e: "got", payee: to, how: "kicked" }); }
      }
      if (marked.length) fx.push({ e: "marked", payees: marked });
      settle();
      return finish();
    }
    case "got": {
      const payee = c.actor || "";
      if (!p.payees.includes(payee) || !c.members.includes(payee)) return fail(403, "That payment isn't yours to confirm.");
      if (!["pay", "paid", "kicked"].includes(p.status)) return fail(409, "Nothing to confirm yet.");
      if (p.payments[payee]?.s === "confirmed") return finish();
      p.payments[payee] = { s: "confirmed", at: now, how: "payee" };
      fx.push({ e: "got", payee, how: "payee" });
      settle();
      return finish();
    }
    case "notgot": {
      const payee = c.actor || "";
      if (!p.payees.includes(payee) || !c.members.includes(payee)) return fail(403, "That payment isn't yours.");
      if (p.payments[payee]?.s === "owed") return finish();
      if (p.payments[payee]?.s !== "marked") return fail(409, "You already confirmed that one.");
      p.payments[payee] = { s: "owed", at: now }; // the penalty stays paid: never a kick, never a new deadline
      fx.push({ e: "notgot", payee });
      return finish();
    }
    case "tick": {
      // 1. a vote whose window closed, or whose remaining voters have all voted (or all gone)
      if (p.status === "voting" && ((p.voteEnds !== null && now >= p.voteEnds) || allVoted(c.votes || [])))
        applyTally(tally(eligible(), c.votes || [], p.attempt, now));
      // 2. marked payments: auto-confirm after the window, or at once if the payee is out
      for (const to of p.payees) {
        const pay = p.payments[to];
        if (pay?.s !== "marked") continue;
        const out = !c.members.includes(to);
        if (out || (pay.confirmBy != null && now >= pay.confirmBy)) {
          p.payments[to] = { s: "confirmed", at: now, how: out ? "kicked" : "auto" };
          fx.push({ e: "got", payee: to, how: out ? "kicked" : "auto" });
        }
      }
      settle();
      // 3. a deadline nobody acted on → the player is out
      if (["open", "dare", "retry", "pay"].includes(p.status) && p.due !== null && now >= p.due) {
        const why: KickWhy = p.status === "pay" && p.locked ? "unpaid" : "timeout";
        close(why);
        fx.push({ e: "kick", uid: p.uid, why });
      }
      return finish();
    }
    case "close": {
      if (!isUnfinished(p)) return finish();
      close(ev.why);
      fx.push({ e: "closed" });
      return finish();
    }
  }
}

// ---------- kicks ----------

/**
 * Who actually leaves when `targets` are kicked together. A kick never empties a group: if everyone left would go,
 * nobody is removed and the round ends with no winner. One left = the round ends and they win.
 */
export function planKicks(members: string[], targets: string[]) {
  const out = targets.filter((t) => members.includes(t));
  const remaining = members.filter((m) => !out.includes(m));
  if (!out.length) return { removed: [] as string[], remaining: members, ends: false, winner: null as string | null };
  if (!remaining.length) return { removed: [] as string[], remaining: members, ends: true, winner: null as string | null };
  return { removed: out, remaining, ends: remaining.length === 1, winner: remaining.length === 1 ? remaining[0] : null };
}

// ---------- money ----------
export type PairMoney = { from: string; to: string; unpaid: number; paid: number };

/** Pay or Dare money, per pair: PAY penalties (and ones closed by a kick) owe the stake to each payee. No netting. */
export function penaltyLedger(ps: Penalty[]): PairMoney[] {
  const m = new Map<string, PairMoney>();
  for (const p of ps) {
    if (p.status !== "pay" && p.status !== "paid" && p.status !== "kicked") continue;
    for (const to of p.payees) {
      const k = `${p.uid}>${to}`;
      const r = m.get(k) || { from: p.uid, to, unpaid: 0, paid: 0 };
      if (p.payments[to]?.s === "confirmed") r.paid += p.stake; else r.unpaid += p.stake;
      m.set(k, r);
    }
  }
  return [...m.values()];
}

/** Unfinished penalties, per player: money that's "on the line" until they pay or pass a dare. */
export function onTheLine(ps: Penalty[]): Map<string, number> {
  const m = new Map<string, number>();
  for (const p of ps) if (["open", "dare", "voting", "retry"].includes(p.status)) m.set(p.uid, (m.get(p.uid) || 0) + p.stake * p.payees.length);
  return m;
}

/** What `uid` still owes across these penalties (not yet confirmed by the payee). */
export const unpaidBy = (ps: Penalty[], uid: string) =>
  penaltyLedger(ps).filter((r) => r.from === uid).reduce((s, r) => s + r.unpaid, 0);
