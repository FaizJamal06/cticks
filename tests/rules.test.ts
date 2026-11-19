// Firestore security rules, run against the emulator: `npm run test:rules` (needs Java 21+).
// alice and bob are in group G, carol is a signed-in outsider.
import { after, before, beforeEach, describe, test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from "@firebase/rules-unit-testing";
import {
  addDoc, arrayRemove, arrayUnion, collection, deleteDoc, deleteField, doc, FieldPath, getDoc, getDocs, limit, orderBy, query,
  setDoc, setLogLevel, updateDoc, where,
} from "firebase/firestore";
import { addDays, dayKey } from "../lib/logic.ts";

// Same math as istToday() in firestore.rules: server time + 330 min, as YYYY-MM-DD.
const TODAY = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
const YESTERDAY = addDays(TODAY, -1);
const TOMORROW = addDays(TODAY, 1);
const LAST_WEEK = addDays(TODAY, -7);

const G = "ABC234";
const groupDoc = (members: string[], over: Record<string, unknown> = {}) => ({
  code: G, members, createdBy: members[0], createdAt: 1, stake: 100, rule: "all", days: 7, start: TODAY, round: 1, ...over,
});
const playerDoc = (uid: string, checks: Record<string, string[]> = {}) => ({
  uid, name: uid, tasks: [{ id: "t1", text: "gym" }, { id: "t2", text: "read" }], checks, joined: TODAY,
});

let env: RulesTestEnvironment;
const as = (uid: string) => env.authenticatedContext(uid).firestore();
const anon = () => env.unauthenticatedContext().firestore();
type DB = ReturnType<typeof anon>;
const seed = (fn: (db: DB) => Promise<unknown>) => env.withSecurityRulesDisabled((ctx) => fn(ctx.firestore()).then(() => {}));
const setMembers = (members: string[]) => seed((db) => updateDoc(doc(db, `groups/${G}`), { members }));
// In these helpers `undefined` means "field missing": left out on create, deleted on update.
const forCreate = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));
const forUpdate = (o: Record<string, unknown>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, v === undefined ? deleteField() : v]));

before(async () => {
  setLogLevel("silent"); // denied writes are expected here; don't log each one
  env = await initializeTestEnvironment({ projectId: "demo-payup", firestore: { rules: readFileSync("firestore.rules", "utf8") } });
});
after(() => env.cleanup());
beforeEach(async () => {
  await env.clearFirestore();
  await seed(async (db) => {
    await setDoc(doc(db, "users/alice"), { name: "alice", groupId: G, fcmTokens: [] });
    await setDoc(doc(db, `groups/${G}`), groupDoc(["alice", "bob"]));
    await setDoc(doc(db, `groups/${G}/players/alice`), playerDoc("alice", { [YESTERDAY]: ["t1"] }));
    await setDoc(doc(db, `groups/${G}/players/bob`), playerDoc("bob"));
    await setDoc(doc(db, `groups/${G}/feed/f1`), { by: "alice", kind: "join", total: 2, ts: 1 });
  });
});

test("the test's 'today' matches the app's dayKey()", () => assert.equal(TODAY, dayKey()));

describe("users/{uid}", () => {
  test("owner can read and write", async () => {
    await assertSucceeds(getDoc(doc(as("alice"), "users/alice")));
    await assertSucceeds(setDoc(doc(as("alice"), "users/alice"), { fcmTokens: arrayUnion("tok") }, { merge: true }));
  });
  test("anyone else can't", async () => {
    await assertFails(getDoc(doc(as("bob"), "users/alice")));
    await assertFails(setDoc(doc(as("bob"), "users/alice"), { name: "x" }, { merge: true }));
    await assertFails(setDoc(doc(as("bob"), "users/carol"), { name: "x" }));
    await assertFails(getDoc(doc(anon(), "users/alice")));
  });
});

