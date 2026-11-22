"use client";
// Pay or Dare cards on the dashboard: your penalty (every state), votes you owe, payments to confirm,
// and the screen someone sees after being kicked. All actions go to /api/penalty; the server decides.
import { useEffect, useRef, useState } from "react";
import { deleteField, doc, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { api, toast } from "@/lib/client";
import { canRejoin, inr, prettyDay, type Group } from "@/lib/logic";
import { REASONS, type Penalty, type Reason, type Vote } from "@/lib/penalty";
import { STARTER } from "@/lib/dares";
import { due, each, KICK_WHY } from "@/lib/feed";
import Tik from "./Tik";

const H = 3_600_000;
const dot = (t: string) => (/[.!?]$/.test(t) ? t : `${t}.`);

/** "1d 4h left", "3h left", "25m left". */
export function left(ms: number | null | undefined, now: number) {
  if (!ms) return "";
  const d = ms - now;
  if (d <= 0) return "time's up";
  const h = Math.floor(d / H), m = Math.max(1, Math.floor((d % H) / 60_000));
  return h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h left` : h >= 1 ? `${h}h left` : `${m}m left`;
}

type Common = { gid: string; uid: string; now: number; name: (u: string) => string };
const act = (gid: string, id: string, action: string, extra: Record<string, unknown> = {}) =>
  api<{ penalty: Penalty }>("/api/penalty", { gid, id, action, ...extra });

/** The spin: a strip of dares slides up and lands on the one the server picked (decided before this plays). */
function Reel({ text, spin }: { text: string; spin: boolean }) {
  const [rolling, setRolling] = useState(spin);
  const items = useRef<string[]>([]);
  if (!items.current.length) {
    const pool = STARTER.map((d) => d.text).filter((t) => t !== text).sort(() => Math.random() - 0.5).slice(0, 7);
    items.current = [...pool, text];
  }
  useEffect(() => {
    if (spin && matchMedia("(prefers-reduced-motion: reduce)").matches) setRolling(false);
  }, [spin]);
  if (!rolling) return <blockquote className="dare land">{text}</blockquote>;
  return (
    <div className="reel" aria-live="polite" aria-label={`Your dare: ${text}`}>
      <div className="reel-strip" style={{ ["--n" as string]: items.current.length - 1 }} onAnimationEnd={() => setRolling(false)}>
        {items.current.map((t, i) => <div className="reel-item" key={i} aria-hidden="true">{t}</div>)}
      </div>
    </div>
  );
}

function Head({ mood, title, sub }: { mood: "proud" | "nudge" | "ticking" | "collector" | "sleeping"; title: React.ReactNode; sub: React.ReactNode }) {
  return <div className="tik-row pen-head"><Tik mood={mood} size={40} /><div><b>{title}</b><span>{sub}</span></div></div>;
}

/** Your own penalty, in whatever state it's in. */
export function PenaltyCard({ p, votes, deckEmpty, members, gid, uid, now, name }: Common & {
  p: Penalty; votes: Vote[]; deckEmpty: boolean; members: string[];
}) {
  const [busy, setBusy] = useState(false);
  const [spun, setSpun] = useState<string | null>(null);
  const [payInstead, setPayInstead] = useState(false);
  const run = async (action: string) => {
    if (busy) return;
    setBusy(true);
    // The live listener can deliver the new dare before this request returns, so arm the spin first.
    if (action === "dare" || action === "reroll") setSpun("pending");
    const r = await act(gid, p.id, action);
    setBusy(false);
    if (!r) { setSpun(null); return; }
    if (action === "done" || action === "again") toast("Voting's open. Your group has until the morning check.", "nudge");
    if (action === "paid") toast("Marked as paid. They'll confirm.", "proud");
  };
  const day = prettyDay(p.day, { weekday: "long" });
  const soon = p.due !== null && p.due - now < 12 * H;
  const clock = p.due ? <div className={`deadline${soon ? " soon" : ""}`}>{left(p.due, now)} · by {due(p.due)}</div> : null;
  const share = async () => {
    const text = `My cTicks dare: ${dot(p.dare?.text || "")} Proof coming on WhatsApp. Vote in the app: ${location.origin}/app`;
    try {
      if (navigator.share) await navigator.share({ text });
      else { await navigator.clipboard.writeText(text); toast("Dare copied. Paste it in your group chat."); }
    } catch { /* closed the share sheet */ }
  };
  const payLink = !payInstead ? (
    <button className="linkbtn" onClick={() => setPayInstead(true)}>Rather pay?</button>
  ) : (
    <div className="row2 confirm">
      <button className="btn ghost small" onClick={() => setPayInstead(false)}>Keep the dare</button>
      <button className="btn small" disabled={busy} onClick={() => run("pay")}>Pay {each(p)} instead</button>
    </div>
  );

  if (p.status === "open") return (
    <div className={`card pen${soon ? " urgent" : ""}`}>
      <h2>Penalty <span className="tag">{inr(p.stake)} / person</span></h2>
      <Head mood={soon ? "ticking" : "collector"} title={`You missed ${day}.`} sub={`Pay ${each(p)} or take a dare.`} />
      {clock}
      <div className="row2">
        <button className="btn ghost" disabled={busy} onClick={() => run("pay")}>Pay {each(p)}</button>
        <button className="btn" disabled={busy || deckEmpty} onClick={() => run("dare")}>Take a dare 🎲</button>
      </div>
      <div className="note">
        {deckEmpty ? "The deck's empty. Add or restore a dare in Settings, or pay. " : "A dare spins a random one from your deck, with 1 reroll. "}
        Checked every morning at 9.
      </div>
    </div>
  );

  if (p.status === "dare" && p.dare) return (
    <div className={`card pen${soon ? " urgent" : ""}`}>
      <h2>Your dare <span className="tag">{p.rerollsLeft ? "1 reroll left" : "no rerolls left"}</span></h2>
      <div className="tik-row spin-row"><Tik mood="nudge" size={40} /><Reel key={p.dare.id} text={p.dare.text} spin={spun !== null} /></div>
      <div className="note">Do it, send the video or photo to your group chat, then tap Done. cTicks never sees your proof.</div>
      {clock}
      <button className="btn" disabled={busy} onClick={() => run("done")}>Done, I sent the proof</button>
      <div className="row2">
        <button className="btn ghost small" onClick={share}>Share dare</button>
        {p.rerollsLeft > 0 && <button className="btn ghost small" disabled={busy} onClick={() => run("reroll")}>Reroll</button>}
      </div>
      {payLink}
    </div>
  );

  if (p.status === "voting") {
    const el = p.voters.filter((v) => members.includes(v));
    const mine = votes.filter((v) => v.attempt === p.attempt);
    return (
      <div className="card pen">
        <h2>Waiting for votes <span className="tag">{mine.filter((v) => el.includes(v.voter)).length} of {el.length}</span></h2>
        <Head mood="nudge" title={p.attempt === 2 ? "Second try sent." : "Proof sent."} sub={`Votes close ${due(p.voteEnds)} (${left(p.voteEnds, now)}).`} />
        <blockquote className="dare">{p.dare?.text}</blockquote>
        <ul className="votes">
          {el.map((v) => {
            const x = mine.find((m) => m.voter === v);
            return <li key={v}><span>{name(v)}</span><b>{!x ? "…" : x.vote === "done" ? "✅" : `❌ ${REASONS[x.reason || "other"]}`}</b></li>;
          })}
        </ul>
        <div className="note">It fails only if more than half of them say ❌. Not voting counts as done.</div>
        {payLink}
      </div>
    );
  }

  if (p.status === "retry") {
    const nos = votes.filter((v) => v.attempt === 1 && v.vote === "not");
    return (
      <div className={`card pen${soon ? " urgent" : ""}`}>
        <h2>Your dare didn&apos;t pass <span className="tag">1 retry</span></h2>
        <Head mood={soon ? "ticking" : "collector"} title="Try again or pay." sub="Send the proof again (same dare), or pay instead." />
        <blockquote className="dare">{p.dare?.text}</blockquote>
        {nos.length > 0 && <ul className="votes">{nos.map((v) => <li key={v.voter}><span>{name(v.voter)}</span><b>{REASONS[v.reason || "other"]}{v.note ? `: ${v.note}` : ""}</b></li>)}</ul>}
        {clock}
        <div className="row2">
          <button className="btn ghost" disabled={busy} onClick={() => run("pay")}>Pay {each(p)}</button>
          <button className="btn" disabled={busy} onClick={() => run("again")}>Sent it again</button>
        </div>
        <div className="note">A second ❌ means you pay. Checked every morning at 9.</div>
      </div>
    );
  }

  if (p.status === "pay" || p.status === "paid") {
    const rows = p.payees.map((to) => ({ to, s: p.payments[to]?.s || "owed" }));
    const owed = rows.filter((r) => r.s === "owed");
    return (
      <div className={`card pen${p.status === "pay" && soon ? " urgent" : ""}`}>
        <h2>{p.status === "pay" ? `Pay ${each(p)}` : "Payment"} <span className="tag">for {day}</span></h2>
        {p.status === "pay" && (p.locked
          ? <Head mood="ticking" title="Your dare failed twice." sub={`Pay by ${due(p.due)} or you're out.`} />
          : <Head mood={soon ? "ticking" : "collector"} title={`Pay ${each(p)} on UPI.`} sub="Then tap I paid, and they'll confirm." />)}
        <ul className="votes">
          {rows.map((r) => <li key={r.to}><span>{name(r.to)}</span><b className={`pay-${r.s}`}>{r.s === "confirmed" ? "got it ✓" : r.s === "marked" ? "waiting for them" : "unpaid"}</b></li>)}
        </ul>
        {p.status === "pay" && clock}
        {owed.length > 0 && (
          <button className="btn" disabled={busy} onClick={() => run("paid")}>{p.status === "paid" ? "Mark paid again" : "I paid"}</button>
        )}
        <div className="note">
          {p.status === "paid" && owed.length ? `${owed.map((r) => name(r.to)).join(" & ")} says it didn't arrive. Check your UPI, then mark it paid again.`
            : p.status === "paid" ? "They tap Got it, or it counts as yes at the morning check 2 days after you marked it."
            : "cTicks never moves money. Pay on UPI, then come back and tap I paid."}
        </div>
      </div>
    );
  }

  if (p.status === "passed") return (
    <div className="card pen">
      <Head mood="proud" title="Dare passed." sub={`Nothing owed for ${day}.`} />
    </div>
  );
  return null;
}

