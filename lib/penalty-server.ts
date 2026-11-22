// Pay or Dare on the server: every penalty, dare, vote, payment mark and kick is written here (admin SDK).
// Clients can only read these docs (firestore.rules). Transitions themselves live in lib/penalty.ts (pure, tested).
import "server-only";
import { randomInt } from "node:crypto";
import { FieldValue } from "firebase-admin/firestore";
import { adminAuth, adminDb, pushTo } from "./admin";
import {
  addDays, countedDays, dayKey, inr, isDare, isMiss, ledger, missesInARow, prettyDay, roundEnd, roundDays,
  type Group, type Kicked, type Player,
} from "./logic";
import { isUnfinished, newPenalty, penaltyLedger, planKicks, step, unpaidBy, type Ctx, type Effect, type Event, type KickWhy, type Penalty, type Vote } from "./penalty";
import { deckOf, type DareDoc } from "./dares";
import { due, each, KICK_WHY, penaltyFeed, penaltyMsgs, type FeedItem, type Msg } from "./feed";

const db = () => adminDb();
const rand = () => randomInt(0, 1_000_000) / 1_000_000;
export type Fail = { ok: false; code: number; error: string };
const fail = (code: number, error: string): Fail => ({ ok: false, code, error });

/** The caller's uid from `Authorization: Bearer <Firebase ID token>`, or null. */
export async function callerUid(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  try { return (await adminAuth().verifyIdToken(token)).uid; } catch { return null; }
}

export async function names(gid: string) {
  const ps = await db().collection(`groups/${gid}/players`).get();
  const m = new Map(ps.docs.map((d) => [d.id, (d.get("name") as string) || "Someone"]));
  return (uid: string) => m.get(uid) || "Someone";
}

export async function send(msgs: Msg[]) {
  let n = 0;
  for (const m of msgs) n += await pushTo([...new Set(m.to)], { title: m.title, body: m.body, kind: m.kind }).catch(() => 0);
  return n;
}

export async function feed(gid: string, items: Omit<FeedItem, "id">[]) {
  if (!items.length) return;
  const batch = db().batch();
  for (const f of items) batch.set(db().collection(`groups/${gid}/feed`).doc(), JSON.parse(JSON.stringify({ ...f, pushed: true })));
  await batch.commit();
}

const pRef = (gid: string, id: string) => db().doc(`groups/${gid}/penalties/${id}`);

// ---------- one penalty, one action ----------

/** Runs one player/voter/payee action through the reducer in a transaction, then announces it. */
export async function act(gid: string, id: string, uid: string, ev: Event) {
  const gRef = db().doc(`groups/${gid}`), ref = pRef(gid, id);
  const now = Date.now();
  const res = await db().runTransaction(async (tx) => {
    const [g, ps] = await Promise.all([tx.get(gRef), tx.get(ref)]);
    if (!g.exists || !ps.exists) return fail(404, "That penalty doesn't exist.");
    const group = g.data() as Group;
    if (!group.members.includes(uid)) return fail(403, "You're not in this challenge.");
    const p = ps.data() as Penalty;
    const ctx: Ctx = { now, actor: uid, members: group.members };
    if (ev.type === "vote") ctx.votes = (await tx.get(ref.collection("votes"))).docs.map((d) => d.data() as Vote);
    if (ev.type === "dare" || ev.type === "reroll") {
      const [dares, mine] = await Promise.all([tx.get(gRef.collection("dares")), tx.get(gRef.collection("penalties").where("uid", "==", p.uid))]);
      ctx.deck = deckOf(Object.fromEntries(dares.docs.map((d) => [d.id, d.data() as DareDoc])));
      ctx.had = mine.docs.map((d) => d.data() as Penalty).filter((x) => x.round === p.round && x.dare).map((x) => x.dare!.id);
      ctx.rand = rand;
    }
    const r = step(p, ev, ctx);
    if (!r.ok) return r;
    if (r.changed) tx.set(ref, r.p);
    for (const f of r.fx) if (f.e === "vote") tx.set(ref.collection("votes").doc(`${f.vote.attempt}_${f.vote.voter}`), f.vote);
    return { ...r, group };
  });
  if (res.ok) await announce(gid, res.group.members, res.p, res.fx, now);
  return res.ok ? { ok: true as const, penalty: res.p } : res;
}

