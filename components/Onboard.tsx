"use client";
import { useEffect, useState } from "react";
import type { User } from "firebase/auth";
import { arrayUnion, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addDays, dayKey, inr, prettyDay, ruleLabel, type Group, type Rule } from "@/lib/logic";
import { authError, logOut, newCode, postFeed } from "@/lib/client";
import TaskEditor, { blankTasks, cleanTasks, RulePicker } from "./TaskEditor";

export default function Onboard({ user, name }: { user: User; name: string }) {
  const [mode, setMode] = useState<"create" | "join">("create");
  const [tasks, setTasks] = useState(blankTasks);
  const [stake, setStake] = useState("100");
  const [days, setDays] = useState("7");
  const [startWhen, setStartWhen] = useState<"today" | "tomorrow">("tomorrow");
  const [rule, setRule] = useState<Rule>("all");
  const [code, setCode] = useState("");
  const [found, setFound] = useState<Group | null>(null);
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let c: string | null = null;
    try { c = sessionStorage.getItem("payup.join"); } catch {}
    if (c) { setMode("join"); setCode(c); lookup(c); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function lookup(c = code) {
    if (!db) return;
    setErr(""); setFound(null);
    const clean = c.trim().toUpperCase();
    if (clean.length !== 6) return setErr("Codes are 6 characters.");
    const snap = await getDoc(doc(db, "groups", clean)).catch(() => null);
    if (!snap?.exists()) return setErr("No challenge with that code. Check it with your friend.");
    setFound(snap.data() as Group);
  }

  async function finish(gid: string, list: { id: string; text: string }[]) {
    if (!db) return;
    const pref = doc(db, "groups", gid, "players", user.uid);
    const existing = await getDoc(pref);
    if (!existing.exists()) {
      await setDoc(pref, { uid: user.uid, name, tasks: list, checks: {}, joined: dayKey() });
    }
    await setDoc(doc(db, "users", user.uid), { name, groupId: gid }, { merge: true });
    try { sessionStorage.removeItem("payup.join"); } catch {}
    if (!existing.exists()) await postFeed(gid, { kind: "join", total: list.length });
  }

  async function create() {
    if (!db) return;
    const list = cleanTasks(tasks);
    const amount = Math.round(Number(stake));
    if (!list.length) return setErr("Add at least one task.");
    if (!(amount > 0)) return setErr("Stake has to be more than zero.");
    setErr(""); setBusy(true);
    try {
      const today = dayKey();
      let gid = "";
      for (let attempt = 0; attempt < 4 && !gid; attempt++) {
        const c = newCode();
        try {
          await setDoc(doc(db, "groups", c), {
            code: c, members: [user.uid], createdBy: user.uid, createdAt: Date.now(),
            stake: amount, rule, days: Number(days), round: 1,
            start: startWhen === "today" ? today : addDays(today, 1),
          });
          gid = c;
        } catch (e) { if (attempt === 3) throw e; }
      }
      await finish(gid, list);
    } catch (e) { setErr(authError(e)); } finally { setBusy(false); }
  }

  async function join() {
    if (!db || !found) return;
    const list = cleanTasks(tasks);
    if (!list.length) return setErr("Add at least one task.");
    setErr(""); setBusy(true);
    try {
      if (!found.members.includes(user.uid)) {
        if (found.members.length >= 6) throw new Error("That challenge is full (6 people max).");
        await updateDoc(doc(db, "groups", found.code), { members: arrayUnion(user.uid) });
      }
      await finish(found.code, list);
    } catch (e) { setErr(authError(e)); } finally { setBusy(false); }
  }

  return (
    <div className="wrap">
      <div className="top">
        <div>
          <h1 className="logo">PAY UP<i>.</i></h1>
          <div className="sub">hey {name || "there"}, let&apos;s set this up</div>
        </div>
        <button className="iconbtn" aria-label="Log out" onClick={logOut}>⎋</button>
      </div>

      <div className="tabs">
        <button className={mode === "create" ? "on" : ""} onClick={() => { setMode("create"); setErr(""); }}>Start a challenge</button>
        <button className={mode === "join" ? "on" : ""} onClick={() => { setMode("join"); setErr(""); }}>Join with code</button>
      </div>

      {mode === "create" ? (
        <div className="card">
          <h2>The rules</h2>
          <div className="row2">
            <label className="f">STAKE PER MISSED DAY (₹)
              <input className="input" inputMode="numeric" value={stake} onChange={(e) => setStake(e.target.value.replace(/\D/g, ""))} />
            </label>
            <label className="f">ROUND LENGTH
              <select className="input" value={days} onChange={(e) => setDays(e.target.value)}>
                {[7, 14, 21, 30].map((n) => <option key={n} value={n}>{n} days</option>)}
              </select>
            </label>
          </div>
          <label className="f">STARTS</label>
          <div className="tabs" style={{ marginTop: 6 }}>
            <button className={startWhen === "today" ? "on" : ""} onClick={() => setStartWhen("today")}>Today</button>
            <button className={startWhen === "tomorrow" ? "on" : ""} onClick={() => setStartWhen("tomorrow")}>Tomorrow</button>
          </div>
          <label className="f">WHAT COUNTS AS A MISSED DAY</label>
          <RulePicker value={rule} onChange={setRule} />
        </div>
      ) : (
        <div className="card">
          <h2>Invite code</h2>
          <div className="row2">
            <input className="input" style={{ marginTop: 0, fontFamily: "var(--mono)", letterSpacing: "0.2em", textTransform: "uppercase" }}
              value={code} maxLength={6} placeholder="ABC123" onChange={(e) => setCode(e.target.value.toUpperCase())} />
            <button className="btn small" style={{ flex: "none" }} onClick={() => lookup()}>Find</button>
          </div>
          {found && (
            <div className="note" style={{ color: "var(--ink)" }}>
              ✓ Found it. {inr(found.stake)} per missed day · {found.days}-day rounds · round {found.round} starts {prettyDay(found.start)} ·
              a miss = {ruleLabel(found.rule)} · {found.members.length} {found.members.length === 1 ? "person" : "people"} in.
            </div>
          )}
        </div>
      )}

      {(mode === "create" || found) && (
        <div className="card">
          <h2>Your daily tasks</h2>
          <div className="note" style={{ marginTop: 0 }}>Things you&apos;ll do every single day this round. Keep them specific.</div>
          <TaskEditor tasks={tasks} onChange={setTasks} />
        </div>
      )}

      {err && <div className="err">{err}</div>}
      {(mode === "create" || found) && (
        <button className="btn" style={{ marginTop: 16 }} disabled={busy} onClick={mode === "create" ? create : join}>
          {busy ? "…" : mode === "create" ? "Lock it in" : "Join the challenge"}
        </button>
      )}
    </div>
  );
}
