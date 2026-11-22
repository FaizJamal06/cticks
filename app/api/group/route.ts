// Round changes that need the server: starting the next round (settles the outgoing round's last penalties and
// applies queued settings) and rejoining after a kick (resets `joined`, which the rules never let a client do).
import { NextResponse } from "next/server";
import { callerUid, rejoin, startRound } from "@/lib/penalty-server";

export const runtime = "nodejs";

const ID = /^[A-Z0-9]{6}$/;

export async function POST(req: Request) {
  const uid = await callerUid(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const gid = String(b.gid || ""), action = String(b.action || "");
  if (!ID.test(gid)) return NextResponse.json({ error: "bad request" }, { status: 400 });
  const r = action === "start"
    ? await startRound(gid, uid, Number(b.days), String(b.when) as "today" | "tomorrow")
    : action === "rejoin" ? await rejoin(gid, uid)
    : { ok: false as const, code: 400, error: "bad request" };
  return r.ok ? NextResponse.json(r) : NextResponse.json({ error: r.error }, { status: r.code });
}
