"use client";
import { useState } from "react";
import { deleteField, doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { addDays, dayKey, type Group, type Rule, type Task } from "@/lib/logic";
import { authError, logOut, postFeed, toast } from "@/lib/client";
import TaskEditor, { cleanTasks, RulePicker } from "./TaskEditor";

function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="modal" onClick={onClose}>
      <div className="sheet" onClick={(e) => e.stopPropagation()} role="dialog" aria-label={title}>
        <div className="top">
          <h3>{title}</h3>
          <button className="iconbtn" aria-label="Close" onClick={onClose}>✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}

export function EditTasksSheet({ gid, uid, tasks, onClose }: { gid: string; uid: string; tasks: Task[]; onClose: () => void }) {
  const [list, setList] = useState<Task[]>(tasks.map((t) => ({ ...t })));
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!db) return;
    const clean = cleanTasks(list);
    if (!clean.length) return toast("Keep at least one task.");
    setBusy(true);
    try {
      await updateDoc(doc(db, "groups", gid, "players", uid), { tasks: clean });
      await postFeed(gid, { kind: "tasks", total: clean.length });
      onClose();
    } catch (e) { toast(authError(e)); } finally { setBusy(false); }
  }
  return (
    <Sheet title="Your tasks" onClose={onClose}>
      <div className="note">Your friend gets told when you change these. Tasks lock once you tick something on day 1.</div>
      <TaskEditor tasks={list} onChange={setList} />
      <button className="btn" style={{ marginTop: 16 }} disabled={busy} onClick={save}>Save tasks</button>
    </Sheet>
  );
}

export function SettingsSheet({ group, gid, uid, phase, onClose }: {
  group: Group; gid: string; uid: string; phase: "upcoming" | "active" | "over"; onClose: () => void;
}) {
  const [stake, setStake] = useState(String(group.stake));
  const [rule, setRule] = useState<Rule>(group.rule);
  const [days, setDays] = useState(String(group.days));
  const [when, setWhen] = useState<"today" | "tomorrow">("tomorrow");
  const [confirmRound, setConfirmRound] = useState(false);
  const [busy, setBusy] = useState(false);

  async function saveRules() {
    if (!db) return;
    const amount = Math.round(Number(stake));
    if (!(amount > 0)) return toast("Stake has to be more than zero.");
    if (amount === group.stake && rule === group.rule) return onClose();
    setBusy(true);
    try {
      await updateDoc(doc(db, "groups", gid), { stake: amount, rule });
      await postFeed(gid, { kind: "settings", stake: amount, rule });
      toast("Rules updated. Everyone got notified.");
      onClose();
    } catch (e) { toast(authError(e)); } finally { setBusy(false); }
  }

  async function newRound() {
    if (!db) return;
    setBusy(true);
    try {
      const start = when === "today" ? dayKey() : addDays(dayKey(), 1);
      const round = group.round + 1;
      await updateDoc(doc(db, "groups", gid), { start, days: Number(days), round });
      await postFeed(gid, { kind: "round", round, start, days: Number(days) });
      toast(`Round ${round} is set.`);
      onClose();
    } catch (e) { toast(authError(e)); } finally { setBusy(false); }
  }

  return (
    <Sheet title="Settings" onClose={onClose}>
      <label className="f">STAKE PER MISSED DAY (₹)
        <input className="input" inputMode="numeric" value={stake} onChange={(e) => setStake(e.target.value.replace(/\D/g, ""))} />
      </label>
      <label className="f">WHAT COUNTS AS A MISSED DAY</label>
      <RulePicker value={rule} onChange={setRule} />
      {phase === "active" && <div className="note">Heads up: changing these mid-round re-scores the whole round, including past days.</div>}
      <button className="btn" style={{ marginTop: 14 }} disabled={busy} onClick={saveRules}>Save rules</button>

      <div className="card" style={{ marginTop: 22 }}>
        <h2>{phase === "over" ? "Next round" : "Restart with a new round"}</h2>
        <div className="row2">
          <label className="f" style={{ marginTop: 0 }}>LENGTH
            <select className="input" value={days} onChange={(e) => setDays(e.target.value)}>
              {[7, 14, 21, 30].map((n) => <option key={n} value={n}>{n} days</option>)}
            </select>
          </label>
          <label className="f" style={{ marginTop: 0 }}>STARTS
            <select className="input" value={when} onChange={(e) => setWhen(e.target.value as "today" | "tomorrow")}>
              <option value="today">Today</option>
              <option value="tomorrow">Tomorrow</option>
            </select>
          </label>
        </div>
        {phase !== "over" && !confirmRound ? (
          <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setConfirmRound(true)}>Start a new round…</button>
        ) : (
          <>
            {phase !== "over" && <div className="note">This ends round {group.round} now and wipes its score. Sure?</div>}
            <button className={`btn ${phase !== "over" ? "danger" : ""}`} style={{ marginTop: 12 }} disabled={busy} onClick={newRound}>
              Start round {group.round + 1}
            </button>
          </>
        )}
        <div className="note">Everyone keeps their tasks. You can edit yours until you tick something on day 1.</div>
      </div>

      <div className="row2" style={{ marginTop: 18 }}>
        <button className="btn ghost" onClick={async () => {
          if (!db) return;
          await setDoc(doc(db, "users", uid), { groupId: deleteField() }, { merge: true });
        }}>Switch challenge</button>
        <button className="btn ghost" onClick={logOut}>Log out</button>
      </div>
    </Sheet>
  );
}
