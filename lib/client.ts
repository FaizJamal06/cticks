"use client";
import { signOut } from "firebase/auth";
import { addDoc, arrayRemove, arrayUnion, collection, doc, setDoc, updateDoc } from "firebase/firestore";
import { deleteToken, getMessaging, getToken, isSupported, onMessage } from "firebase/messaging";
import { app, auth, db, VAPID_KEY } from "./firebase";
import type { FeedItem } from "./feed";
import type { Mood } from "./tik";

// ---------- toasts ----------
/** Shows an in-app toast. `mood` adds a small Tik where it fits. */
export function toast(msg: string, mood?: Mood) {
  window.dispatchEvent(new CustomEvent("payup-toast", { detail: { msg, mood } }));
}

// ---------- local storage (never required) ----------
export const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string) { try { localStorage.setItem(k, v); } catch {} },
  del(k: string) { try { localStorage.removeItem(k); } catch {} },
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

/** POSTs to one of our API routes with the Firebase ID token. Shows the server's error as a toast and returns null. */
export async function api<T = Record<string, unknown>>(path: string, body: Record<string, unknown>): Promise<T | null> {
  const user = auth?.currentUser;
  if (!user) return null;
  try {
    const res = await fetch(path, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${await user.getIdToken()}` },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) { toast(data.error || "Something went wrong. Try again."); return null; }
    return data as T;
  } catch {
    toast("No internet connection.");
    return null;
  }
}

// ---------- device / notification support ----------
export const isIOS = () =>
  /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
export const isStandalone = () =>
  window.matchMedia("(display-mode: standalone)").matches || (navigator as unknown as { standalone?: boolean }).standalone === true;

export const isAndroid = () => /Android/i.test(navigator.userAgent);
/** 1604 for iOS 16.4. 9999 when unknown (an iPad in desktop mode reports macOS, and those are new enough). */
export const iosVersion = () => {
  const m = navigator.userAgent.match(/OS (\d+)_(\d+)/);
  return m ? Number(m[1]) * 100 + Number(m[2]) : 9999;
};
/** Which browser, for "add to home screen" steps. */
export function browser(): "chrome" | "edge" | "firefox" | "samsung" | "safari" | "other" {
  const ua = navigator.userAgent;
  if (/EdgiOS|EdgA\/|Edg\//.test(ua)) return "edge";
  if (/FxiOS|Firefox\//.test(ua)) return "firefox";
  if (/SamsungBrowser/.test(ua)) return "samsung";
  if (/CriOS|Chrome\//.test(ua)) return "chrome";
  if (/Safari\//.test(ua)) return "safari";
  return "other";
}
/** Opened inside WhatsApp / Instagram / Facebook / Telegram / LinkedIn / Snapchat etc.: no install, no push there. */
export const inAppBrowser = () =>
  !isStandalone() &&
  (/FBAN|FBAV|FB_IAB|FBIOS|Instagram|WhatsApp|Telegram|LinkedInApp|Snapchat|Line\/|MicroMessenger|musical_ly|TikTok|Twitter|; wv\)/i.test(navigator.userAgent) ||
    // iOS app webviews drop the "Safari/" token that Safari, Chrome, Edge and Firefox on iPhone all send.
    (isIOS() && !/Safari\//.test(navigator.userAgent)));

export type PushState = "loading" | "old-ios" | "needs-install" | "unsupported" | "default" | "granted" | "denied";

export async function pushState(): Promise<PushState> {
  if (isIOS() && iosVersion() < 1604) return "old-ios"; // web push arrived in iOS 16.4
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

/** This device stops getting pushes for `uid`: token off the user doc, then revoked at FCM. */
async function forgetDevice(uid: string) {
  const drop = [store.get("payup.token")];
  const canPush = app && VAPID_KEY && "Notification" in window && Notification.permission === "granted" && (await isSupported().catch(() => false));
  const m = canPush ? getMessaging(app!) : null;
  // getToken with our worker first: it gives this device's current token, and without it deleteToken()
  // registers Firebase's default worker and revokes the wrong (empty) registration.
  const current = m ? await getToken(m, { vapidKey: VAPID_KEY, serviceWorkerRegistration: await swRegistration() }).catch(() => null) : null;
  drop.push(current);
  const tokens = [...new Set(drop.filter(Boolean) as string[])];
  if (db && tokens.length) await updateDoc(doc(db, "users", uid), { fcmTokens: arrayRemove(...tokens) });
  if (m && current) await deleteToken(m);
}

/** Log out. Switching challenge doesn't call this: you're still logged in, so pushes keep coming. */
export async function logOut() {
  const user = auth?.currentUser;
  // ponytail: capped at 4s so a dead network can't block logout. A token that slips through gets pruned by pushTo() once FCM rejects it.
  if (user) await Promise.race([forgetDevice(user.uid), new Promise((r) => setTimeout(r, 4000))]).catch(() => {});
  store.del("payup.token");
  if (auth) await signOut(auth);
}

/** While the app is open, server reminders arrive here instead of the system tray. */
export async function listenForeground() {
  if (!app || !(await isSupported().catch(() => false))) return () => {};
  return onMessage(getMessaging(app), (p) => {
    const kind = p.data?.kind;
    if (kind === "reminder" || kind === "results")
      toast(`${p.notification?.title ?? ""}: ${p.notification?.body ?? ""}`, kind === "reminder" ? "ticking" : "collector");
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
