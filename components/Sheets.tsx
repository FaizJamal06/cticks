"use client";
import { useState } from "react";
import { deleteField, doc, setDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { inr, isDare, ruleLabel, type Group, type PenaltyMode, type Rule, type Task } from "@/lib/logic";
import { api, authError, logOut, postFeed, toast } from "@/lib/client";
import { DARE_RULES, deckOf, isStarter, MAX_DARE, STARTER, type DareDoc } from "@/lib/dares";
import { modeLabel } from "@/lib/feed";
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

export const MODE_TEXT: Record<PenaltyMode, string> = {
  money: "Every missed day, you owe the stake to each friend. Settle up when the round ends.",
  dare: "Every missed day, pay the stake or take a dare. Your group votes on the proof. Ignore a penalty for 48h, fail a dare twice and don't pay, or miss 3 days in a row, and you're out until the next round.",
};

/** Penalty mode picker (shared by Settings and "Start a challenge"). */
export function ModePicker({ value, onChange }: { value: PenaltyMode; onChange: (m: PenaltyMode) => void }) {
  return (
    <div className="choice">
      {(["dare", "money"] as PenaltyMode[]).map((m) => (
        <button key={m} type="button" className={value === m ? "on" : ""} aria-pressed={value === m} onClick={() => onChange(m)}>
          <b>{modeLabel(m)}</b><span>{MODE_TEXT[m]}</span>
        </button>
      ))}
    </div>
  );
}

export function SettingsSheet({ group, gid, uid, phase, onClose, onDeck }: {
  group: Group; gid: string; uid: string; phase: "upcoming" | "active" | "over"; onClose: () => void; onDeck: () => void;
}) {
  const dare = isDare(group);
  const current: PenaltyMode = dare ? "dare" : "money";
  const queued = group.next?.penaltyMode;
  const [stake, setStake] = useState(String(group.next?.stake ?? group.stake));
  const [rule, setRule] = useState<Rule>(group.next?.rule ?? group.rule);
  const [mode, setMode] = useState<PenaltyMode>(queued || current);
  const [days, setDays] = useState(String(group.days));
  const [when, setWhen] = useState<"today" | "tomorrow">("tomorrow");
  const [confirmRound, setConfirmRound] = useState(false);
  const [busy, setBusy] = useState(false);
  const nextRound = group.round + 1;

  async function saveRules() {
    if (!db) return;
    const amount = Math.round(Number(stake));
    if (!(amount > 0)) return toast("Stake has to be more than zero.");
    if (amount > 100000) return toast("Keep the stake at ₹1,00,000 or less.");
    setBusy(true);
    try {
      if (dare) {
        // Pay or Dare: open penalties have fixed amounts, so changes start with the next round (spec #13)
        if (amount === (group.next?.stake ?? group.stake) && rule === (group.next?.rule ?? group.rule)) return onClose();
        await updateDoc(doc(db, "groups", gid), { "next.stake": amount, "next.rule": rule });
        await postFeed(gid, { kind: "settings", stake: amount, rule, next: true, round: nextRound });
        toast(`Saved. Starts with round ${nextRound}.`);
      } else {
        if (amount === group.stake && rule === group.rule) return onClose();
        await updateDoc(doc(db, "groups", gid), { stake: amount, rule });
        await postFeed(gid, { kind: "settings", stake: amount, rule });
        toast("Rules updated. Everyone got notified.");
      }
      onClose();
    } catch (e) { toast(authError(e)); } finally { setBusy(false); }
  }

  async function saveMode() {
    if (!db || mode === (queued || current)) return;
    setBusy(true);
    try {
      if (mode === current) {
        await updateDoc(doc(db, "groups", gid), { "next.penaltyMode": deleteField() });
        toast(`Staying on ${modeLabel(current)}.`);
      } else {
        await updateDoc(doc(db, "groups", gid), { "next.penaltyMode": mode });
        await postFeed(gid, { kind: "mode", mode, round: nextRound });
        toast(`${modeLabel(mode)} starts with round ${nextRound}.`);
      }
    } catch (e) { toast(authError(e)); } finally { setBusy(false); }
  }

  async function newRound() {
    setBusy(true);
    const r = await api<{ round: number }>("/api/group", { gid, action: "start", days: Number(days), when });
    setBusy(false);
    if (r) { toast(`Round ${r.round} is set.`); onClose(); }
  }

  return (
    <Sheet title="Settings" onClose={onClose}>
      <label className="f">STAKE PER MISSED DAY (₹)
        <input className="input" inputMode="numeric" value={stake} onChange={(e) => setStake(e.target.value.replace(/\D/g, ""))} />
      </label>
      <label className="f">WHAT COUNTS AS A MISSED DAY</label>
      <RulePicker value={rule} onChange={setRule} />
      {dare ? (
        <div className="note">
          In Pay or Dare, stake and rule changes start with round {nextRound}.
          {group.next?.stake || group.next?.rule ? ` Queued: ${inr(group.next.stake ?? group.stake)} per miss, a miss = ${ruleLabel(group.next.rule ?? group.rule)}.` : ""}
        </div>
      ) : phase === "active" && <div className="note">Heads up: changing these mid-round re-scores the whole round, including past days.</div>}
      <button className="btn" style={{ marginTop: 14 }} disabled={busy} onClick={saveRules}>Save rules</button>

      <div className="card" style={{ marginTop: 22 }}>
        <h2>Penalty mode <span className="tag">{modeLabel(current)} now</span></h2>
        <ModePicker value={mode} onChange={setMode} />
        <div className="note">
          {queued && queued !== current ? `Switching to ${modeLabel(queued)} when round ${nextRound} starts. ` : ""}
          Changes start with the next round, never mid-round.
        </div>
        {mode !== (queued || current) && <button className="btn ghost" style={{ marginTop: 12 }} disabled={busy} onClick={saveMode}>
          {mode === current ? `Stay on ${modeLabel(current)}` : `Switch to ${modeLabel(mode)} from round ${nextRound}`}
        </button>}
        <button className="btn ghost" style={{ marginTop: 12 }} onClick={onDeck}>Dare deck</button>
      </div>

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
            {phase !== "over" && <div className="note">This ends round {group.round} now and wipes its score{dare ? " (open penalties still count)" : ""}. Sure?</div>}
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

/** The group's dare deck: add (rules shown, server blocklist), approve pending or reported dares, report one. */
export function DeckSheet({ gid, uid, dares, name, onClose }: {
  gid: string; uid: string; dares: Record<string, DareDoc>; name: (u: string) => string; onClose: () => void;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [reporting, setReporting] = useState<string | null>(null);
  const [reason, setReason] = useState("");
  const live = deckOf(dares);
  const pending = Object.entries(dares).filter(([id, d]) => !isStarter(id) && !d.approvedBy && !d.reported);
  const reported = Object.entries(dares).filter(([, d]) => d.reported);
  const by = (id: string) => (isStarter(id) ? "cTicks" : name(dares[id]?.by || ""));
  const call = async (body: Record<string, unknown>) => {
    setBusy(true);
    const r = await api("/api/dares", { gid, ...body });
    setBusy(false);
    return r;
  };
  return (
    <Sheet title="Dare deck" onClose={onClose}>
      <div className="note">Silly, not risky: about 30 seconds at home, filmed for your group only. A dare must never involve:</div>
      <ul className="rules">{DARE_RULES.map((r) => <li key={r}>{r}</li>)}</ul>

      <label className="f">ADD A DARE
        <textarea className="input" rows={2} maxLength={MAX_DARE} value={text} placeholder="e.g. Sing your missed task's name like an opera singer" onChange={(e) => setText(e.target.value)} />
      </label>
      <div className="note">{text.length}/{MAX_DARE} · someone else has to OK it before it&apos;s in the deck</div>
      <button className="btn" style={{ marginTop: 10 }} disabled={busy || text.trim().length < 8} onClick={async () => {
        if (await call({ action: "add", text })) { setText(""); toast("Added. Someone else has to OK it."); }
      }}>Add dare</button>

      {pending.length > 0 && <>
        <h4 className="deck-h">Waiting for an OK</h4>
        <ul className="deck">{pending.map(([id, d]) => (
          <li key={id}><span>{d.text}<small>by {name(d.by)}</small></span>
            {d.by === uid ? <small className="muted">waiting for someone else</small>
              : <button className="btn small" disabled={busy} onClick={() => call({ action: "approve", id })}>OK it</button>}
          </li>))}
        </ul>
      </>}

      {reported.length > 0 && <>
        <h4 className="deck-h">Reported</h4>
        <ul className="deck">{reported.map(([id, d]) => (
          <li key={id}><span>{d.text}<small>reported by {name(d.reported!.by)}{d.reported!.reason ? `: ${d.reported!.reason}` : ""}</small></span>
            {d.reported!.by === uid || d.by === uid ? <small className="muted">someone else can restore it</small>
              : <button className="btn small ghost" disabled={busy} onClick={() => call({ action: "approve", id })}>Restore</button>}
          </li>))}
        </ul>
      </>}

      <h4 className="deck-h">In the deck ({live.length})</h4>
      <ul className="deck">{live.map((d) => (
        <li key={d.id}>
          <span>{d.text}<small>by {by(d.id)}</small></span>
          {reporting === d.id ? (
            <div className="report">
              <input className="input" maxLength={80} placeholder="Why? (optional)" value={reason} onChange={(e) => setReason(e.target.value)} />
              <div className="row2">
                <button className="btn small ghost" onClick={() => { setReporting(null); setReason(""); }}>Cancel</button>
                <button className="btn small danger" disabled={busy} onClick={async () => {
                  if (await call({ action: "report", id: d.id, reason })) { setReporting(null); setReason(""); toast("Reported. It's out of the deck until someone else restores it."); }
                }}>Report</button>
              </div>
            </div>
          ) : <button className="linkbtn" onClick={() => setReporting(d.id)}>Report</button>}
        </li>))}
      </ul>
      {live.length === 0 && <div className="note">The deck&apos;s empty, so nobody can take a dare. Add one or restore a reported one.</div>}
      <div className="note">{STARTER.length} dares come with cTicks. Reporting one takes it out for your group only.</div>
    </Sheet>
  );
}
