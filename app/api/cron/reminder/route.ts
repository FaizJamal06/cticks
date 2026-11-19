// Runs once a day around 9pm India time (vercel.json: 15:30 UTC; Hobby plans fire within that hour).
// Anyone who hasn't done enough today gets a warning before midnight.
import { NextResponse } from "next/server";
import { pushTo } from "@/lib/admin";
import { allGroups, cronAuthorized } from "@/lib/cron";
import { dayKey, doneCount, inr, isMiss, openTasks, roundState } from "@/lib/logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const today = dayKey();
  let sent = 0;

  for (const { group, players } of await allGroups()) {
    if (roundState(group, today).phase !== "active" || players.length < 2) continue;
    for (const p of players) {
      if (!isMiss(group, p, today)) continue;
      const others = players.filter((o) => o.uid !== p.uid);
      const open = openTasks(p, today);
      const owed = inr(group.stake * others.length);
      const rival = others[0];
      const rivalLine =
        others.length === 1
          ? ` ${rival.name} is at ${doneCount(rival, today)}/${rival.tasks.length}.`
          : "";
      const body =
        group.rule === "none"
          ? `You haven't done a single task today. Do one before midnight or you owe ${owed}.${rivalLine}`
          : `${open.length} left: ${open.map((t) => t.text).join(", ")}. Finish before midnight or you owe ${owed}.${rivalLine}`;
      sent += await pushTo([p.uid], { title: "⏰ Clock's ticking", body: body.slice(0, 220), kind: "reminder" });
    }
  }
  return NextResponse.json({ ok: true, today, sent });
}
