import "server-only";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";

function adminApp() {
  if (getApps().length) return getApps()[0];
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT;
  if (!raw) throw new Error("FIREBASE_SERVICE_ACCOUNT is not set");
  const sa = JSON.parse(raw.trim().startsWith("{") ? raw : Buffer.from(raw, "base64").toString("utf8"));
  return initializeApp({ credential: cert(sa) });
}

export const adminAuth = () => getAuth(adminApp());
export const adminDb = () => getFirestore(adminApp());

/** Push one notification to everyone in `uids`; drops tokens that FCM says are dead. */
export async function pushTo(uids: string[], msg: { title: string; body: string; kind?: string }) {
  if (!uids.length) return 0;
  const db = adminDb();
  const users = await db.getAll(...uids.map((u) => db.doc(`users/${u}`)));
  const tokenOwner = new Map<string, string>();
  for (const u of users) for (const t of (u.get("fcmTokens") as string[] | undefined) || []) tokenOwner.set(t, u.id);
  const tokens = [...tokenOwner.keys()];
  if (!tokens.length) return 0;

  const res = await getMessaging(adminApp()).sendEachForMulticast({
    tokens,
    notification: { title: msg.title, body: msg.body },
    data: { kind: msg.kind || "event" },
    webpush: {
      notification: { icon: "/icon-192.png", badge: "/badge-72.png" },
      fcmOptions: { link: "/" },
    },
  });

  const dead: string[] = [];
  res.responses.forEach((r, i) => {
    const code = r.error?.code || "";
    if (code.includes("registration-token-not-registered") || code.includes("invalid-registration-token") || code.includes("invalid-argument"))
      dead.push(tokens[i]);
  });
  await Promise.all(
    dead.map((t) => db.doc(`users/${tokenOwner.get(t)}`).update({ fcmTokens: FieldValue.arrayRemove(t) }).catch(() => {}))
  );
  return res.successCount;
}