async function announce(gid: string, members: string[], p: Penalty, fx: Effect[], now: number) {
  const name = await names(gid);
  await feed(gid, penaltyFeed(fx, p, now));
  await send(penaltyMsgs(fx, p, name, members));
}

/** Re-runs the reducer's time/membership checks on one penalty (votes closing, auto-confirm, deadlines). */
async function tick(gid: string, id: string, now: number) {
  const gRef = db().doc(`groups/${gid}`), ref = pRef(gid, id);
  return db().runTransaction(async (tx) => {
    const [g, ps, vs] = await Promise.all([tx.get(gRef), tx.get(ref), tx.get(ref.collection("votes"))]);
    if (!g.exists || !ps.exists) return null;
    const group = g.data() as Group;
    const r = step(ps.data() as Penalty, { type: "tick" }, { now, members: group.members, votes: vs.docs.map((d) => d.data() as Vote) });
    if (!r.ok) return null;
    if (r.changed) tx.set(ref, r.p);
    return { p: r.p, fx: r.fx, members: group.members };
  });
}

// ---------- creating penalties ----------

/**
 * Creates penalties for counted missed days (yesterday plus a 3-day catch-up, or every finished day of the round
 * when `allDays`). Only in a Pay or Dare round with 2+ members. Idempotent: the doc id is uid_day.
 */
export async function createPenalties(gid: string, group: Group, players: Player[], now: number, allDays = false) {
  if (!isDare(group) || group.members.length < 2) return [];
  const today = dayKey(new Date(now));
  const from = allDays ? "0000-00-00" : addDays(today, -4);
  const created: Penalty[] = [];
  for (const pl of players) {
    if (!group.members.includes(pl.uid)) continue;
    for (const day of countedDays(group, pl, today)) {
      if (day < from || !isMiss(group, pl, day)) continue;
      const p = newPenalty({ uid: pl.uid, day, round: group.round, stake: group.stake, members: group.members, now });
      try { await pRef(gid, p.id).create(p); created.push(p); } catch { /* already exists */ }
    }
  }
  return created;
}

/** Pushes + feed for new penalties. `streaks` = misses in a row per player (2 = one more and you're out). */
async function announceCreated(gid: string, group: Group, created: Penalty[], streaks: Map<string, number>, now: number) {
  if (!created.length) return 0;
  const name = await names(gid);
  await feed(gid, created.map((p) => ({ by: p.uid, kind: "pen" as const, ev: "created", pid: p.id, day: p.day, stake: p.stake, ts: now })));
  const msgs: Msg[] = [];
  const byPlayer = new Map<string, Penalty[]>();
  for (const p of created) byPlayer.set(p.uid, [...(byPlayer.get(p.uid) || []), p]);
  for (const [uid, ps] of byPlayer) {
    const p = ps[ps.length - 1];
    const two = (streaks.get(uid) || 0) >= 2;
    const many = ps.length > 1 ? `${ps.length} penalties. ` : "";
    msgs.push(two
      ? { to: [uid], kind: "penalty", title: "💸 That's 2 in a row", body: `${many}Pay ${each(p)} or take a dare by ${due(p.due)}. One more miss and you're out.` }
      : { to: [uid], kind: "penalty", title: "💸 You missed yesterday", body: `${many}Pay ${each(p)} or take a dare. Decide by ${due(p.due)}.` });
  }
  const missed = [...byPlayer.keys()];
  const rest = group.members.filter((m) => !missed.includes(m));
  msgs.push({ to: rest, kind: "penalty", title: `💸 ${missed.map(name).join(" & ")} missed yesterday`, body: "Pay or dare, their call. If it's a dare, you'll get a vote." });
  return send(msgs);
}

// ---------- kicks ----------

/**
 * Removes players (never the last ones: if everyone left would go, nobody is removed and the round ends with no
 * winner). Closes their unfinished penalties, records what they owe, re-checks votes and payments, announces it.
 */