describe("groups: get, list, create, delete", () => {
  test("any signed-in user can get by code (existing or not)", async () => {
    await assertSucceeds(getDoc(doc(as("carol"), `groups/${G}`)));
    await assertSucceeds(getDoc(doc(as("carol"), "groups/ZZZZZZ")));
  });
  test("signed-out get is denied", () => assertFails(getDoc(doc(anon(), `groups/${G}`))));
  test("list is denied, even for a member", async () => {
    await assertFails(getDocs(collection(as("alice"), "groups")));
    await assertFails(getDocs(query(collection(as("alice"), "groups"), where("members", "array-contains", "alice"))));
  });
  test("create only with members == [me] and createdBy == me", async () => {
    const db = as("carol");
    const g = (over: Record<string, unknown>) => ({ ...groupDoc(["carol"]), code: "NEW234", ...over });
    await assertFails(setDoc(doc(db, "groups/NEW234"), g({ members: ["carol", "alice"] })));
    await assertFails(setDoc(doc(db, "groups/NEW234"), g({ members: ["alice"] })));
    await assertFails(setDoc(doc(db, "groups/NEW234"), g({ createdBy: "alice" })));
    await assertFails(setDoc(doc(db, "groups/NEW234"), g({ stake: 0 })));
    await assertFails(setDoc(doc(db, "groups/NEW234"), g({ stake: "100" })));
    await assertFails(setDoc(doc(anon(), "groups/NEW234"), g({})));
    await assertSucceeds(setDoc(doc(db, "groups/NEW234"), g({})));
  });
  test("a code collision can't overwrite an existing group", () =>
    assertFails(setDoc(doc(as("carol"), `groups/${G}`), groupDoc(["carol"]))));
  test("delete is denied", () => assertFails(deleteDoc(doc(as("alice"), `groups/${G}`))));
});

describe("groups: joining", () => {
  const ref = (uid: string) => doc(as(uid), `groups/${G}`);
  test("you can add exactly yourself (what the app sends)", () =>
    assertSucceeds(updateDoc(ref("carol"), { members: arrayUnion("carol") })));
  test("you can't add someone else, or yourself plus someone", async () => {
    await assertFails(updateDoc(ref("carol"), { members: arrayUnion("dave") }));
    await assertFails(updateDoc(ref("carol"), { members: arrayUnion("carol", "dave") }));
    await assertFails(updateDoc(ref("alice"), { members: arrayUnion("dave") })); // a member can't add others either
  });
  test("you can't remove or reorder anyone", async () => {
    await assertFails(updateDoc(ref("carol"), { members: ["carol"] }));
    await assertFails(updateDoc(ref("carol"), { members: ["bob", "carol"] }));
    await assertFails(updateDoc(ref("carol"), { members: ["bob", "alice", "carol"] }));
    await assertFails(updateDoc(ref("alice"), { members: ["alice"] }));
    await assertFails(updateDoc(ref("bob"), { members: arrayRemove("alice") }));
  });
  test("joining can't change anything else", () =>
    assertFails(updateDoc(ref("carol"), { members: arrayUnion("carol"), stake: 1 })));
  test("signed-out join is denied", () =>
    assertFails(updateDoc(doc(anon(), `groups/${G}`), { members: arrayUnion("x") })));
  test("5 people: the 6th can join", async () => {
    await setMembers(["alice", "bob", "u3", "u4", "u5"]);
    await assertSucceeds(updateDoc(ref("carol"), { members: arrayUnion("carol") }));
  });
  test("6 people: full, a 7th can't join", async () => {
    await setMembers(["alice", "bob", "u3", "u4", "u5", "u6"]);
    await assertFails(updateDoc(ref("carol"), { members: arrayUnion("carol") }));
  });
});

describe("groups: member edits", () => {
  const ref = (uid: string) => doc(as(uid), `groups/${G}`);
  test("members can change stake and rule (Settings → Save rules)", () =>
    assertSucceeds(updateDoc(ref("bob"), { stake: 200, rule: "none" })));
  test("members can start a new round", () =>
    assertSucceeds(updateDoc(ref("bob"), { start: TOMORROW, days: 14, round: 2 })));
  test("members can't change createdBy", () => assertFails(updateDoc(ref("bob"), { createdBy: "bob" })));
  test("non-members can't change anything", async () => {
    await assertFails(updateDoc(ref("carol"), { stake: 1 }));
    await assertFails(updateDoc(ref("carol"), { round: 9 }));
  });
});

