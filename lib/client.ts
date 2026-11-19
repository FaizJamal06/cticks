"use client";
import { addDoc, arrayUnion, collection, doc, setDoc } from "firebase/firestore";
import { getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { app, auth, db, VAPID_KEY } from "./firebase";
import type { FeedItem } from "./feed";

// ---------- toasts ----------
export function toast(msg: string) {
  window.dispatchEvent(new CustomEvent("payup-toast", { detail: msg }));
}

// ---------- local storage (never required) ----------
export const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch {} },
};

// ---------- feed + push ----------
/** Adds an activity item and asks the server to push it to the others. */
export async function postFeed(gid: string, item: Omit<FeedItem, "by" | "ts">) {
  const user = auth?.currentUser;
  if (!db || !user) return;
  const ref = await addDoc(collection(db, "groups", gid, "feed"), { ...item, by: user.uid, ts: Date.now() });
  try {
    const token = await user.getIdToken();
    await fetch("/api/notify", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ gid, feedId: ref.id }),
    });
  } catch {
    /* the in-app feed still has it */
  }
}

// ---------- device / notification support ----------
export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

export type PushState = "loading" | "needs-install" | "unsupported" | "default" | "granted" | "denied";

export async function pushState(): Promise<PushState> {
  if (isIOS() && !isStandalone()) return "needs-install";
  if (!("Notification" in window) || !("serviceWorker" in navigator) || !(await isSupported().catch(() => false)))
    return "unsupported";
  return Notification.permission as PushState;
}

async function swRegistration() {
  return navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
}

/** Saves this device's push token so the server can reach it. Safe to call on every launch. */
export async function saveToken(uid: string) {
  if (!app || !db || !VAPID_KEY) return false;
  const reg = await swRegistration();
  await navigator.serviceWorker.ready;
  const token = await getToken(getMessaging(app), { vapidKey: VAPID_KEY, serviceWorkerRegistration: reg });
  if (!token) return false;
  if (store.get("payup.token") !== token) {
    await setDoc(doc(db, "users", uid), { fcmTokens: arrayUnion(token) }, { merge: true });
    store.set("payup.token", token);
  }
  return true;
}

/** Must be called straight from a tap (iOS requires it). */
export async function enablePush(uid: string): Promise<PushState> {
  const perm = await Notification.requestPermission(); // ask first, while we still have the tap
  if (perm !== "granted") return perm as PushState;
  await saveToken(uid);
  return "granted";
}

/** While the app is open, server reminders arrive here instead of the system tray. */
export async function listenForeground() {
  if (!app || !(await isSupported().catch(() => false))) return () => {};
  return onMessage(getMessaging(app), (p) => {
    const kind = p.data?.kind;
    if (kind === "reminder" || kind === "results") toast(`${p.notification?.title ?? ""} — ${p.notification?.body ?? ""}`);
  });
}

// ---------- misc ----------
const ALPHA = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const newCode = () => Array.from(crypto.getRandomValues(new Uint8Array(6)), (b) => ALPHA[b % ALPHA.length]).join("");
export const newId = () => Math.random().toString(36).slice(2, 9);

export function authError(e: unknown): string {
  const code = (e as { code?: string })?.code || "";
  const map: Record<string, string> = {
    "auth/invalid-credential": "Wrong email or password.",
    "auth/invalid-email": "That email doesn't look right.",
    "auth/email-already-in-use": "There's already an account with that email. Log in instead.",
    "auth/weak-password": "Password needs at least 6 characters.",
    "auth/too-many-requests": "Too many tries. Wait a minute and try again.",
    "auth/network-request-failed": "No internet connection.",
    "permission-denied": "Not allowed. Ticks only count for today, and only you can tick your own tasks.",
  };
  return map[code] || (e as Error)?.message || "Something went wrong.";
}