export async function applyKicks(gid: string, kicks: Map<string, KickWhy>, now: number) {
  if (!kicks.size) return 0;
  const gRef = db().doc(`groups/${gid}`);
  const today = dayKey(new Date(now)), yesterday = addDays(today, -1);
  const plan = await db().runTransaction(async (tx) => {
    const g = (await tx.get(gRef)).data() as Group | undefined;
    if (!g) return null;
    const k = planKicks(g.members, [...kicks.keys()]);
    if (!k.removed.length && !k.ends) return null;
    const update: Record<string, unknown> = {};
    if (k.removed.length) {
      update.members = k.remaining;
      for (const u of k.removed) update[`kicked.${u}`] = { round: g.round, day: today, why: kicks.get(u)!, owed: 0 } satisfies Kicked;
    }
    if (k.ends) {
      if (today >= g.start && yesterday < roundEnd(g)) update.endedEarly = yesterday;
      update.winner = k.winner;
    }
    tx.update(gRef, update);
    return { g, targets: k.removed, remaining: k.remaining, ends: k.ends, winner: k.winner };
  });
  if (!plan) return 0;

  // close the removed players' unfinished penalties and record what they owe
  const all = (await db().collection(`groups/${gid}/penalties`).get()).docs.map((d) => d.data() as Penalty);
  for (const u of plan.targets) {
    for (const p of all.filter((x) => x.uid === u && isUnfinished(x))) {
      const r = step(p, { type: "close", why: kicks.get(u)! }, { now, members: plan.remaining });
      if (r.ok && r.changed) { await pRef(gid, p.id).set(r.p); Object.assign(p, r.p); }
    }
    await gRef.update({ [`kicked.${u}.owed`]: unpaidBy(all.filter((x) => x.uid === u), u) });
  }
  // votes that lost a voter, payments owed to someone who's gone
  let sent = 0;
  for (const p of all.filter((x) => x.status === "voting" || x.status === "pay" || x.status === "paid" || x.status === "kicked")) {
    const t = await tick(gid, p.id, now);
    if (t?.fx.length) { await announce(gid, t.members, t.p, t.fx.filter((f) => f.e !== "kick"), now); }
  }

  const name = await names(gid);
  const next = plan.g.round + 1;
  const msgs: Msg[] = [];
  const items: Omit<FeedItem, "id">[] = [];
  for (const u of plan.targets) {
    const why = KICK_WHY[kicks.get(u)!];
    msgs.push({ to: [u], kind: "kick", title: `🚪 You're out of round ${plan.g.round}`, body: `${why}. You can rejoin when round ${next} starts.` });
    msgs.push({ to: plan.remaining, kind: "kick", title: `🚪 ${name(u)} is out`, body: `${why}. Back when round ${next} starts.` });
    items.push({ by: u, kind: "kick", why: kicks.get(u), round: plan.g.round, ts: now });
  }
  if (plan.ends) {
    const everyone = [...plan.remaining, ...plan.targets];
    if (plan.winner && plan.targets.length) {
      msgs.push({ to: [plan.winner], kind: "kick", title: "🏁 You're the last one standing", body: `Round ${plan.g.round} is over. Start round ${next} in the app.` });
      msgs.push({ to: plan.targets, kind: "kick", title: `🏁 ${name(plan.winner)} is the last one standing`, body: `Round ${plan.g.round} is over.` });
    } else if (!plan.targets.length) {
      msgs.push({ to: everyone, kind: "kick", title: `🏁 Round ${plan.g.round} is over`, body: `Everyone would have been out, so nobody is. Start round ${next} in the app.` });
    }
    items.push({ by: plan.winner || plan.g.createdBy, kind: "ended", winner: plan.targets.length ? plan.winner : null, round: plan.g.round, ts: now });
  }
  await feed(gid, items);
  return sent + (await send(msgs));
}

// ---------- the 9am check ----------

/**
 * Runs for every group at the 9am cron (and for one test group with ?gid=). In any mode it settles leftover
 * penalties (votes closing, auto-confirms, deadlines). In a Pay or Dare round it also creates yesterday's
 * penalties, kicks 3-in-a-row, and sends the morning pushes. Every step is idempotent.
 */
