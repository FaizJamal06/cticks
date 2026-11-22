// Pay or Dare: the penalty state machine (lib/penalty.ts), deadlines and streaks (lib/logic.ts), the dare deck
// (lib/dares.ts) and push text (lib/feed.ts). Every row of docs/PENALTIES_SPEC.md section 3 has a test here.
import { describe, test } from "node:test";
import assert from "node:assert/strict";
import {
  newPenalty, onTheLine, penaltyLedger, planKicks, step, tally, unpaidBy, type Ctx, type Event, type Penalty, type Vote,
} from "../lib/penalty.ts";
import { addDays, canRejoin, countedDays, missesInARow, nextNine, nineAm, roundEnd, roundState, type Group, type Player } from "../lib/logic.ts";
import { checkDare, DARE_RULES, deckOf, pickDare, STARTER, type DareDoc } from "../lib/dares.ts";
import { due, penaltyMsgs } from "../lib/feed.ts";

const H = 3_600_000;
const MON = "2026-11-23"; // a Monday
const TUE = addDays(MON, 1), WED = addDays(MON, 2), THU = addDays(MON, 3);
/** Epoch ms for a wall-clock time in India. */
const ist = (day: string, hm: string) => { const [h, m] = hm.split(":").map(Number); return nineAm(day) + (h * 60 + m - 540) * 60_000; };
const T0 = ist(MON, "09:20"); // the 9am check creates the penalty for Sunday
const ABC = ["a", "b", "c"];
const deck = STARTER.slice(0, 3);
const fresh = (members = ABC, now = T0) => newPenalty({ uid: "a", day: addDays(MON, -1), round: 1, stake: 100, members, now });

type R = ReturnType<typeof step>;
const ok = (r: R) => { if (!r.ok) assert.fail(`expected ok, got ${r.code}: ${r.error}`); return r; };
const go = (p: Penalty, ev: Event, c: Partial<Ctx> = {}) => ok(step(p, ev, { now: T0, members: ABC, rand: () => 0, deck, ...c }));
const no = (p: Penalty, ev: Event, c: Partial<Ctx>, code: number) => {
  const r = step(p, ev, { now: T0, members: ABC, rand: () => 0, deck, ...c });
  assert.equal(r.ok, false); if (!r.ok) assert.equal(r.code, code, r.error);
};
const vote = (voter: string, v: "done" | "not", attempt = 1): Vote =>
  ({ voter, attempt, vote: v, reason: v === "not" ? "noproof" : null, note: null, ts: 0 });
/** a: dared, Done tapped at Mon 10:00 → voting with b and c. */
const voting = () => go(go(fresh(), { type: "dare" }, { actor: "a" }).p, { type: "done" }, { actor: "a", now: ist(MON, "10:00") }).p;

describe("deadlines (all at 9am IST)", () => {
  test("nineAm and nextNine", () => {
    assert.equal(nineAm(MON), Date.UTC(2026, 10, 23, 3, 30));
    assert.equal(nextNine(ist(MON, "10:00"), 24), nineAm(WED)); // Tue 10:00 is past 9 → Wed 9:00
    assert.equal(nextNine(ist(MON, "08:00"), 24), nineAm(TUE)); // Tue 8:00 → Tue 9:00
    assert.equal(nextNine(ist(MON, "09:00"), 24), nineAm(TUE)); // exactly 24h
  });
  test("a penalty is due at 9am two mornings after it's created, wherever in the cron hour that is", () => {
    for (const hm of ["09:00", "09:59", "00:10", "23:50"]) assert.equal(fresh(ABC, ist(MON, hm)).actBy, nineAm(WED), hm);
    const p = fresh();
    assert.equal(p.due, p.actBy);
    assert.deepEqual(p.payees, ["b", "c"]);
    assert.deepEqual(Object.values(p.payments).map((x) => x.s), ["owed", "owed"]);
  });
  test("vote and retry windows end at the first 9am at least 24h away; payments auto-confirm 48h+", () => {
    const v = voting();
    assert.equal(v.voteEnds, nineAm(WED));
    const paid = go(go(fresh(), { type: "pay" }, { actor: "a" }).p, { type: "paid" }, { actor: "a", now: ist(MON, "20:00") }).p;
    assert.equal(paid.payments.b.confirmBy, nineAm(THU));
    assert.equal(due(nineAm(WED)), "9am Wed");
  });
});

