"use client";
import { useEffect, useState } from "react";
import { onAuthStateChanged, type User } from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import { auth, configured, db } from "@/lib/firebase";
import Auth from "./Auth";
import Onboard from "./Onboard";
import Dashboard from "./Dashboard";
import Toasts from "./Toasts";
import { InAppBanner } from "./Banners";
import { APP_VERSION } from "@/lib/version";

type Profile = { name?: string; groupId?: string | null };

/** "cTicks was updated" bar: shown when the server expects a newer app than this open copy (checked on launch,
 *  whenever the app comes back to the foreground, every 30 min, and when an API route answers 426). */
function UpdateBar() {
  const [stale, setStale] = useState(false);
  useEffect(() => {
    const check = () =>
      fetch("/api/version", { cache: "no-store" }).then((r) => r.json())
        .then((d) => { if (Number(d.version) > APP_VERSION) setStale(true); }).catch(() => {});
    const onVisible = () => { if (document.visibilityState === "visible") check(); };
    const onStale = () => setStale(true);
    check();
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("payup-stale", onStale);
    const t = setInterval(check, 30 * 60_000);
    return () => { document.removeEventListener("visibilitychange", onVisible); window.removeEventListener("payup-stale", onStale); clearInterval(t); };
  }, []);
  if (!stale) return null;
  return (
    <div className="update-bar" role="alert">
      <span><b>cTicks was updated.</b> Reload to keep going.</span>
      <button className="btn small" onClick={() => location.reload()}>Reload</button>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState<User | null | undefined>(undefined);
  const [profile, setProfile] = useState<Profile | undefined>(undefined);

  useEffect(() => {
    // Registering the worker early also makes the app installable on Android.
    navigator.serviceWorker?.register("/firebase-messaging-sw.js", { scope: "/" }).catch(() => {});
    // Remember an invite code from a shared link until the person has signed up.
    const code = new URLSearchParams(location.search).get("join");
    if (code) try { sessionStorage.setItem("payup.join", code.toUpperCase()); } catch {}
    if (!auth) return;
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      // Lets the landing page at "/" send signed-in people straight here before it paints.
      try { if (u) localStorage.setItem("payup.auth", "1"); else localStorage.removeItem("payup.auth"); } catch {}
    });
  }, []);

  useEffect(() => {
    if (!user || !db) { setProfile(undefined); return; }
    return onSnapshot(doc(db, "users", user.uid), (s) => setProfile((s.data() as Profile) || {}), () => setProfile({}));
  }, [user]);

  let view: React.ReactNode;
  if (!configured) view = <div className="wrap center">Firebase isn't configured yet. Add the env vars from .env.example.</div>;
  else if (user === undefined || (user && profile === undefined)) view = <div className="wrap center">loading…</div>;
  else if (!user) view = <Auth />;
  else if (!profile?.groupId) view = <Onboard user={user} name={profile?.name || user.displayName || ""} />;
  else view = <Dashboard user={user} gid={profile.groupId} />;

  return (
    <>
      <UpdateBar />
      <InAppBanner />
      {view}
      <Toasts />
    </>
  );
}
