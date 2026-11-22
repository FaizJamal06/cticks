import { inr, prettyDay, ruleLabel, TZ, type PenaltyMode, type Rule } from "./logic.ts";
import type { Effect, KickWhy, Penalty } from "./penalty.ts";

export type FeedItem = {
  id?: string;
  by: string;
  kind: "check" | "nudge" | "join" | "round" | "settings" | "tasks" | "mode" // posted by the app
    | "pen" | "kick" | "ended" | "dare"; // written by the server (Pay or Dare)
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
  next?: boolean; // settings queued for the next round (Pay or Dare)
  mode?: PenaltyMode;
  // server events
  ev?: string; // pen: created | chose-pay | spun | rerolled | done | passed | rejected | marked | got | notgot. dare: added | approved | reported
  pid?: string;
  dare?: string;
  attempt?: number;
  done?: number;
  notDone?: number;
  eligible?: number;
  payee?: string;
  why?: KickWhy;
  winner?: string | null;
  day?: string;
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
      return `${who} set the stake to ${inr(num(f.stake))} per miss${f.next ? ` from round ${num(f.round)}` : ""}. A miss = ${ruleLabel(f.rule === "none" ? "none" : "all")}`;
    case "round":
      return `${who} started round ${num(f.round)}: ${num(f.days) || "?"} days from ${f.start ? prettyDay(f.start) : "?"}`;
    case "mode":
      return `${who} switched to ${modeLabel(f.mode)} from round ${num(f.round)}`;
    case "pen":
      return penLine(f, who, name);
    case "kick":
      return `${who} ${f.by === viewer ? "are" : "is"} out: ${KICK_WHY[f.why || "timeout"].toLowerCase()}`;
    case "ended":
      return f.winner
        ? `${name(f.winner)} ${f.winner === viewer ? "are" : "is"} the last one standing. Round ${num(f.round)} is over`
        : `Round ${num(f.round)} ended with nobody out`;
    case "dare":
      return `${who} ${f.ev === "approved" ? "approved" : f.ev === "reported" ? "reported" : "added"} a dare: “${s(f.dare, 120)}”`;
    default:
      return `${who} did something`;
  }
}

export const modeLabel = (m?: PenaltyMode) => (m === "dare" ? "Pay or Dare" : "Money only");
export const KICK_WHY: Record<KickWhy, string> = {
  timeout: "Ignored a penalty for 48h",
  streak: "Missed 3 days in a row",
  unpaid: "Didn't pay after a failed dare",
};

function penLine(f: FeedItem, who: string, name: (uid: string) => string): string {
  const d = `“${s(f.dare, 120)}”`;
  switch (f.ev) {
    case "created": return `${who} missed ${f.day ? prettyDay(f.day, { weekday: "long" }) : "a day"}: pay ${inr(num(f.stake))} or take a dare`;
    case "chose-pay": return `${who} chose to pay`;
    case "spun": return `${who} got a dare: ${d}`;
    case "rerolled": return `${who} rerolled: ${d}`;
    case "done": return num(f.attempt) === 2 ? `${who} sent the proof again. Vote!` : `${who} says the dare is done. Vote!`;
    case "passed": return `${who}'s dare passed (${num(f.done)} of ${num(f.eligible)} said done)`;
    case "rejected": return `${who}'s dare didn't pass (${num(f.notDone)} of ${num(f.eligible)} said not done)`;
    case "marked": return `${who} says they paid`;
    case "got": return `${name(s(f.payee))} got ${who}'s ${inr(num(f.stake))}`;
    case "notgot": return `${name(s(f.payee))} says ${who}'s ${inr(num(f.stake))} didn't arrive`;
    default: return `${who}: penalty update`;
  }
}

// ---------- Pay or Dare pushes (server-composed; never gendered, because the app doesn't know anyone's pronouns) ----------
export type Msg = { to: string[]; title: string; body: string; kind: string };

/** "9am Sat": a deadline in India time. */
export const due = (ms: number | null | undefined) =>
  ms ? `9am ${new Date(ms).toLocaleDateString("en-IN", { weekday: "short", timeZone: TZ })}` : "the next check";
/** "₹100" with one payee, "₹100 each" with several. */
export const each = (p: Pick<Penalty, "stake" | "payees">) => `${inr(p.stake)}${p.payees.length > 1 ? " each" : ""}`;