describe("tally: rejected only when more than half of all eligible voters say ❌", () => {
  test("a tie passes", () => assert.equal(tally(["b", "c"], [vote("b", "not"), vote("c", "done")], 1, 0).outcome, "passed"));
  test("no votes passes", () => assert.equal(tally(["b", "c"], [], 1, 0).outcome, "passed"));
  test("one ❌ of two eligible passes (not voting counts as ✅)", () => assert.equal(tally(["b", "c"], [vote("b", "not")], 1, 0).outcome, "passed"));
  test("two ❌ of two rejects", () => assert.equal(tally(["b", "c"], [vote("b", "not"), vote("c", "not")], 1, 0).outcome, "rejected"));
  test("2-person group: the one voter's ❌ rejects", () => assert.equal(tally(["b"], [vote("b", "not")], 1, 0).outcome, "rejected"));
  test("4 people: 2 ❌ of 3 rejects, 1 doesn't", () => {
    assert.equal(tally(["b", "c", "d"], [vote("b", "not"), vote("c", "not")], 1, 0).outcome, "rejected");
    assert.equal(tally(["b", "c", "d"], [vote("b", "not")], 1, 0).outcome, "passed");
  });
  test("a kicked voter's vote stops counting", () => assert.equal(tally(["c"], [vote("b", "not"), vote("c", "done")], 1, 0).outcome, "passed"));
  test("nobody left to vote passes", () => assert.equal(tally([], [vote("b", "not")], 1, 0).outcome, "passed"));
  test("only votes for this attempt count", () => assert.equal(tally(["b"], [vote("b", "not", 1)], 2, 0).outcome, "passed"));
});

describe("dare → Done → vote", () => {
  test("spin, reroll once (never the same dare), Done opens voting for everyone else", () => {
    const d = go(fresh(), { type: "dare" }, { actor: "a" });
    assert.equal(d.p.status, "dare");
    assert.equal(d.p.rerollsLeft, 1);
    assert.deepEqual(d.fx, [{ e: "spun", dare: deck[0] }]);
    const rr = go(d.p, { type: "reroll" }, { actor: "a" });
    assert.notEqual(rr.p.dare!.id, d.p.dare!.id);
    assert.equal(rr.p.rerollsLeft, 0);
    no(rr.p, { type: "reroll" }, { actor: "a" }, 409);
    const v = go(rr.p, { type: "done" }, { actor: "a", now: ist(MON, "10:00") });
    assert.equal(v.p.status, "voting");
    assert.deepEqual(v.p.voters, ["b", "c"]);
    assert.equal(v.p.due, v.p.voteEnds);
  });
  test("tally runs the moment every eligible voter has voted", () => {
    const v1 = go(voting(), { type: "vote", vote: "done" }, { actor: "b", now: ist(MON, "11:00") });
    assert.equal(v1.p.status, "voting");
    const v2 = go(v1.p, { type: "vote", vote: "done" }, { actor: "c", now: ist(MON, "11:05"), votes: [vote("b", "done")] });
    assert.equal(v2.p.status, "passed");
    assert.equal(v2.p.due, null);
    assert.equal(v2.p.tallies[0].done, 2);
  });
  test("no votes by the end of the window passes (at the 9am check)", () => {
    const t = go(voting(), { type: "tick" }, { now: nineAm(WED) + 60_000, votes: [] });
    assert.equal(t.p.status, "passed");
  });
  test("you can change your vote until it closes", () => {
    const v1 = go(voting(), { type: "vote", vote: "not", reason: "notdone" }, { actor: "b" });
    const v2 = go(v1.p, { type: "vote", vote: "done" }, { actor: "b", votes: [vote("b", "not")] });
    assert.equal(v2.fx.find((f) => f.e === "vote")!.e, "vote");
    assert.equal(v2.p.status, "voting");
  });
  test("nobody to vote (everyone else gone) passes at once", () => {
    const d = go(fresh(["a", "b"]), { type: "dare" }, { actor: "a", members: ["a", "b"] });
    const v = go(d.p, { type: "done" }, { actor: "a", members: ["a"] });
    assert.equal(v.p.status, "passed");
  });
  test("an empty deck means no dare (pay still works)", () => {
    no(fresh(), { type: "dare" }, { actor: "a", deck: [] }, 409);
    assert.equal(go(fresh(), { type: "pay" }, { actor: "a", deck: [] }).p.status, "pay");
  });
});