/** Someone else's dare you get a vote on. */
export function VoteCard({ p, votes, gid, uid, now, name }: Common & { p: Penalty; votes: Vote[] }) {
  const mine = votes.find((v) => v.voter === uid && v.attempt === p.attempt);
  const [no, setNo] = useState(false);
  const [reason, setReason] = useState<Reason | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const cast = async (vote: "done" | "not") => {
    setBusy(true);
    const r = await act(gid, p.id, "vote", { vote, reason, note });
    setBusy(false);
    if (r) { setNo(false); toast(vote === "done" ? "Voted ✅" : "Voted ❌"); }
  };
  return (
    <div className="card pen">
      <h2>Vote <span className="tag">{p.attempt === 2 ? "second try · " : ""}{left(p.voteEnds, now)}</span></h2>
      <Head mood="nudge" title={`${name(p.uid)} says the dare is done.`} sub="Check your group chat for the proof, then vote." />
      <blockquote className="dare">{p.dare?.text}</blockquote>
      {mine && !no && <div className="note">You voted {mine.vote === "done" ? "✅ done" : "❌ not done"}. You can change it until {due(p.voteEnds)}.</div>}
      {!no ? (
        <div className="row2">
          <button className="btn ghost" disabled={busy} onClick={() => setNo(true)}>❌ Not done</button>
          <button className="btn" disabled={busy || mine?.vote === "done"} onClick={() => cast("done")}>✅ Done</button>
        </div>
      ) : (
        <>
          <div className="choice reasons" role="radiogroup" aria-label="Why not?">
            {(Object.keys(REASONS) as Reason[]).map((k) => (
              <button key={k} role="radio" aria-checked={reason === k} className={reason === k ? "on" : ""} onClick={() => setReason(k)}><b>{REASONS[k]}</b></button>
            ))}
          </div>
          {reason === "other" && <input className="input" maxLength={80} placeholder="What was wrong? (80 characters)" value={note} onChange={(e) => setNote(e.target.value)} />}
          <div className="row2">
            <button className="btn ghost" onClick={() => setNo(false)}>Back</button>
            <button className="btn danger" disabled={busy || !reason || (reason === "other" && !note.trim())} onClick={() => cast("not")}>Send ❌</button>
          </div>
        </>
      )}
      <div className="note">It fails only if more than half of you say ❌. Votes close {due(p.voteEnds)}.</div>
    </div>
  );
}

