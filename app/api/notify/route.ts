// Called by the app right after it posts something to the activity feed.
// Verifies who's asking, then pushes the event to the other people in the challenge.
import { NextResponse } from "next/server";
import { adminAuth, adminDb, pushTo } from "@/lib/admin";
import { feedPush, type FeedItem } from "@/lib/feed";

export const runtime = "nodejs";

const ID = /^[A-Za-z0-9_-]{1,64}$/;

export async function POST(req: Request) {
  const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
  let uid: string;
  try {
    uid = (await adminAuth().verifyIdToken(token)).uid;
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { gid, feedId } = (await req.json().catch(() => ({}))) as { gid?: string; feedId?: string };
  if (!gid || !feedId || !ID.test(gid) || !ID.test(feedId)) return NextResponse.json({ error: "bad request" }, { status: 400 });

  const db = adminDb();
  const [g, f] = await Promise.all([db.doc(`groups/${gid}`).get(), db.doc(`groups/${gid}/feed/${feedId}`).get()]);
  if (!g.exists || !f.exists) return NextResponse.json({ error: "not found" }, { status: 404 });

  const members = (g.get("members") as string[]) || [];
  const item = f.data() as FeedItem & { pushed?: boolean };
  if (!members.includes(uid) || item.by !== uid) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (item.pushed) return NextResponse.json({ ok: true, sent: 0 }); // already sent once
  await f.ref.update({ pushed: true });

  const players = await db.collection(`groups/${gid}/players`).get();
  const names = new Map(players.docs.map((d) => [d.id, (d.get("name") as string) || "Your friend"]));
  const msg = feedPush(item, (id) => names.get(id) || "Your friend", Number(g.get("stake")) || 0);
  if (!msg) return NextResponse.json({ ok: true, sent: 0 });

  const targets = item.kind === "nudge" ? members.filter((m) => m === item.to && m !== uid) : members.filter((m) => m !== uid);
  const sent = await pushTo(targets, { ...msg, kind: item.kind });
  return NextResponse.json({ ok: true, sent });
}
