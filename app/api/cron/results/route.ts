// Runs once a day around 9am India time (vercel.json: 03:30 UTC).
// Tells everyone who missed yesterday and where the money stands; announces the final score when a round ends.
import { NextResponse } from "next/server";
import { pushTo } from "@/lib/admin";
import { allGroups, cronAuthorized } from "@/lib/cron";
import { addDays, dayKey, inr, isMiss, ledger, roundDays, roundEnd } from "@/lib/logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const today = dayKey();
  const yesterday = addDays(today, -1);
  let sent = 0;

  for (const { group, players } of await allGroups()) {
    if (players.length < 2 || !roundDays(group).includes(yesterday)) continue;
    const name = (id: string) => players.find((p) => p.uid === id)?.name || "Someone";
    const missed = players.filter((p) => yesterday >= p.joined && isMiss(group, p, yesterday));
    const { debts } = ledger(group, players, today);
    const money = debts.length ? debts.map((d) => `${name(d.from)} owes ${name(d.to)} ${inr(d.amount)}`).join(", ") : "All square";
    const over = yesterday === roundEnd(group);

    const title = over
      ? `🏁 Round ${group.round} is over`
      : missed.length
        ? `💸 ${missed.map((p) => p.name).join(" & ")} missed yesterday`
        : "✅ Clean day yesterday";
    const body = over
      ? `Final: ${money}. Settle up, then start round ${group.round + 1} in the app.`
      : `${missed.length ? "" : "Nobody slipped. "}Running total: ${money}.`;

    sent += await pushTo(group.members, { title, body, kind: "results" });
  }
  return NextResponse.json({ ok: true, today, sent });
}