/** A payment someone says they sent you. */
export function ConfirmCard({ p, gid, uid, now, name }: Common & { p: Penalty }) {
  const [busy, setBusy] = useState(false);
  const pay = p.payments[uid];
  const run = async (action: "got" | "notgot") => {
    setBusy(true);
    const r = await act(gid, p.id, action);
    setBusy(false);
    if (r) toast(action === "got" ? "Confirmed. That one's settled." : `Told ${name(p.uid)} it didn't arrive.`);
  };
  return (
    <div className="card pen">
      <h2>Payment <span className="tag">{left(pay?.confirmBy, now)}</span></h2>
      <Head mood="collector" title={`${name(p.uid)} says you've been paid ${inr(p.stake)}.`}
        sub={`For missing ${prettyDay(p.day, { weekday: "long" })}. No answer by ${due(pay?.confirmBy)} counts as yes.`} />
      <div className="row2">
        <button className="btn ghost" disabled={busy} onClick={() => run("notgot")}>Didn&apos;t get it</button>
        <button className="btn" disabled={busy} onClick={() => run("got")}>Got it</button>
      </div>
    </div>
  );
}

/** What a kicked player sees instead of the dashboard. */
export function OutScreen({ group, gid, uid }: { group: Group; gid: string; uid: string }) {
  const k = group.kicked?.[uid];
  const [busy, setBusy] = useState(false);
  const back = canRejoin(group, uid);
  return (
    <div className="wrap center outscreen">
      <Tik mood="sleeping" size={96} />
      <h1>You&apos;re out{k ? ` of round ${k.round}` : ""}.</h1>
      {k && <p className="sub">{KICK_WHY[k.why]}{k.owed > 0 ? `. You owed ${inr(k.owed)} when you left: pay it on UPI and they can mark it received.` : "."}</p>}
      {back ? (
        <button className="btn" disabled={busy} onClick={async () => {
          setBusy(true);
          const r = await api("/api/group", { gid, action: "rejoin" });
          setBusy(false);
          if (r) toast("You're back in. Fresh start.", "proud");
        }}>Rejoin round {group.round}</button>
      ) : (
        <p className="note">You can rejoin when round {(k?.round ?? group.round) + 1} starts.</p>
      )}
      <button className="btn ghost" onClick={async () => {
        if (db) await setDoc(doc(db, "users", uid), { groupId: deleteField() }, { merge: true });
      }}>Switch challenge</button>
    </div>
  );
}
