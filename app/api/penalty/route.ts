// Every Pay or Dare action on a penalty: the player (pay, dare, reroll, paid, done, again), a voter (vote),
// or a payee (got, notgot). Verifies the Firebase ID token; the reducer in lib/penalty.ts decides what's allowed.
import { NextResponse } from "next/server";
import { act, callerUid, staleApp } from "@/lib/penalty-server";
import { UPDATE_MSG } from "@/lib/version";
import type { Event } from "@/lib/penalty";

export const runtime = "nodejs";

const ID = /^[A-Za-z0-9_-]{1,80}$/;
const ACTIONS = ["pay", "dare", "reroll", "paid", "done", "again", "vote", "got", "notgot"] as const;

export async function POST(req: Request) {
  if (staleApp(req)) return NextResponse.json({ error: UPDATE_MSG }, { status: 426 });
  const uid = await callerUid(req);
  if (!uid) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const gid = String(b.gid || ""), id = String(b.id || ""), action = String(b.action || "");
  if (!ID.test(gid) || !ID.test(id) || !(ACTIONS as readonly string[]).includes(action))
    return NextResponse.json({ error: "bad request" }, { status: 400 });
  const ev: Event = action === "vote"
    ? { type: "vote", vote: String(b.vote || ""), reason: b.reason ? String(b.reason) : null, note: b.note ? String(b.note) : null }
    : { type: action as Exclude<(typeof ACTIONS)[number], "vote"> };
  const r = await act(gid, id, uid, ev);
  return r.ok ? NextResponse.json({ ok: true, penalty: r.penalty }) : NextResponse.json({ error: r.error }, { status: r.code });
}
