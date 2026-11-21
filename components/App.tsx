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

type Profile = { name?: string; groupId?: string | null };

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
      <InAppBanner />
      {view}
      <Toasts />
    </>
  );
}
