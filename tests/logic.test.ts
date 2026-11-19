import { test } from "node:test";
import assert from "node:assert/strict";
import { addDays, diffDays, isMiss, ledger, missedDays, roundState, streak, dayKey, type Group, type Player } from "../lib/logic.ts";

const g = (over: Partial<Group> = {}): Group => ({
  code: "ABC123", members: ["a", "b"], stake: 100, rule: "all", days: 7, start: "2026-11-20", round: 1, createdBy: "a", ...over,
});
const p = (uid: string, checks: Record<string, string[]>, joined = "2026-11-19"): Player => ({
  uid, name: uid, joined, checks, tasks: [{ id: "t1", text: "gym" }, { id: "t2", text: "read" }, { id: "t3", text: "code" }],
});

test("date helpers", () => {
  assert.equal(addDays("2026-11-30", 1), "2026-12-01");
  assert.equal(addDays("2026-12-31", 1), "2027-01-01");
  assert.equal(diffDays("2026-11-20", "2026-11-26"), 6);
  // 19:00 UTC on Nov 19 is already Nov 20 in India
  assert.equal(dayKey(new Date("2026-11-19T19:00:00Z")), "2026-11-20");
});

test("round phases", () => {
  assert.deepEqual(roundState(g(), "2026-11-19"), { phase: "upcoming", day: 0 });
  assert.deepEqual(roundState(g(), "2026-11-22"), { phase: "active", day: 3 });
  assert.equal(roundState(g(), "2026-11-27").phase, "over");
});

test("rules: 'all' vs 'none'", () => {
  const pl = p("a", { "2026-11-20": ["t1"] });
  assert.equal(isMiss(g({ rule: "all" }), pl, "2026-11-20"), true);
  assert.equal(isMiss(g({ rule: "none" }), pl, "2026-11-20"), false);
  assert.equal(isMiss(g({ rule: "none" }), pl, "2026-11-21"), true);
  // stale ids from deleted tasks don't count
  assert.equal(isMiss(g({ rule: "none" }), p("a", { "2026-11-20": ["gone"] }), "2026-11-20"), true);
});

test("only finished days count, and not before joining", () => {
  const all = { "2026-11-20": ["t1", "t2", "t3"] };
  // on Nov 22: Nov 20 clean, Nov 21 missed, Nov 22 still in progress
  assert.deepEqual(missedDays(g(), p("a", all), "2026-11-22"), ["2026-11-21"]);
  // joined on Nov 21 → Nov 20 doesn't count
  assert.deepEqual(missedDays(g(), p("b", {}, "2026-11-21"), "2026-11-22"), ["2026-11-21"]);
});

test("ledger nets out per pair", () => {
  const full = ["t1", "t2", "t3"];
  const a = p("a", { "2026-11-20": full, "2026-11-21": full, "2026-11-22": full });
  const b = p("b", { "2026-11-20": full });
  const { misses, debts } = ledger(g(), [a, b], "2026-11-23");
  assert.equal(misses.get("a"), 0);
  assert.equal(misses.get("b"), 2);
  assert.deepEqual(debts, [{ from: "b", to: "a", amount: 200 }]);

  const c = p("c", {});
  const three = ledger(g({ members: ["a", "b", "c"] }), [a, b, c], "2026-11-23");
  assert.deepEqual(three.debts, [
    { from: "b", to: "a", amount: 200 },
    { from: "c", to: "a", amount: 300 },
    { from: "c", to: "b", amount: 100 },
  ]);
});

test("streak", () => {
  const full = ["t1", "t2", "t3"];
  const a = p("a", { "2026-11-20": full, "2026-11-21": full, "2026-11-22": full }, "2026-11-20");
  assert.equal(streak(g(), a, "2026-11-23"), 3); // today not done yet, still 3
  assert.equal(streak(g(), a, "2026-11-22"), 3); // today done → counts
  assert.equal(streak(g(), a, "2026-11-25"), 0); // missed yesterday
});