describe("retry, and the second rejection", () => {
  const rejected = () => {
    const v = voting();
    const r = go(go(v, { type: "vote", vote: "not", reason: "noproof" }, { actor: "b" }).p,
      { type: "vote", vote: "not", reason: "easier" }, { actor: "c", votes: [vote("b", "not")], now: ist(MON, "12:00") });
    return r;
  };
  test("first rejection → retry with its own window; 'Sent it again' opens attempt 2", () => {
    const r = rejected();
    assert.equal(r.p.status, "retry");
    assert.equal(r.p.due, nextNine(ist(MON, "12:00"), 24));
    assert.equal(r.fx.at(-1)!.e, "rejected");
    const again = go(r.p, { type: "again" }, { actor: "a", now: ist(MON, "13:00") });
    assert.equal(again.p.status, "voting");
    assert.equal(again.p.attempt, 2);
    const passed = go(go(again.p, { type: "vote", vote: "done" }, { actor: "b" }).p, { type: "vote", vote: "done" }, { actor: "c", votes: [vote("b", "done", 2)] });
    assert.equal(passed.p.status, "passed");
  });
  test("second rejection → must pay (dare locked); not paying by the deadline gets you kicked", () => {
    const again = go(rejected().p, { type: "again" }, { actor: "a", now: ist(MON, "13:00") }).p;
    const r2 = go(go(again, { type: "vote", vote: "not", reason: "notdone" }, { actor: "b" }).p,
      { type: "vote", vote: "not", reason: "notdone" }, { actor: "c", votes: [vote("b", "not", 2)], now: ist(MON, "14:00") });
    assert.equal(r2.p.status, "pay");
    assert.equal(r2.p.locked, true);
    assert.equal(r2.p.due, nextNine(ist(MON, "14:00"), 24));
    no(r2.p, { type: "dare" }, { actor: "a" }, 409);
    const k = go(r2.p, { type: "tick" }, { now: r2.p.due! });
    assert.equal(k.p.status, "kicked");
    assert.deepEqual(k.fx, [{ e: "kick", uid: "a", why: "unpaid" }]);
    // ...or they pay in time and they're safe
    const safe = go(r2.p, { type: "paid" }, { actor: "a", now: ist(MON, "15:00") });
    assert.equal(safe.p.status, "paid");
    assert.equal(go(safe.p, { type: "tick" }, { now: r2.p.due! + H }).p.status, "paid");
  });
  test("switching dare → pay after one rejection keeps (at least) 24h", () => {
    const r = rejected();
    const p = go(r.p, { type: "pay" }, { actor: "a", now: ist(MON, "18:00") });
    assert.equal(p.p.status, "pay");
    assert.equal(p.p.due, r.p.due); // still ≥ 24h away
  });
});

