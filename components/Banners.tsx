"use client";
import { useEffect, useState } from "react";
import { enablePush, isIOS, pushState, saveToken, store, toast, type PushState } from "@/lib/client";

type InstallEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: string }> };

/** Gets each phone set up: installed to the home screen, with notifications on. */
export default function Banners({ uid }: { uid: string }) {
  const [push, setPush] = useState<PushState>("loading");
  const [install, setInstall] = useState<InstallEvent | null>(null);
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    pushState().then((s) => {
      setPush(s);
      if (s === "granted") saveToken(uid).catch(() => {}); // refresh this device's token quietly
    });
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

  return (
    <>
      {push === "needs-install" && (
        <div className="banner">
          <b>iPhone: add Pay Up to your home screen first.</b> Apple only allows notifications for apps on the home screen.
          In Safari tap <b>Share</b> (the square with an arrow) → <b>Add to Home Screen</b>, then open Pay Up from the new icon.
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
        <div className="banner"><b>This browser can&apos;t do push notifications.</b> Open Pay Up in Chrome (Android) or Safari (iPhone).</div>
      )}
      {install && !hidden && (
        <div className="banner">
          <b>Install Pay Up</b> to get an app icon and open it full screen.
          <div className="row2">
            <button className="btn" onClick={async () => { await install.prompt(); setInstall(null); }}>Install</button>
            <button className="btn ghost" onClick={() => { store.set("payup.hideInstall", "1"); setHidden(true); }}>Not now</button>
          </div>
        </div>
      )}
    </>
  );
}
