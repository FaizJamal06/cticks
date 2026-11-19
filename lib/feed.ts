import { inr, prettyDay, ruleLabel, type Rule } from "./logic";

export type FeedItem = {
  id?: string;
  by: string;
  kind: "check" | "nudge" | "join" | "round" | "settings" | "tasks";
  ts: number;
  task?: string;
  n?: number;
  total?: number;
  to?: string;
  open?: number;
  stake?: number;
  rule?: Rule;
  round?: number;
  start?: string;
  days?: number;
};

const s = (v: unknown, max = 80) => String(v ?? "").slice(0, max);
const num = (v: unknown) => (Number.isFinite(Number(v)) ? Number(v) : 0);
const plural = (n: number, w: string) => `${n} ${w}${n === 1 ? "" : "s"}`;

/** One line for the in-app activity feed. `name(uid)` should return "You" for the viewer. */
export function feedLine(f: FeedItem, name: (uid: string) => string, viewer: string): string {
  const who = name(f.by);
  const their = f.by === viewer ? "your" : "their";
  const n = num(f.n), total = num(f.total);
  switch (f.kind) {
    case "check":
      if (total && n >= total) return `${who} cleared all ${plural(total, "task")} today 🔥`;
      if (n === 1) return `${who} knocked out ${their} first task: “${s(f.task)}”`;
      return `${who} finished “${s(f.task)}” (${n}/${total})`;
    case "nudge":
      return `${who} nudged ${f.to === viewer ? "you" : name(s(f.to))}: ${plural(num(f.open), "task")} still open 👀`;
    case "join":
      return `${who} joined with ${plural(total, "task")}`;
    case "tasks":
      return `${who} updated ${their} task list (${plural(total, "task")})`;
    case "settings":
      return `${who} set the stake to ${inr(num(f.stake))} per miss. A miss = ${ruleLabel(f.rule === "none" ? "none" : "all")}`;
    case "round":
      return `${who} started round ${num(f.round)}: ${num(f.days) || "?"} days from ${f.start ? prettyDay(f.start) : "?"}`;
    default:
      return `${who} did something`;
  }
}

/** The push notification for a feed item, written for the people receiving it. */
export function feedPush(f: FeedItem, name: (uid: string) => string, stake: number): { title: string; body: string } | null {
  const who = name(f.by);
  const n = num(f.n), total = num(f.total);
  switch (f.kind) {
    case "check":
      if (total && n >= total) return { title: `${who} cleared the day 🔥`, body: `All ${plural(total, "task")} done. Your move.` };
      if (n === 1) return { title: `${who} is on the board`, body: `First task done: ${s(f.task)} (1/${total})` };
      return { title: `${who} finished ${s(f.task)}`, body: `${n}/${total} done today` };
    case "nudge":
      return { title: `👀 ${who} nudged you`, body: `${plural(num(f.open), "task")} still open today. ${inr(stake)} on the line.` };
    case "join":
      return { title: `${who} joined Pay Up`, body: `${plural(total, "task")} locked in. Game on.` };
    case "tasks":
      return { title: `${who} changed their tasks`, body: `Now ${plural(total, "task")}. Check what they picked.` };
    case "settings":
      return { title: `${who} changed the rules`, body: `${inr(num(f.stake))} per missed day. A miss = ${ruleLabel(f.rule === "none" ? "none" : "all")}.` };
    case "round":
      return { title: `Round ${num(f.round)} is set`, body: `${num(f.days)} days starting ${f.start ? prettyDay(f.start) : "soon"}. Lock in.` };
    default:
      return null;
  }
}