describe("pay", () => {
  test("Pay → I paid marks every payee; once all are marked the penalty is paid and can't time out", () => {
    const p = go(fresh(), { type: "pay" }, { actor: "a" });
    assert.equal(p.p.due, p.p.actBy);
    const m = go(p.p, { type: "paid" }, { actor: "a" });
    assert.equal(m.p.status, "paid");
    assert.equal(m.p.due, null);
    assert.deepEqual(m.fx, [{ e: "marked", payees: ["b", "c"] }]);
    assert.equal(go(m.p, { type: "tick" }, { now: nineAm(addDays(MON, 9)) }).p.status, "paid");
  });
  test("payees: Got it confirms; Didn't get it goes back to unpaid without a new deadline or a kick", () => {
    const m = go(go(fresh(), { type: "pay" }, { actor: "a" }).p, { type: "paid" }, { actor: "a" }).p;
    const g = go(m, { type: "got" }, { actor: "b" });
    assert.equal(g.p.payments.b.s, "confirmed");
    const ng = go(g.p, { type: "notgot" }, { actor: "c" });
    assert.equal(ng.p.payments.c.s, "owed");
    assert.equal(ng.p.status, "paid");
    assert.equal(ng.p.due, null);
    assert.equal(go(ng.p, { type: "tick" }, { now: nineAm(addDays(MON, 9)) }).p.status, "paid");
    no(g.p, { type: "notgot" }, { actor: "b" }, 409); // already confirmed
    assert.equal(go(ng.p, { type: "paid" }, { actor: "a" }).p.payments.c.s, "marked"); // the payer can mark it again any time
  });
  test("no answer auto-confirms at the 9am check 48h+ later", () => {
    const m = go(go(fresh(), { type: "pay" }, { actor: "a" }).p, { type: "paid" }, { actor: "a" }).p;
    assert.equal(go(m, { type: "tick" }, { now: m.payments.b.confirmBy! - 1 }).p.payments.b.s, "marked");
    const t = go(m, { type: "tick" }, { now: m.payments.b.confirmBy! });
    assert.equal(t.p.payments.b.s, "confirmed");
    assert.equal(t.p.payments.b.how, "auto");
  });
  test("a payee can confirm even if the payer never tapped I paid", () => {
    const p = go(fresh(), { type: "pay" }, { actor: "a" }).p;
    const one = go(p, { type: "got" }, { actor: "b" });
    assert.equal(one.p.status, "pay");
    assert.equal(go(one.p, { type: "got" }, { actor: "c" }).p.status, "paid");
  });
  test("a kicked payee's payments confirm by themselves", () => {
    const m = go(go(fresh(), { type: "pay" }, { actor: "a" }).p, { type: "paid" }, { actor: "a" }).p;
    const t = go(m, { type: "tick" }, { members: ["a", "b"] });
    assert.equal(t.p.payments.c.s, "confirmed");
    assert.equal(t.p.payments.c.how, "kicked");
    const p = go(fresh(), { type: "pay" }, { actor: "a" }).p;
    assert.equal(go(p, { type: "paid" }, { actor: "a", members: ["a", "b"] }).p.payments.c.s, "confirmed");
  });
  test("pay is available from every unfinished state, and gives at least 24h", () => {
    const late = go(fresh(), { type: "pay" }, { actor: "a", now: nineAm(WED) - 2 * H }); // 2h left
    assert.equal(late.p.due, nextNine(nineAm(WED) - 2 * H, 24));
    const midVote = go(voting(), { type: "pay" }, { actor: "a", now: ist(TUE, "20:00") });
    assert.equal(midVote.p.status, "pay");
    assert.equal(midVote.p.voteEnds, null);
    no(midVote.p, { type: "vote", vote: "done" }, { actor: "b" }, 409); // the vote is cancelled
  });
});