/** The pushes for what step() just did to a penalty. `members` = current members. */
export function penaltyMsgs(fx: Effect[], p: Penalty, name: (uid: string) => string, members: string[]): Msg[] {
  const who = name(p.uid);
  const others = members.filter((m) => m !== p.uid);
  const text = p.dare?.text || "";
  const dare = /[.!?]$/.test(text) ? text : `${text}.`;
  const out: Msg[] = [];
  const add = (to: string[], title: string, body: string) => { if (to.length) out.push({ to, title, body, kind: "penalty" }); };
  for (const f of fx) {
    switch (f.e) {
      case "spun": add(others, `🎲 ${who}'s dare`, f.dare.text); break;
      case "rerolled": add(others, `🎲 ${who} rerolled`, `New dare: ${f.dare.text}`); break;
      case "done":
        if (f.attempt === 2) add(p.voters, `🎭 ${who} sent the proof again`, `${dare} Vote by ${due(p.voteEnds)}.`);
        else add(p.voters, `🎭 ${who} says the dare is done`, `${dare} Check WhatsApp and vote by ${due(p.voteEnds)}.`);
        break;
      case "passed": {
        const how = f.tally.eligible ? `${f.tally.done} of ${f.tally.eligible} said done.` : "Nobody left to vote.";
        add([p.uid], "✅ Your dare passed", `${how} Nothing owed.`);
        add(others, `✅ ${who}'s dare passed`, `${how} Nothing owed.`);
        break;
      }
      case "rejected":
        if (f.tally.attempt < 2) {
          add([p.uid], "❌ Your dare didn't pass", `Send the proof again or pay ${each(p)} by ${due(p.due)}.`);
          add(others, `❌ ${who}'s dare didn't pass`, "One retry left.");
        } else {
          add([p.uid], "❌ Second no", `Pay ${each(p)} by ${due(p.due)} or you're out.`);
          add(others, `❌ ${who}'s dare failed twice`, "Now it's pay or out.");
        }
        break;
      case "marked":
        for (const to of f.payees)
          add([to], `💸 ${who} says you've been paid ${inr(p.stake)}`, `Confirm you got it. No answer by ${due(p.payments[to]?.confirmBy)} counts as yes.`);
        break;
      case "got":
        if (f.how === "payee") add([p.uid], `✅ ${name(f.payee)} got your ${inr(p.stake)}`, "That one's settled.");
        break;
      case "notgot":
        add([p.uid], `🤨 ${name(f.payee)} says the ${inr(p.stake)} didn't arrive`, "Check your UPI and mark it paid again.");
        break;
    }
  }
  return out;
}

/** Feed items for the same effects (the server writes them with pushed: true). */
export function penaltyFeed(fx: Effect[], p: Penalty, now: number): Omit<FeedItem, "id">[] {
  const base = { by: p.uid, kind: "pen" as const, ts: now, pid: p.id };
  const items: Omit<FeedItem, "id">[] = [];
  for (const f of fx) {
    if (f.e === "spun" || f.e === "rerolled") items.push({ ...base, ev: f.e, dare: f.dare.text });
    else if (f.e === "done") items.push({ ...base, ev: "done", attempt: f.attempt, dare: p.dare?.text });
    else if (f.e === "passed" || f.e === "rejected")
      items.push({ ...base, ev: f.e, done: f.tally.done, notDone: f.tally.notDone, eligible: f.tally.eligible, attempt: f.tally.attempt });
    else if (f.e === "chose-pay" || f.e === "marked") items.push({ ...base, ev: f.e });
    else if ((f.e === "got" && f.how === "payee") || f.e === "notgot") items.push({ ...base, ev: f.e, payee: f.payee, stake: p.stake });
  }
  return items;
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
      return { title: `${who} joined cTicks`, body: `${plural(total, "task")} locked in. Game on.` };
    case "tasks":
      return { title: `${who} changed their tasks`, body: `Now ${plural(total, "task")}. Check what they picked.` };
    case "settings":
      return {
        title: `${who} changed the rules`,
        body: `${f.next ? `From round ${num(f.round)}: ` : ""}${inr(num(f.stake))} per missed day. A miss = ${ruleLabel(f.rule === "none" ? "none" : "all")}.`,
      };
    case "mode":
      return { title: `${who} switched to ${modeLabel(f.mode)}`, body: `Starts with round ${num(f.round)}.` };
    case "round":
      return { title: `Round ${num(f.round)} is set`, body: `${num(f.days)} days starting ${f.start ? prettyDay(f.start) : "soon"}. Lock in.` };
    default:
      return null;
  }
}