export async function morningCheck(gid: string, now: number) {
  const gRef = db().doc(`groups/${gid}`);
  const today = dayKey(new Date(now)), yesterday = addDays(today, -1);
  let sent = 0;
  const kicks = new Map<string, KickWhy>();

  // 1–2, 5: tick everything that can still change
  const live = await db().collection(`groups/${gid}/penalties`).where("status", "in", ["open", "dare", "voting", "retry", "pay", "paid", "kicked"]).get();
  for (const d of live.docs) {
    const p = d.data() as Penalty;
    if (p.status === "kicked" && !Object.values(p.payments).some((x) => x.s === "marked")) continue;
    const t = await tick(gid, p.id, now);
    if (!t) continue;
    for (const f of t.fx) if (f.e === "kick" && !kicks.has(f.uid)) kicks.set(f.uid, f.why);
    const rest = t.fx.filter((f) => f.e !== "kick");
    if (rest.length) await announce(gid, t.members, t.p, rest, now);
  }

  const gSnap = await gRef.get();
  if (!gSnap.exists) return { sent };
  const group = gSnap.data() as Group;
  const ps = await db().collection(`groups/${gid}/players`).get();
  const players = ps.docs.map((d) => ({ ...(d.data() as Player), uid: d.id }));

  // 3: new penalties (Pay or Dare rounds only)
  const created = await createPenalties(gid, group, players, now);

  // 4: misses in a row, from penalty days (any status, any round)
  const allPen = (await db().collection(`groups/${gid}/penalties`).get()).docs.map((d) => d.data() as Penalty);
  const streaks = new Map<string, number>();
  for (const uid of group.members) {
    const days = allPen.filter((p) => p.uid === uid).map((p) => p.day);
    const n = days.includes(yesterday) ? missesInARow(days, yesterday) : 0;
    streaks.set(uid, n);
    if (n >= 3 && isDare(group)) kicks.set(uid, "streak");
  }
  sent += await announceCreated(gid, group, created.filter((p) => !kicks.has(p.uid) || kicks.get(p.uid) !== "streak"), streaks, now);

  // 6: kicks
  sent += await applyKicks(gid, kicks, now);

  // 7: the morning summary for Pay or Dare rounds (Money only groups keep their old results push)
  if (isDare(group) && roundDays(group).includes(yesterday) && yesterday <= roundEnd(group) && group.members.length >= 2) {
    const after = (await gRef.get()).data() as Group;
    if (yesterday === roundEnd(group)) sent += await send([await roundOverMsg(gid, group, after.members)]);
    else if (!allPen.some((p) => p.day === yesterday) && !kicks.size)
      sent += await send([{ to: after.members, kind: "results", title: "✅ Clean day yesterday", body: "Nobody slipped. No penalties today." }]);
  }
  await gRef.update({ checkedOn: today }).catch(() => {});
  return { sent };
}

/** "Round N is over" for a Pay or Dare round: what's still unpaid instead of a net settle-up. */
async function roundOverMsg(gid: string, group: Group, to: string[]): Promise<Msg> {
  const name = await names(gid);
  const allPen = (await db().collection(`groups/${gid}/penalties`).where("round", "==", group.round).get()).docs.map((d) => d.data() as Penalty);
  const unpaid = penaltyLedger(allPen).filter((r) => r.unpaid > 0);
  const body = unpaid.length
    ? `Still unpaid: ${unpaid.map((r) => `${name(r.from)} owes ${name(r.to)} ${inr(r.unpaid)}`).join(", ")}. Start round ${group.round + 1} in the app.`
    : `Everything's settled. Start round ${group.round + 1} in the app.`;
  return { to, kind: "results", title: `🏁 Round ${group.round} is over`, body };
}

// ---------- rounds and rejoining ----------