describe("guards and idempotency", () => {
  test("only the player chooses, Dones, pays; only voters vote; only payees confirm", () => {
    no(fresh(), { type: "dare" }, { actor: "b" }, 403);
    no(fresh(), { type: "pay" }, { actor: "c" }, 403);
    no(voting(), { type: "vote", vote: "done" }, { actor: "a" }, 403); // the player can't vote on their own penalty
    no(voting(), { type: "vote", vote: "done" }, { actor: "d", members: [...ABC, "d"] }, 403); // joined after Done
    no(voting(), { type: "vote", vote: "done" }, { actor: "c", members: ["a", "b"] }, 403); // kicked since
    const p = go(fresh(), { type: "pay" }, { actor: "a" }).p;
    no(p, { type: "got" }, { actor: "a" }, 403);
  });
  test("❌ needs a reason, and Other needs a few words", () => {
    no(voting(), { type: "vote", vote: "not" }, { actor: "b" }, 400);
    no(voting(), { type: "vote", vote: "not", reason: "other" }, { actor: "b" }, 400);
    no(voting(), { type: "vote", vote: "maybe" }, { actor: "b" }, 400);
    const v = go(voting(), { type: "vote", vote: "not", reason: "other", note: "  it was a  different song  " }, { actor: "b" });
    const saved = v.fx.find((f) => f.e === "vote");
    assert.equal(saved && saved.e === "vote" && saved.vote.note, "it was a different song");
  });
  test("nothing after a deadline", () => {
    no(fresh(), { type: "dare" }, { actor: "a", now: nineAm(WED) }, 410);
    no(fresh(), { type: "pay" }, { actor: "a", now: nineAm(WED) }, 410);
    const d = go(fresh(), { type: "dare" }, { actor: "a" }).p;
    no(d, { type: "done" }, { actor: "a", now: nineAm(WED) }, 410);
    no(voting(), { type: "vote", vote: "done" }, { actor: "b", now: nineAm(WED) }, 409);
  });
  test("double taps are no-ops (two devices, a slow network)", () => {
    const d = go(fresh(), { type: "dare" }, { actor: "a" });
    assert.equal(go(d.p, { type: "dare" }, { actor: "a" }).changed, false);
    const v = go(d.p, { type: "done" }, { actor: "a" });
    const again = go(v.p, { type: "done" }, { actor: "a" });
    assert.equal(again.changed, false);
    assert.deepEqual(again.fx, []);
    const p = go(fresh(), { type: "pay" }, { actor: "a" });
    assert.equal(go(p.p, { type: "pay" }, { actor: "a" }).changed, false);
    const m = go(p.p, { type: "paid" }, { actor: "a" });
    assert.equal(go(m.p, { type: "paid" }, { actor: "a" }).changed, false);
    const g = go(m.p, { type: "got" }, { actor: "b" });
    assert.equal(go(g.p, { type: "got" }, { actor: "b" }).changed, false);
  });
});

describe("timeouts at the 9am check", () => {
  test("open, dare, retry and unpaid pay all get the player kicked at the deadline", () => {
    for (const [label, p] of [
      ["open", fresh()],
      ["dare", go(fresh(), { type: "dare" }, { actor: "a" }).p],
      ["pay", go(fresh(), { type: "pay" }, { actor: "a" }).p],
    ] as const) {
      assert.equal(go(p, { type: "tick" }, { now: p.due! - 1 }).p.status, label, label);
      const t = go(p, { type: "tick" }, { now: p.due! });
      assert.equal(t.p.status, "kicked", label);
      assert.deepEqual(t.fx, [{ e: "kick", uid: "a", why: "timeout" }], label);
    }
  });
  test("closing a kicked player's other penalties (any unfinished state)", () => {
    const c = go(voting(), { type: "close", why: "streak" });
    assert.equal(c.p.status, "kicked");
    assert.equal(c.p.closedWhy, "streak");
    const paid = go(go(fresh(), { type: "pay" }, { actor: "a" }).p, { type: "paid" }, { actor: "a" }).p;
    assert.equal(go(paid, { type: "close", why: "streak" }).changed, false); // paid stays paid
  });
  test("a voter is kicked while their vote is pending: if everyone left has voted, it tallies at once", () => {
    const v = go(voting(), { type: "vote", vote: "done" }, { actor: "b" }).p;
    const t = go(v, { type: "tick" }, { members: ["a", "b"], votes: [vote("b", "done")] });
    assert.equal(t.p.status, "passed");
    assert.equal(t.p.tallies[0].eligible, 1);
  });
  test("the last eligible voter leaving passes the dare", () => {
    const t = go(voting(), { type: "tick" }, { members: ["a"], votes: [vote("b", "not")] });
    assert.equal(t.p.status, "passed");
  });
});

