// Runs once a day around 9am India time (vercel.json: 03:30 UTC). Every Pay or Dare deadline is 9am, so this is
// where penalties are created, votes close, payments auto-confirm and kicks happen (lib/penalty-server.ts).
// Money only groups also get the original "who missed yesterday / running total / final score" push.
// `?gid=CODE` limits the run to one group (tests on previews never touch real groups).
import { NextResponse } from "next/server";
import { pushTo } from "@/lib/admin";
import { allGroups, cronAuthorized, onlyGroup } from "@/lib/cron";
import { addDays, dayKey, inr, isDare, isMiss, ledger, roundDays, roundEnd } from "@/lib/logic";
import { morningCheck } from "@/lib/penalty-server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const now = Date.now();
  const today = dayKey(new Date(now));
  const yesterday = addDays(today, -1);
  let sent = 0;

  for (const { group, players } of await allGroups(onlyGroup(req))) {
    sent += (await morningCheck(group.code, now)).sent;
    if (isDare(group)) continue;
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
