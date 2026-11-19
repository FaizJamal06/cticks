"use client";
import { useState } from "react";
import {
  createUserWithEmailAndPassword, sendPasswordResetEmail, signInWithEmailAndPassword, updateProfile,
} from "firebase/auth";
import { doc, setDoc } from "firebase/firestore";
import { auth, db } from "@/lib/firebase";
import { authError, toast } from "@/lib/client";

export default function Auth() {
  const [mode, setMode] = useState<"signup" | "login">("signup");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [pw, setPw] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!auth || !db) return;
    setErr(""); setBusy(true);
    try {
      if (mode === "signup") {
        if (!name.trim()) throw new Error("Add your name so your friend knows it's you.");
        const cred = await createUserWithEmailAndPassword(auth, email.trim(), pw);
        await updateProfile(cred.user, { displayName: name.trim() });
        await setDoc(doc(db, "users", cred.user.uid), { name: name.trim() }, { merge: true });
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), pw);
      }
    } catch (e) {
      setErr(authError(e));
    } finally {
      setBusy(false);
    }
  }

  async function reset() {
    if (!auth) return;
    if (!email.trim()) return setErr("Type your email above first.");
    try { await sendPasswordResetEmail(auth, email.trim()); toast("Reset link sent. Check your inbox."); }
    catch (e) { setErr(authError(e)); }
  }

  return (
    <div className="wrap hero">
      <h1 className="logo">PAY<br />UP<i>.</i></h1>
      <p>Pick your daily tasks. Tick them off. Miss a day and you pay your friend. Simple.</p>

      <div className="tabs" role="tablist">
        <button className={mode === "signup" ? "on" : ""} onClick={() => setMode("signup")}>Sign up</button>
        <button className={mode === "login" ? "on" : ""} onClick={() => setMode("login")}>Log in</button>
      </div>

      <form onSubmit={submit}>
        {mode === "signup" && (
          <label className="f">YOUR NAME
            <input className="input" value={name} onChange={(e) => setName(e.target.value)} maxLength={24} autoComplete="given-name" />
          </label>
        )}
        <label className="f">EMAIL
          <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" required />
        </label>
        <label className="f">PASSWORD
          <input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} minLength={6}
            autoComplete={mode === "signup" ? "new-password" : "current-password"} required />
        </label>
        {err && <div className="err">{err}</div>}
        <button className="btn" style={{ marginTop: 18 }} disabled={busy}>{busy ? "…" : mode === "signup" ? "Create account" : "Log in"}</button>
        {mode === "login" && <button type="button" className="btn ghost" style={{ marginTop: 8 }} onClick={reset}>Forgot password</button>}
      </form>
    </div>
  );
}