/** Starts the next round: settles the outgoing round's last penalties first, applies queued settings, announces it. */
export async function startRound(gid: string, uid: string, days: number, when: "today" | "tomorrow") {
  if (![7, 14, 21, 30].includes(days) || !["today", "tomorrow"].includes(when)) return fail(400, "Pick a length and a start day.");
  const gRef = db().doc(`groups/${gid}`);
  const now = Date.now();
  const snap = await gRef.get();
  if (!snap.exists) return fail(404, "That challenge doesn't exist.");
  const old = snap.data() as Group;
  if (!old.members.includes(uid)) return fail(403, "You're not in this challenge.");

  // nothing slips through the gap between rounds: yesterday's (and any earlier) misses get their penalty now
  const today = dayKey(new Date(now));
  const players = (await gRef.collection("players").get()).docs.map((d) => ({ ...(d.data() as Player), uid: d.id }));
  const created = await createPenalties(gid, old, players, now, true);
  const allPen = (await gRef.collection("penalties").get()).docs.map((d) => d.data() as Penalty);
  const streaks = new Map(old.members.map((m) => [m, missesInARow(allPen.filter((p) => p.uid === m).map((p) => p.day), addDays(today, -1))]));
  await announceCreated(gid, old, created, streaks, now);
  // the round-over push, if the morning check hasn't sent it yet (a new round started before 9am on the day after the end)
  const end = roundEnd(old);
  if (today > end && (old.checkedOn || "") < addDays(end, 1) && old.members.length >= 2) {
    if (isDare(old)) await send([await roundOverMsg(gid, old, old.members)]);
    else {
      const name = await names(gid);
      const { debts } = ledger(old, players.filter((p) => old.members.includes(p.uid)), addDays(end, 1));
      const money = debts.length ? debts.map((d) => `${name(d.from)} owes ${name(d.to)} ${inr(d.amount)}`).join(", ") : "All square";
      await send([{ to: old.members, kind: "results", title: `🏁 Round ${old.round} is over`, body: `Final: ${money}. Settle up on UPI.` }]);
    }
  }

  const start = when === "today" ? today : addDays(today, 1);
  const round = await db().runTransaction(async (tx) => {
    const g = (await tx.get(gRef)).data() as Group;
    const next = g.next || {};
    const r = g.round + 1;
    tx.update(gRef, {
      start, days, round: r,
      ...(next.penaltyMode ? { penaltyMode: next.penaltyMode } : {}),
      ...(next.stake ? { stake: next.stake } : {}),
      ...(next.rule ? { rule: next.rule } : {}),
      next: FieldValue.delete(), endedEarly: FieldValue.delete(), winner: FieldValue.delete(),
    });
    return r;
  });
  await feed(gid, [{ by: uid, kind: "round", round, start, days, ts: now }]);
  await send([{ to: old.members.filter((m) => m !== uid), kind: "round", title: `Round ${round} is set`, body: `${days} days starting ${prettyDay(start)}. Lock in.` }]);
  return { ok: true as const, round };
}

/** Puts a kicked player back once a new round has started. `joined` resets so earlier days never count. */
export async function rejoin(gid: string, uid: string) {
  const gRef = db().doc(`groups/${gid}`);
  const now = Date.now(), today = dayKey(new Date(now));
  const res = await db().runTransaction(async (tx) => {
    const [g, pl] = await Promise.all([tx.get(gRef), tx.get(gRef.collection("players").doc(uid))]);
    if (!g.exists) return fail(404, "That challenge doesn't exist.");
    const group = g.data() as Group;
    const k = group.kicked?.[uid];
    if (!k) return fail(409, "You're not out of this challenge.");
    if (group.members.includes(uid)) return fail(409, "You're already back in.");
    if (k.round >= group.round) return fail(409, `You can rejoin when round ${k.round + 1} starts.`);
    if (group.members.length >= 6) return fail(409, "That challenge is full (6 people max).");
    if (!pl.exists) return fail(409, "Join with the code instead.");
    tx.update(gRef, { members: FieldValue.arrayUnion(uid), [`kicked.${uid}`]: FieldValue.delete() });
    tx.update(pl.ref, { joined: today });
    return { ok: true as const, members: group.members, tasks: ((pl.get("tasks") as unknown[]) || []).length };
  });
  if (!res.ok) return res;
  await feed(gid, [{ by: uid, kind: "join", total: res.tasks, ts: now }]);
  const name = await names(gid);
  await send([{ to: res.members, kind: "join", title: `${name(uid)} is back in`, body: "Rejoined for this round. Game on." }]);
  return { ok: true as const };
}