describe("players/{uid}", () => {
  const p = (who: string, uid: string) => doc(as(who), `groups/${G}/players/${uid}`);
  test("members can read (get + list)", async () => {
    await assertSucceeds(getDoc(p("bob", "alice")));
    await assertSucceeds(getDocs(collection(as("bob"), `groups/${G}/players`)));
  });
  test("non-members can't read", async () => {
    await assertFails(getDoc(p("carol", "alice")));
    await assertFails(getDocs(collection(as("carol"), `groups/${G}/players`)));
    await assertFails(getDoc(doc(anon(), `groups/${G}/players/alice`)));
  });
  test("you can write your own, not someone else's", async () => {
    await assertSucceeds(updateDoc(p("alice", "alice"), { name: "Alice" }));
    await assertFails(updateDoc(p("alice", "bob"), { name: "Bob" }));
    await assertFails(updateDoc(p("alice", "bob"), new FieldPath("checks", TODAY), arrayUnion("t1")));
    await assertFails(setDoc(p("alice", "dave"), playerDoc("dave")));
  });
  test("create requires checks == {}", async () => {
    await setMembers(["alice", "bob", "carol"]);
    await assertFails(setDoc(p("carol", "carol"), playerDoc("carol", { [TODAY]: ["t1"] })));
    await assertFails(setDoc(p("carol", "carol"), playerDoc("carol", { [YESTERDAY]: ["t1", "t2"] })));
    await assertSucceeds(setDoc(p("carol", "carol"), playerDoc("carol")));
  });
  test("non-members can't create a player doc", () => assertFails(setDoc(p("carol", "carol"), playerDoc("carol"))));
  test("delete is denied", () => assertFails(deleteDoc(p("alice", "alice"))));
});

describe("players: joined, uid and tasks can't be used to dodge misses", () => {
  const tasks = (n: number) => Array.from({ length: n }, (_, i) => ({ id: `t${i}`, text: `task ${i}` }));
  const create = (over: Record<string, unknown>) => setDoc(doc(as("carol"), `groups/${G}/players/carol`), forCreate({ ...playerDoc("carol"), ...over }));
  const mine = () => doc(as("alice"), `groups/${G}/players/alice`);
  beforeEach(() => setMembers(["alice", "bob", "carol"]));

  test("create: joined can't be in the future; today or earlier is fine", async () => {
    await assertFails(create({ joined: TOMORROW }));
    await assertFails(create({ joined: "2099-01-01" }));
    await assertFails(create({ joined: 20261119 }));
    await assertFails(create({ joined: undefined }));
    await assertSucceeds(create({ joined: YESTERDAY }));
  });
  test("create: uid must be your own", () => assertFails(create({ uid: "alice" })));
  test("create: 1–8 tasks", async () => {
    await assertFails(create({ tasks: [] }));
    await assertFails(create({ tasks: tasks(9) }));
    await assertFails(create({ tasks: "gym" }));
    await assertFails(create({ tasks: undefined }));
    await assertSucceeds(create({ tasks: tasks(8) }));
  });
  test("create: 1 task is the minimum", () => assertSucceeds(create({ tasks: tasks(1) })));
  test("update: joined is locked", async () => {
    await assertFails(updateDoc(mine(), { joined: "2099-01-01" }));
    await assertFails(updateDoc(mine(), { joined: YESTERDAY }));
    await assertFails(updateDoc(mine(), { joined: deleteField() }));
  });
  test("update: uid is locked", async () => {
    await assertFails(updateDoc(mine(), { uid: "bob" }));
    await assertFails(updateDoc(mine(), { uid: deleteField() }));
  });
  test("update: 1–8 tasks", async () => {
    await assertFails(updateDoc(mine(), { tasks: [] }));
    await assertFails(updateDoc(mine(), { tasks: tasks(9) }));
    await assertFails(updateDoc(mine(), { tasks: deleteField() }));
    await assertSucceeds(updateDoc(mine(), { tasks: tasks(1) }));
    await assertSucceeds(updateDoc(mine(), { tasks: tasks(8) }));
  });
});

