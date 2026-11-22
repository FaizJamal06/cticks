// The group's dare deck: add a custom dare (blocklist check, then it waits for a second member's OK),
// approve one, or report one (it leaves the deck until someone else re-approves it). Members only.
import { NextResponse } from "next/server";
import { adminDb } from "@/lib/admin";
import { callerUid, feed, names, send } from "@/lib/penalty-server";
import { checkDare, isStarter, STARTER, type DareDoc } from "@/lib/dares";

export const runtime = "nodejs";

const ID = /^[A-Za-z0-9_-]{1,40}$/;
const err = (error: string, status: number) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const uid = await callerUid(req);
  if (!uid) return err("unauthorized", 401);
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const gid = String(b.gid || ""), action = String(b.action || ""), id = String(b.id || "");
  if (!ID.test(gid) || !["add", "approve", "report"].includes(action) || (action !== "add" && !ID.test(id))) return err("bad request", 400);

  const db = adminDb();
  const gRef = db.doc(`groups/${gid}`);
  const g = await gRef.get();
  const members = (g.get("members") as string[] | undefined) || [];
  if (!g.exists || !members.includes(uid)) return err("You're not in this challenge.", 403);
  const now = Date.now();
  const name = await names(gid);

  if (action === "add") {
    const c = checkDare(String(b.text ?? ""));
    if (!c.ok) return err(c.error, 400);
    const doc: DareDoc = { text: c.text, by: uid, createdAt: now, approvedBy: null, active: false, reported: null };
    await gRef.collection("dares").add(doc);
    await feed(gid, [{ by: uid, kind: "dare", ev: "added", dare: c.text, ts: now }]);
    await send([{ to: members.filter((m) => m !== uid), kind: "dare", title: "🃏 New dare needs an OK", body: `${name(uid)} added: ${c.text}` }]);
    return NextResponse.json({ ok: true });
  }

  const starter = STARTER.find((s) => s.id === id);
  const ref = gRef.collection("dares").doc(id);
  const reason = String(b.reason ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").trim().slice(0, 80) || undefined;
  const res = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const d = snap.exists ? (snap.data() as DareDoc) : null;
    if (!d && !(isStarter(id) && starter)) return { error: "That dare doesn't exist.", status: 404 };
    const text = d?.text || starter!.text;
    if (action === "report") {
      if (d?.reported) return { error: "Someone already reported that one.", status: 409 };
      const base: DareDoc = d || { text, by: "cticks", createdAt: now, approvedBy: "cticks", active: true, reported: null };
      tx.set(ref, { ...base, active: false, reported: { by: uid, at: now, ...(reason ? { reason } : {}) } });
      return { text };
    }
    // approve
    if (!d || (d.active && !d.reported)) return { error: "That dare is already in the deck.", status: 409 };
    if (d.reported) {
      if (d.reported.by === uid) return { error: "Someone other than the person who reported it has to OK it.", status: 403 };
      if (d.by === uid) return { error: "Someone else has to OK your dare.", status: 403 };
    } else if (d.by === uid) return { error: "Someone else has to OK your dare.", status: 403 };
    tx.set(ref, { ...d, active: true, reported: null, approvedBy: uid });
    return { text };
  });
  if ("error" in res) return err(res.error as string, res.status as number);
  await feed(gid, [{ by: uid, kind: "dare", ev: action === "report" ? "reported" : "approved", dare: res.text, ts: now }]);
  return NextResponse.json({ ok: true });
}
