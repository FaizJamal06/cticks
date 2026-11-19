"use client";
import { useEffect, useState } from "react";
import {
  browser, enablePush, inAppBrowser, isAndroid, isIOS, isStandalone, pushState, saveToken, store, toast, type PushState,
} from "@/lib/client";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };
type Browser = ReturnType<typeof browser>;

// "Add to Home Screen" lives in a different menu in each iPhone browser (all of them can since iOS 16.4).
const IOS_STEPS: Record<Browser, React.ReactNode> = {
  safari: <>In Safari tap <b>Share</b> (the square with an arrow) → <b>Add to Home Screen</b>, then open Pay Up from the new icon.
    Opened this from WhatsApp or another app? Open it in Safari first (the compass icon).</>,
  chrome: <>In Chrome tap <b>Share</b> (the square with an arrow, by the address bar) → <b>Add to Home Screen</b>, then open Pay Up from the new icon.</>,
  edge: <>In Edge tap <b>⋯</b> → <b>Share</b> → <b>Add to Home Screen</b>, then open Pay Up from the new icon.</>,
  firefox: <>In Firefox tap <b>☰</b> → <b>Share</b> → <b>Add to Home Screen</b>, then open Pay Up from the new icon.</>,
  samsung: null,
  other: <>Open your browser&apos;s <b>Share</b> menu → <b>Add to Home Screen</b>, then open Pay Up from the new icon.</>,
};
// Android browsers that never fire the install prompt, so we say where their menu item is.
const ANDROID_STEPS: Partial<Record<Browser, React.ReactNode>> = {
  firefox: <>tap <b>⋮</b> → <b>Install</b> (or <b>Add to Home screen</b>).</>,
  samsung: <>tap <b>☰</b> → <b>Add page to</b> → <b>Home screen</b>.</>,
};

/** Gets each device set up: installed where that matters, with notifications on. */
export default function Banners({ uid }: { uid: string }) {
  const [push, setPush] = useState<PushState>("loading");
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [hidden, setHidden] = useState(false);
  const [b, setB] = useState<Browser>("other");
  const [androidManual, setAndroidManual] = useState(false);

  useEffect(() => {
    pushState().then((s) => {
      setPush(s);
      if (s === "granted") saveToken(uid).catch(() => {}); // refresh this device's token quietly
    });
    setB(browser());
    setAndroidManual(isAndroid() && !isStandalone());
    setHidden(store.get("payup.hideInstall") === "1");
    const onPrompt = (e: Event) => { e.preventDefault(); setInstall(e as InstallEvent); };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, [uid]);

  async function turnOn() {
    try {
      const s = await enablePush(uid);
      setPush(s);
      if (s === "granted") toast("Notifications on. You'll hear when your friend moves.");
    } catch (e) {
      toast((e as Error).message || "Couldn't turn on notifications.");
    }
  }
  const notNow = () => { store.set("payup.hideInstall", "1"); setHidden(true); };

  return (
    <>
      {push === "old-ios" && (
        <div className="banner">
          <b>Notifications need iOS 16.4 or newer.</b> This iPhone is on an older version, so Pay Up can&apos;t send you pushes.
          Update in Settings → General → Software Update to get them. Everything else works without them.
        </div>
      )}
      {push === "needs-install" && (
        <div className="banner">
          <b>iPhone: add Pay Up to your home screen first.</b> Apple only allows notifications for apps on the home screen. {IOS_STEPS[b] ?? IOS_STEPS.other}
        </div>
      )}
      {push === "default" && (
        <div className="banner">
          <b>Turn on notifications</b> so you know the second your friend ticks something, plus a 9pm warning if you&apos;re about to pay up.
          <button className="btn" onClick={turnOn}>Turn on notifications</button>
        </div>
      )}
      {push === "denied" && (
        <div className="banner">
          <b>Notifications are blocked.</b> {isIOS()
            ? "Open iPhone Settings → Notifications → Pay Up and allow them."
            : "Tap the lock/info icon by the address bar (or your phone's app settings for Pay Up) and allow notifications."}
        </div>
      )}
      {push === "unsupported" && (
        <div className="banner">
          <b>This browser can&apos;t do push notifications.</b> Open Pay Up in Chrome, Edge, Firefox or Safari to get them. Everything else still works here.
        </div>
      )}
      {install && !hidden && (
        <div className="banner">
          <b>Install Pay Up</b> to get an app icon and open it full screen.
          <div className="row2">
            <button className="btn" onClick={async () => { await install.prompt(); setInstall(null); }}>Install</button>
            <button className="btn ghost" onClick={notNow}>Not now</button>
          </div>
        </div>
      )}
      {!install && !hidden && androidManual && ANDROID_STEPS[b] && (
        <div className="banner">
          <b>Install Pay Up</b> for an app icon: {ANDROID_STEPS[b]}
          <button className="btn ghost" onClick={notNow}>Not now</button>
        </div>
      )}
    </>
  );
}

/** Shown on every screen when the link was opened inside WhatsApp/Instagram/etc. Keeps ?join=CODE in the link. */
export function InAppBanner() {
  const [link, setLink] = useState<string | null>(null);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (!inAppBrowser()) return;
    let code = new URLSearchParams(location.search).get("join");
    try { code ||= sessionStorage.getItem("payup.join"); } catch {}
    setIos(isIOS());
    setLink(`${location.origin}/${code ? `?join=${encodeURIComponent(code.toUpperCase())}` : ""}`);
  }, []);

  if (!link) return null;
  const app = ios ? "Safari" : "Chrome";
  async function copy() {
    try { await navigator.clipboard.writeText(link!); toast(`Link copied. Paste it into ${app}.`); }
    catch { toast("Couldn't copy. Press and hold the link to copy it."); }
  }
  return (
    <div className="wrap" style={{ paddingBottom: 0 }}>
      <div className="banner" style={{ marginTop: 0 }}>
        <b>Open this in {app}.</b> This app&apos;s built-in browser can&apos;t install Pay Up or send notifications.{" "}
        {ios ? "Tap ⋯ or the compass icon and pick Open in Safari" : "Tap ⋮ and pick Open in Chrome"}, or copy the link and paste it into {app}.
        <div className="note" style={{ color: "var(--ink)", userSelect: "all", overflowWrap: "anywhere" }}>{link}</div>
        <button className="btn" onClick={copy}>Copy link</button>
      </div>
    </div>
  );
}