describe("groups: stake, rule, days and round must be valid", () => {
  const create = (over: Record<string, unknown>) =>
    setDoc(doc(as("carol"), "groups/NEW234"), forCreate({ ...groupDoc(["carol"]), code: "NEW234", ...over }));
  const edit = (over: Record<string, unknown>) => updateDoc(doc(as("bob"), `groups/${G}`), forUpdate(over));
  const bad: Record<string, unknown>[] = [
    { stake: -5 }, { stake: 100001 }, { stake: "abc" }, { stake: null },
    { rule: "some" }, { rule: "" }, { days: 10 }, { days: "7" }, { days: 0 },
    { round: 1.5 }, { round: "1" }, { round: undefined }, { stake: undefined },
  ];
  test("create: bad values are denied", async () => {
    for (const b of bad) await assertFails(create(b));
  });
  test("create: every allowed value works", async () => {
    for (const days of [7, 14, 21, 30]) await assertSucceeds(create({ days }));
    await assertSucceeds(create({ stake: 100000, rule: "none" }));
    await assertSucceeds(create({ stake: 1 }));
  });
  test("update: bad values are denied", async () => {
    for (const b of bad) await assertFails(edit(b));
  });
  test("update: valid edits still work", async () => {
    await assertSucceeds(edit({ stake: 100000, rule: "none" }));
    await assertSucceeds(edit({ days: 30, round: 2, start: TOMORROW }));
  });
});

describe("checks: only today's key (IST) can change", () => {
  const mine = () => doc(as("alice"), `groups/${G}/players/alice`);
  const tick = (day: string, op: unknown) => updateDoc(mine(), new FieldPath("checks", day), op);
  test("tick and untick today (what the app sends)", async () => {
    await assertSucceeds(tick(TODAY, arrayUnion("t1")));
    await assertSucceeds(tick(TODAY, arrayUnion("t2")));
    await assertSucceeds(tick(TODAY, arrayRemove("t1")));
  });
  test("yesterday is locked", async () => {
    await assertFails(tick(YESTERDAY, arrayUnion("t2")));
    await assertFails(tick(YESTERDAY, arrayRemove("t1")));
    await assertFails(tick(YESTERDAY, deleteField()));
  });
  test("any other day is locked", async () => {
    await assertFails(tick(TOMORROW, arrayUnion("t1")));
    await assertFails(tick(LAST_WEEK, arrayUnion("t1")));
  });
  test("today plus another day in one write is denied", () =>
    assertFails(updateDoc(mine(), new FieldPath("checks", TODAY), ["t1"], new FieldPath("checks", YESTERDAY), ["t1", "t2"])));
  test("replacing the whole checks map can't drop yesterday", () =>
    assertFails(updateDoc(mine(), { checks: { [TODAY]: ["t1"] } })));
  test("editing tasks leaves checks alone, so it's allowed", () =>
    assertSucceeds(updateDoc(mine(), { tasks: [{ id: "t9", text: "run" }] })));
});

describe("feed", () => {
  const feed = (uid: string) => collection(as(uid), `groups/${G}/feed`);
  test("members can read (the app's query)", () =>
    assertSucceeds(getDocs(query(feed("bob"), orderBy("ts", "desc"), limit(60)))));
  test("non-members can't read", async () => {
    await assertFails(getDocs(feed("carol")));
    await assertFails(getDoc(doc(as("carol"), `groups/${G}/feed/f1`)));
  });
  test("create only as yourself", async () => {
    await assertSucceeds(addDoc(feed("bob"), { by: "bob", kind: "check", task: "t1", n: 1, total: 2, ts: Date.now() }));
    await assertFails(addDoc(feed("bob"), { by: "alice", kind: "check", ts: Date.now() }));
    await assertFails(addDoc(feed("bob"), { kind: "check", ts: Date.now() }));
    await assertFails(addDoc(feed("carol"), { by: "carol", kind: "join", ts: Date.now() }));
  });
  test("update and delete are denied, even your own item", async () => {
    const f1 = doc(as("alice"), `groups/${G}/feed/f1`);
    await assertFails(updateDoc(f1, { pushed: true }));
    await assertFails(deleteDoc(f1));
    await assertFails(deleteDoc(doc(as("bob"), `groups/${G}/feed/f1`)));
  });
});