describe("kicks: a group shrinking", () => {
  test("down to 1: the round ends and they win", () => {
    assert.deepEqual(planKicks(["a", "b"], ["a"]), { removed: ["a"], remaining: ["b"], ends: true, winner: "b" });
    assert.deepEqual(planKicks(["a", "b", "c"], ["a"]), { removed: ["a"], remaining: ["b", "c"], ends: false, winner: null });
  });
  test("everyone at once: nobody is removed and the round ends with no winner", () => {
    assert.deepEqual(planKicks(["a", "b"], ["a", "b"]), { removed: [], remaining: ["a", "b"], ends: true, winner: null });
  });
  test("non-members are ignored", () => assert.equal(planKicks(["a", "b"], ["z"]).ends, false));
  test("an early end stops the round at that day", () => {
    const g: Group = { code: "X", members: ["b"], stake: 100, rule: "all", days: 7, start: MON, round: 1, createdBy: "a", endedEarly: WED };
    assert.equal(roundEnd(g), WED);
    assert.equal(roundState(g, THU).phase, "over");
    const p: Player = { uid: "b", name: "b", tasks: [{ id: "t", text: "x" }], checks: {}, joined: MON };
    assert.deepEqual(countedDays(g, p, addDays(MON, 6)), [MON, TUE, WED]);
  });
  test("rejoining: not in the round you were kicked in, yes once a new round starts, not into a full group", () => {
    const g: Group = { code: "X", members: ["b"], stake: 100, rule: "all", days: 7, start: MON, round: 1, createdBy: "a",
      kicked: { a: { round: 1, day: WED, why: "timeout", owed: 100 } } };
    assert.equal(canRejoin(g, "a"), false);
    assert.equal(canRejoin({ ...g, round: 2 }, "a"), true);
    assert.equal(canRejoin({ ...g, round: 2, members: ["b", "c", "d", "e", "f", "g"] }, "a"), false);
    assert.equal(canRejoin({ ...g, round: 2 }, "z"), false); // never kicked: join with the code
  });
});

describe("3 missed days in a row", () => {
  test("3 consecutive penalty days", () => assert.equal(missesInARow([MON, TUE, WED], WED), 3));
  test("a clean day in between breaks it", () => assert.equal(missesInARow([MON, WED, THU], THU), 2));
  test("across a round boundary when the next round started the very next day", () => {
    // round 1 ends Tuesday (missed Mon + Tue), round 2 starts Wednesday (missed Wed) → 3
    assert.equal(missesInARow([MON, TUE, WED], WED), 3);
  });
  test("a day between rounds breaks it", () => {
    // round 1 ends Monday (missed), Tuesday is between rounds, round 2 starts Wednesday (missed Wed + Thu)
    assert.equal(missesInARow([MON, WED, THU], THU), 2);
  });
  test("counts back from the given day only", () => assert.equal(missesInARow([MON, TUE], WED), 0));
});

describe("money", () => {
  const pay = (uid: string, payees: string[], s: "owed" | "marked" | "confirmed", status: Penalty["status"] = "paid"): Penalty => {
    const p = newPenalty({ uid, day: MON, round: 1, stake: 100, members: [uid, ...payees], now: T0 });
    return { ...p, status, payments: Object.fromEntries(payees.map((x) => [x, { s, at: 0 }])) };
  };
  test("PAY penalties (and ones closed by a kick) owe the stake to each payee; no netting", () => {
    const l = penaltyLedger([pay("a", ["b"], "confirmed"), pay("b", ["a"], "owed", "pay"), pay("a", ["b"], "owed", "kicked")]);
    assert.deepEqual(l, [{ from: "a", to: "b", unpaid: 100, paid: 100 }, { from: "b", to: "a", unpaid: 100, paid: 0 }]);
    assert.equal(unpaidBy([pay("a", ["b", "c"], "marked")], "a"), 200); // marked isn't confirmed yet
  });
  test("a passed dare owes nothing; unfinished penalties are on the line, not money yet", () => {
    assert.deepEqual(penaltyLedger([pay("a", ["b"], "owed", "passed"), pay("a", ["b"], "owed", "open")]), []);
    assert.equal(onTheLine([pay("a", ["b", "c"], "owed", "voting")]).get("a"), 200);
  });
});

