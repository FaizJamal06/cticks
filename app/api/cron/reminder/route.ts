// Runs once a day around 9pm India time (vercel.json: 15:30 UTC; Hobby plans fire within that hour).
// Anyone who hasn't done enough today gets a warning before midnight. `?gid=CODE` limits it to one group (tests).
import { NextResponse } from "next/server";
import { adminDb, pushTo } from "@/lib/admin";
import { allGroups, cronAuthorized, onlyGroup } from "@/lib/cron";
import { addDays, dayKey, doneCount, inr, isDare, isMiss, missesInARow, openTasks, roundState } from "@/lib/logic";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!cronAuthorized(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const today = dayKey();
  let sent = 0;

  for (const { group, players } of await allGroups(onlyGroup(req))) {
    if (roundState(group, today).phase !== "active" || players.length < 2) continue;
    // Pay or Dare: who's on 2 misses in a row (yesterday's penalty exists by now; the 9am check made it)
    const penDays = new Map<string, string[]>();
    if (isDare(group)) {
      const ps = await adminDb().collection(`groups/${group.code}/penalties`).get();
      for (const d of ps.docs) penDays.set(d.get("uid"), [...(penDays.get(d.get("uid")) || []), d.get("day")]);
    }
    for (const p of players) {
      if (!isMiss(group, p, today)) continue;
      const others = players.filter((o) => o.uid !== p.uid);
      const open = openTasks(p, today);
      const rival = others[0];
      const rivalLine = others.length === 1 ? ` ${rival.name} is at ${doneCount(rival, today)}/${rival.tasks.length}.` : "";
      const lastMiss = isDare(group) && missesInARow(penDays.get(p.uid) || [], addDays(today, -1)) >= 2;
      const stake = inr(group.stake) + (others.length > 1 ? " each" : "");
      const cost = lastMiss ? "you're out" : isDare(group) ? `it's pay ${stake} or a dare` : `you owe ${inr(group.stake * others.length)}`;
      const todo = group.rule === "none" ? "You haven't done a single task today. Do one" : `${open.length} left: ${open.map((t) => t.text).join(", ")}. Finish`;
      const body = `${todo} before midnight or ${cost}.${rivalLine}`;
      const title = lastMiss ? "⏰ Miss today and you're out" : "⏰ Clock's ticking";
      sent += await pushTo([p.uid], { title, body: body.slice(0, 220), kind: "reminder" });
    }
  }
  return NextResponse.json({ ok: true, today, sent });
}
