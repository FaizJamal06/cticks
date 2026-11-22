// Shared game logic — used by the app (browser) and the cron/notify API routes (server).
// All days are calendar days in India time, so "today" is the same for both of you.

export const TZ = "Asia/Kolkata";

export type Rule = "all" | "none"; // all = every task must be done; none = only a zero-task day is a miss
export type Task = { id: string; text: string };
export type PenaltyMode = "money" | "dare"; // money = net out per pair (the original game); dare = Pay or Dare + eliminations
export type Kicked = { round: number; day: string; why: "timeout" | "streak" | "unpaid"; owed: number };
export type Group = {
  code: string;
  members: string[];
  stake: number;
  rule: Rule;
  days: number;
  start: string; // YYYY-MM-DD, first day of the current round
  round: number;
  createdBy: string;
  penaltyMode?: PenaltyMode; // missing = "money" (groups made before Pay or Dare)
  next?: { penaltyMode?: PenaltyMode; stake?: number; rule?: Rule }; // applied when the next round starts
  kicked?: Record<string, Kicked>; // players currently out (server-only)
  endedEarly?: string; // last day of a round that ended by elimination
  winner?: string; // the last one standing
  checkedOn?: string; // last day the 9am check ran for this group (server-only)
};
export const isDare = (g: Group) => g.penaltyMode === "dare";
export type Player = {
  uid: string;
  name: string;
  tasks: Task[];
  checks: Record<string, string[]>; // day -> task ids done that day
  joined: string; // YYYY-MM-DD — days before this never count against them
};

const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });
export const dayKey = (d: Date = new Date()) => fmt.format(d);

const toUTC = (k: string) => {
  const [y, m, d] = k.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
};
export const addDays = (k: string, n: number) => new Date(toUTC(k) + n * 864e5).toISOString().slice(0, 10);
export const diffDays = (a: string, b: string) => Math.round((toUTC(b) - toUTC(a)) / 864e5);

export const prettyDay = (k: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) =>
  new Date(toUTC(k)).toLocaleDateString("en-IN", { ...opts, timeZone: "UTC" });

/** Every day of the round as scheduled (the grid shows all of them, even after an early end). */
export const roundDays = (g: Group) => Array.from({ length: g.days }, (_, i) => addDays(g.start, i));
/** Last day that counts: the scheduled end, or earlier if the round ended by elimination. */
export const roundEnd = (g: Group) => {
  const end = addDays(g.start, g.days - 1);
  return g.endedEarly && g.endedEarly < end ? g.endedEarly : end;
};

/** 09:00 India time on `day`, as epoch ms. Every Pay or Dare deadline lands here: it's when the morning check runs. */
export const nineAm = (day: string) => toUTC(day) + (9 * 60 - 330) * 60_000;
/** The first 9am that is at least `hours` after `ms`. */
export function nextNine(ms: number, hours: number) {
  const t = ms + hours * 3_600_000;
  const d = dayKey(new Date(t));
  return nineAm(d) >= t ? nineAm(d) : nineAm(addDays(d, 1));
}

export function roundState(g: Group, today: string): { phase: "upcoming" | "active" | "over"; day: number } {
  if (today < g.start) return { phase: "upcoming", day: 0 };
  if (today > roundEnd(g)) return { phase: "over", day: g.days };
  return { phase: "active", day: diffDays(g.start, today) + 1 };
}

export function doneIds(p: Player, k: string): string[] {
  const valid = new Set((p.tasks || []).map((t) => t.id));
  return [...new Set(p.checks?.[k] || [])].filter((id) => valid.has(id));
}
export const doneCount = (p: Player, k: string) => doneIds(p, k).length;

/** Does this day count as a miss under the group's rule? (Evaluates the day as it stands.) */
export function isMiss(g: Group, p: Player, k: string): boolean {
  const total = (p.tasks || []).length;
  if (!total) return false;
  const n = doneCount(p, k);
  return g.rule === "none" ? n === 0 : n < total;
}

/** Finished days of the current round that count for this player. */
export const countedDays = (g: Group, p: Player, today: string) => {
  const end = roundEnd(g);
  return roundDays(g).filter((k) => k < today && k >= p.joined && k <= end);
};

/**
 * Missed days in a row ending at `day`: consecutive calendar days that each have a penalty.
 * Built from penalty days so it carries across a round boundary when the next round starts the very next day;
 * any day without a penalty (a clean day, a day between rounds) breaks it.
 */
export function missesInARow(penaltyDays: Iterable<string>, day: string): number {
  const set = new Set(penaltyDays);
  let n = 0;
  for (let k = day; set.has(k) && n < 400; k = addDays(k, -1)) n++;
  return n;
}

/** Someone who was kicked can come back once the round they were kicked in is over and a new one has started. */
export const canRejoin = (g: Group, uid: string) => {
  const k = g.kicked?.[uid];
  return !!k && k.round < g.round && !g.members.includes(uid) && g.members.length < 6;
};

export const missedDays = (g: Group, p: Player, today: string) =>
  countedDays(g, p, today).filter((k) => isMiss(g, p, k));

/**
 * Every missed day, you owe `stake` to each other player.
 * Returns the net amount per pair, e.g. [{ from: "a", to: "b", amount: 200 }].
 */
export function ledger(g: Group, players: Player[], today: string) {
  const misses = new Map(players.map((p) => [p.uid, missedDays(g, p, today).length]));
  const out: { from: string; to: string; amount: number }[] = [];
  for (let i = 0; i < players.length; i++)
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i].uid, b = players[j].uid;
      const net = ((misses.get(a) || 0) - (misses.get(b) || 0)) * g.stake; // >0: a owes b
      if (net > 0) out.push({ from: a, to: b, amount: net });
      else if (net < 0) out.push({ from: b, to: a, amount: -net });
    }
  return { misses, debts: out };
}

/** Consecutive clean days ending yesterday (plus today if today is already clean). */
export function streak(g: Group, p: Player, today: string): number {
  let n = 0;
  if (!isMiss(g, p, today) && doneCount(p, today) > 0) n++;
  for (let k = addDays(today, -1); k >= p.joined && n < 400; k = addDays(k, -1)) {
    if (isMiss(g, p, k)) break;
    n++;
  }
  return n;
}

export const openTasks = (p: Player, k: string) => {
  const done = new Set(doneIds(p, k));
  return (p.tasks || []).filter((t) => !done.has(t.id));
};

export const inr = (n: number) => "₹" + Math.round(n).toLocaleString("en-IN");
export const ruleLabel = (r: Rule) => (r === "none" ? "a day with zero tasks done" : "any task left undone");