describe("the dare deck", () => {
  test("every starter dare passes the checker, and there are 25", () => {
    assert.equal(STARTER.length, 25);
    for (const d of STARTER) assert.equal(checkDare(d.text).ok, true, d.text);
  });
  test("one blocked example per rule", () => {
    const bad = ["Jump off the balcony into the pool", "Down a beer in one go", "Drive to the shop in your pyjamas", "Shoplift a chocolate",
      "Send a nude selfie", "Prank call a stranger", "Smash a plate on the floor", "Post it on your Instagram story"];
    bad.forEach((t, i) => { const r = checkDare(t); assert.equal(r.ok, false, t); if (!r.ok) assert.equal(r.rule, i, t); });
    assert.equal(bad.length, DARE_RULES.length);
  });
  test("length limits and clean-up", () => {
    assert.equal(checkDare("hi").ok, false);
    assert.equal(checkDare("x".repeat(121)).ok, false);
    const r = checkDare("  Sing   the national anthem\nbackwards  ");
    assert.equal(r.ok && r.text, "Sing the national anthem backwards");
  });
  test("reported starters and unapproved custom dares are out of the deck", () => {
    const docs: Record<string, DareDoc> = {
      s01: { text: STARTER[0].text, by: "cticks", createdAt: 0, approvedBy: "cticks", active: false, reported: { by: "b", at: 0 } },
      x1: { text: "Do a robot dance", by: "a", createdAt: 0, approvedBy: null, active: false, reported: null },
      x2: { text: "Moonwalk across the room", by: "a", createdAt: 0, approvedBy: "b", active: true, reported: null },
    };
    const ids = deckOf(docs).map((d) => d.id);
    assert.equal(ids.includes("s01"), false);
    assert.equal(ids.includes("x1"), false);
    assert.equal(ids.includes("x2"), true);
    assert.equal(ids.length, 25);
  });
  test("picking: never the excluded one, prefers dares you haven't had", () => {
    for (let i = 0; i < 20; i++) assert.notEqual(pickDare(deck, { exclude: "s01", rand: () => i / 20 })!.id, "s01");
    assert.equal(pickDare(deck, { avoid: ["s01", "s02"], rand: () => 0 })!.id, "s03");
    assert.equal(pickDare([deck[0]], { exclude: "s01", rand: () => 0 }), null);
  });
});

describe("push text", () => {
  test("never gendered, and says where proof goes", () => {
    const v = voting();
    const name = (u: string) => ({ a: "Aryaan", b: "Shanayaa", c: "Faiz" })[u] || "Someone";
    const passed = go(go(v, { type: "vote", vote: "done" }, { actor: "b" }).p, { type: "vote", vote: "done" }, { actor: "c", votes: [vote("b", "done")] });
    const msgs = [
      ...penaltyMsgs([{ e: "done", attempt: 1 }], v, name, ABC),
      ...penaltyMsgs(passed.fx, passed.p, name, ABC),
      ...penaltyMsgs([{ e: "marked", payees: ["b"] }], { ...fresh(), payments: { b: { s: "marked", at: 0, confirmBy: nineAm(THU) } } }, name, ABC),
    ];
    assert.ok(msgs.length >= 4);
    for (const m of msgs) assert.doesNotMatch(`${m.title} ${m.body}`, /\b(he|his|him|she|her|hers)\b/i, m.title);
    assert.match(msgs[0].body, /Check WhatsApp and vote by 9am Wed/);
    assert.deepEqual(msgs[0].to, ["b", "c"]);
  });
});
