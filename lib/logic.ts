// Shared game logic — used by the app (browser) and the cron/notify API routes (server).
// All days are calendar days in India time, so "today" is the same for both of you.

export const TZ = "Asia/Kolkata";

export type Rule = "all" | "none"; // all = every task must be done; none = only a zero-task day is a miss
export type Task = { id: string; text: string };
export type Group = {
  code: string;
  members: string[];
  stake: number;
  rule: Rule;
  days: number;
  start: string; // YYYY-MM-DD, first day of the current round
  round: number;
  createdBy: string;
};
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

export const roundDays = (g: Group) => Array.from({ length: g.days }, (_, i) => addDays(g.start, i));
export const roundEnd = (g: Group) => addDays(g.start, g.days - 1);

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
export const countedDays = (g: Group, p: Player, today: string) =>
  roundDays(g).filter((k) => k < today && k >= p.joined);

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
