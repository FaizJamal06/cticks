"use client";
import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import {
  arrayRemove, arrayUnion, collection, doc, FieldPath, limit, onSnapshot, orderBy, query, updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  dayKey, doneCount, doneIds, inr, isDare, isMiss, ledger, openTasks, prettyDay, roundDays, roundEnd, roundState, ruleLabel, streak,
  type Group, type Player,
} from "@/lib/logic";
import { feedLine, type FeedItem } from "@/lib/feed";
import { onTheLine, penaltyLedger, type Penalty, type Vote } from "@/lib/penalty";
import { deckOf, type DareDoc } from "@/lib/dares";
import { api, authError, listenForeground, postFeed, store, toast } from "@/lib/client";
import { DeckSheet, EditTasksSheet, SettingsSheet } from "./Sheets";
import { ConfirmCard, OutScreen, PenaltyCard, VoteCard } from "./Penalties";
import Banners from "./Banners";
import Tik, { Logo } from "./Tik";

const H = 3_600_000;
const LIVE = ["open", "dare", "voting", "retry", "pay"];

const ago = (ts: number) => {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return "now";
  if (m < 60) return `${m}m`;
  if (m < 1440) return `${Math.floor(m / 60)}h`;
  return `${Math.floor(m / 1440)}d`;
};

export default function Dashboard({ user, gid }: { user: User; gid: string }) {
  const uid = user.uid;
  const [group, setGroup] = useState<Group | null | undefined>(undefined);
  const [players, setPlayers] = useState<Record<string, Player>>({});
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [penalties, setPenalties] = useState<Penalty[]>([]);
  const [dares, setDares] = useState<Record<string, DareDoc>>({});
  const [votes, setVotes] = useState<Record<string, Vote[]>>({});
  const [today, setToday] = useState(dayKey());
  const [now, setNow] = useState(Date.now());
  const [sheet, setSheet] = useState<null | "settings" | "tasks" | "deck">(null);
  const playersRef = useRef(players);
  playersRef.current = players;
  const loadedAt = useRef(Date.now());
  const lastSeen = useRef(Number(store.get(`payup.seen.${gid}`) || 0));
  const isIn = !!group?.members?.includes(uid);

  // ---- live data ----
  useEffect(() => {
    if (!db) return;
    const off = onSnapshot(doc(db, "groups", gid), (s) => setGroup(s.exists() ? (s.data() as Group) : null), () => setGroup(null));
    let offMsg: () => void = () => {};
    listenForeground().then((f) => (offMsg = f));
    const tick = setInterval(() => { setToday(dayKey()); setNow(Date.now()); }, 30_000);
    const seen = setTimeout(() => store.set(`payup.seen.${gid}`, String(Date.now())), 4000);
    return () => { off(); offMsg(); clearInterval(tick); clearTimeout(seen); };
  }, [gid]);

  // Members-only data. Re-subscribes when you're kicked or rejoin (a kicked player can't read these).
  useEffect(() => {
    if (!db || !isIn) return;
    const quiet = () => {};
    const offs = [
      onSnapshot(collection(db, "groups", gid, "players"), (q) => {
        const m: Record<string, Player> = {};
        q.forEach((d) => { m[d.id] = { ...(d.data() as Player), uid: d.id }; });
        setPlayers(m);
      }, quiet),
      onSnapshot(query(collection(db, "groups", gid, "feed"), orderBy("ts", "desc"), limit(60)), (q) => {
        q.docChanges().forEach((c) => {
          const f = c.doc.data() as FeedItem;
          if (c.type === "added" && f.by !== uid && f.ts > loadedAt.current) {
            const nm = playersRef.current[f.by]?.name || "Your friend";
            toast(feedLine(f, (x) => (x === uid ? "You" : playersRef.current[x]?.name || nm), uid));
          }
        });
        setFeed(q.docs.map((d) => ({ ...(d.data() as FeedItem), id: d.id })));
      }, quiet),
      // ponytail: every penalty the group ever had; fine for years at 2–6 people. Filter by round if it grows.
      onSnapshot(query(collection(db, "groups", gid, "penalties"), limit(500)), (q) => setPenalties(q.docs.map((d) => d.data() as Penalty)), quiet),
      onSnapshot(collection(db, "groups", gid, "dares"), (q) => {
        const m: Record<string, DareDoc> = {};
        q.forEach((d) => { m[d.id] = d.data() as DareDoc; });
        setDares(m);
      }, quiet),
    ];
    return () => offs.forEach((o) => o());
  }, [gid, uid, isIn]);

  // Votes, only for penalties where they matter right now (a vote in progress, or a retry showing the reasons).
  const voteIds = penalties.filter((p) => p.status === "voting" || p.status === "retry").map((p) => p.id).sort().join(",");
  useEffect(() => {
    if (!db || !isIn || !voteIds) return;
    const offs = voteIds.split(",").map((id) =>
      onSnapshot(collection(db!, "groups", gid, "penalties", id, "votes"), (q) => setVotes((v) => ({ ...v, [id]: q.docs.map((d) => d.data() as Vote) })), () => {}));
    return () => offs.forEach((o) => o());
  }, [gid, isIn, voteIds]);

  const me = players[uid];

  if (group === undefined) return <div className="wrap center">loading…</div>;
  if (group === null) return <div className="wrap center">This challenge no longer exists.</div>;
  if (!isIn) return <OutScreen group={group} gid={gid} uid={uid} />;
  if (!me) return <div className="wrap center">loading…</div>;

  const st = roundState(group, today);
  const canTick = st.phase === "active";

  async function toggle(taskId: string, text: string) {
    if (!db || !canTick) return;
    const had = doneIds(playersRef.current[uid], today).includes(taskId);
    try {
      await updateDoc(doc(db, "groups", gid, "players", uid), new FieldPath("checks", today), had ? arrayRemove(taskId) : arrayUnion(taskId));
    } catch (e) { return toast(authError(e)); }
    if (had) return;
    // Tell your friend — once per task per day, even if you untick and re-tick.
    const key = `payup.told.${gid}.${today}.${taskId}`;
    if (store.get(key)) return;
    store.set(key, "1");
    const p = playersRef.current[uid];
    await postFeed(gid, { kind: "check", task: text, n: doneCount(p, today), total: p.tasks.length });
  }

  async function nudge(p: Player) {
    const key = `payup.nudge.${gid}.${p.uid}`;
    const last = Number(store.get(key) || 0);
    if (Date.now() - last < 30 * 60_000) return toast(`You nudged ${p.name} recently. Give them a sec.`);
    store.set(key, String(Date.now()));
    await postFeed(gid, { kind: "nudge", to: p.uid, open: openTasks(p, today).length });
    toast(`Nudged ${p.name} 👀`, "nudge");
  }

  return (
    <>
      <DashboardView group={group} players={players} feed={feed} today={today} uid={uid} lastSeen={lastSeen.current}
        gid={gid} now={now} penalties={penalties} votes={votes} dares={dares}
        onToggle={toggle} onNudge={nudge} onSheet={setSheet} />
      {sheet === "settings" && <SettingsSheet group={group} gid={gid} uid={uid} phase={st.phase} onClose={() => setSheet(null)} onDeck={() => setSheet("deck")} />}
      {sheet === "tasks" && <EditTasksSheet gid={gid} uid={uid} tasks={me.tasks} onClose={() => setSheet(null)} />}
      {sheet === "deck" && <DeckSheet gid={gid} uid={uid} dares={dares} name={(x) => (x === uid ? "you" : players[x]?.name || "someone")} onClose={() => setSheet(null)} />}
    </>
  );
}

export function DashboardView({ group, players, feed, today, uid, lastSeen, onToggle, onNudge, onSheet, gid = group.code, now = Date.now(), penalties = [], votes = {}, dares = {} }: {
  group: Group; players: Record<string, Player>; feed: FeedItem[]; today: string; uid: string; lastSeen: number;
  onToggle: (taskId: string, text: string) => void; onNudge: (p: Player) => void; onSheet: (s: "settings" | "tasks") => void;
  gid?: string; now?: number; penalties?: Penalty[]; votes?: Record<string, Vote[]>; dares?: Record<string, DareDoc>;
}) {
  const members = (group.members || []).map((m) => players[m]).filter(Boolean) as Player[];
  const me = players[uid];
  const others = members.filter((p) => p.uid !== uid);
  const name = (x: string) => (x === uid ? "You" : players[x]?.name || "Someone");
  const named = (x: string) => `${name(x)}${group.kicked?.[x] ? " (out)" : ""}`;
  const st = roundState(group, today);
  const days = roundDays(group);
  const end = roundEnd(group);
  const dare = isDare(group);
  const { misses, debts } = ledger(group, members, today);
  const myDone = new Set(doneIds(me, today));
  const myTotal = me.tasks.length;
  const canTick = st.phase === "active";
  const canEditTasks = st.phase !== "active" || (st.day === 1 && myDone.size === 0);

  // ---- Pay or Dare: what needs you right now ----
  const mineNow = penalties
    .filter((p) => p.uid === uid && (LIVE.includes(p.status)
      || (p.status === "paid" && Object.values(p.payments).some((x) => x.s !== "confirmed"))
      || (p.status === "passed" && now - (p.closedAt || 0) < 12 * H)))
    .sort((a, b) => a.createdAt - b.createdAt);
  const toVote = penalties.filter((p) => p.status === "voting" && p.uid !== uid && p.voters.includes(uid));
  const toConfirm = penalties.filter((p) => p.uid !== uid && p.payments[uid]?.s === "marked");
  const deckEmpty = deckOf(dares).length === 0;
  const common = { gid, uid, now, name: (x: string) => players[x]?.name || "Someone" };

  // ---- header line ----
  const per = `${inr(group.stake)} per miss${dare ? " · Pay or Dare" : ""}`;
  const sub =
    st.phase === "upcoming" ? `Round ${group.round} starts ${prettyDay(group.start)} · ${per}`
    : st.phase === "active" ? `Round ${group.round} · Day ${st.day} of ${group.days} · ${per}`
    : group.winner ? `Round ${group.round} over · ${name(group.winner)} ${group.winner === uid ? "are" : "is"} the last one standing`
    : `Round ${group.round} finished ${prettyDay(end)} · ${dare ? "check what's unpaid" : "settle up"}`;

  // ---- Pay or Dare money: unpaid per pair (any round), settled this round, on the line ----
  const unpaid = penaltyLedger(penalties).filter((r) => r.unpaid > 0);
  const iOwe = unpaid.filter((r) => r.from === uid).reduce((s, r) => s + r.unpaid, 0);
  const owedMe = unpaid.filter((r) => r.to === uid).reduce((s, r) => s + r.unpaid, 0);
  const settled = penaltyLedger(penalties.filter((p) => p.round === group.round)).reduce((s, r) => s + r.paid, 0);
  const onLine = onTheLine(penalties);
  const gotAll = async (from: string) => {
    for (const p of penalties.filter((x) => x.uid === from && ["pay", "paid", "kicked"].includes(x.status) && x.payments[uid] && x.payments[uid].s !== "confirmed"))
      await api("/api/penalty", { gid, id: p.id, action: "got" });
    toast("Marked as received.");
  };

  // ---- ledger headline (from my point of view) ----
  const mine = debts.filter((d) => d.from === uid || d.to === uid);
  const net = mine.reduce((s, d) => s + (d.to === uid ? d.amount : -d.amount), 0);
  const final = st.phase === "over" ? "Final: " : "";
  let headline: React.ReactNode;
  if (!others.length && !unpaid.length) headline = <div className="big tik-row"><Tik mood="sleeping" size={44} />Waiting for your friend</div>;
  else if (dare) {
    const one = unpaid.length === 1 ? unpaid[0] : null;
    headline = iOwe && owedMe ? <div className="big">You owe {inr(iOwe)} · you&apos;re owed {inr(owedMe)}</div>
      : iOwe ? <div className="big lose">You owe {one ? `${named(one.to)} ` : ""}{inr(iOwe)}</div>
      : owedMe ? <div className="big win">{one ? `${named(one.from)} owes you` : "You're owed"} {inr(owedMe)}</div>
      : <div className="big">{onLine.get(uid) ? `${inr(onLine.get(uid)!)} on the line` : "All settled"}</div>;
  } else if (others.length === 1) {
    const o = others[0];
    headline = net > 0 ? <div className="big win">{final}{o.name} owes you {inr(net)}</div>
      : net < 0 ? <div className="big lose">{final}You owe {o.name} {inr(-net)}</div>
      : <div className="big">{final}All square</div>;
  } else {
    headline = net > 0 ? <div className="big win">{final}You&apos;re up {inr(net)}</div>
      : net < 0 ? <div className="big lose">{final}You&apos;re down {inr(-net)}</div>
      : <div className="big">{final}You&apos;re even</div>;
  }

  const newCount = feed.filter((f) => f.by !== uid && f.ts > lastSeen).length;

  return (
    <div className="wrap">
      <div className="top">
        <div>
          <h1 className="logo"><Logo /></h1>
          <div className="sub">{sub}</div>
        </div>
        <button className="iconbtn" aria-label="Settings" onClick={() => onSheet("settings")}>⚙</button>
      </div>

      <Banners uid={uid} />

      {/* ---- Pay or Dare: your penalties, votes you owe, payments to confirm ---- */}
      {mineNow.map((p) => <PenaltyCard key={p.id} p={p} votes={votes[p.id] || []} deckEmpty={deckEmpty} members={group.members} {...common} />)}
      {toVote.map((p) => <VoteCard key={p.id} p={p} votes={votes[p.id] || []} {...common} />)}
      {toConfirm.map((p) => <ConfirmCard key={p.id} p={p} {...common} />)}

      {!others.length && (
        <div className="banner">
          <b>Invite your friend.</b> Send them this code, or tap share. They sign up and enter it.
          <div className="code">{group.code}</div>
          <button className="btn small" onClick={async () => {
            const url = `${location.origin}/?join=${group.code}&from=${encodeURIComponent(me.name)}`;
            const text = `I'm putting money on it. Join my cTicks challenge: code ${group.code}`;
            try { if (navigator.share) await navigator.share({ title: "cTicks", text, url }); else { await navigator.clipboard.writeText(`${text}\n${url}`); toast("Invite copied"); } } catch {}
          }}>Share invite</button>
        </div>
      )}

      {/* ---- who owes who ---- */}
      <div className="card ledger">
        <h2>The money <span className="tag">{inr(group.stake)} / missed day</span></h2>
        {headline}
        {others.length > 0 && (
          <div className="meta">
            Missed days this round: {members.map((p) => `${p.uid === uid ? "you" : p.name} ${misses.get(p.uid) || 0}`).join(" · ")}
          </div>
        )}
        {!dare && others.length > 1 && debts.map((d, i) => (
          <div className="row" key={i}><span>{name(d.from)} → {name(d.to)}</span><b>{inr(d.amount)}</b></div>
        ))}
        {dare && <>
          {unpaid.map((r) => (
            <div className="row" key={`${r.from}>${r.to}`}>
              <span>{named(r.from)} → {named(r.to)} <small className="muted">unpaid</small></span>
              <b>{inr(r.unpaid)}{r.to === uid && <button className="linkbtn" onClick={() => gotAll(r.from)}>Got it</button>}</b>
            </div>
          ))}
          <div className="meta">
            {settled ? `Settled this round: ${inr(settled)}. ` : ""}
            {[...onLine].filter(([, v]) => v).map(([u, v]) => `${name(u)}: ${inr(v)} on the line`).join(" · ")}
            {!settled && !onLine.size && !unpaid.length ? "Each miss is paid on its own or dared away. Nothing nets out." : ""}
          </div>
        </>}
        {st.phase === "over" && <>
          <div className="note tik-row"><Tik mood="collector" size={40} />{dare ? "Round's done. Pay what's unpaid on UPI, then go again." : "Round's done. Settle up on UPI, then go again."}</div>
          <button className="btn" style={{ marginTop: 14 }} onClick={() => onSheet("settings")}>Start the next round</button>
        </>}
      </div>

      {/* ---- my tasks today ---- */}
      <div className="card">
        <h2>
          Today · {prettyDay(today, { weekday: "long" })}
          <span className="tag">{myDone.size}/{myTotal} · 🔥 {streak(group, me, today)}</span>
        </h2>
        <div className="progress"><span style={{ width: `${myTotal ? (myDone.size / myTotal) * 100 : 0}%` }} /></div>
        {me.tasks.map((t) => {
          const done = myDone.has(t.id);
          return (
            <button key={t.id} className={`task ${done ? "done" : ""}`} disabled={!canTick} onClick={() => onToggle(t.id, t.text)}>
              <span className="box">{done ? "✓" : ""}</span>
              <span className="txt">{t.text}</span>
            </button>
          );
        })}
        <div className={`note${st.phase === "upcoming" ? " tik-row" : ""}`}>
          {st.phase === "upcoming" && <Tik mood="sleeping" size={32} />}
          <span>
            {st.phase === "upcoming" ? `Ticks start counting ${prettyDay(group.start)}. You can still change your tasks.`
              : st.phase === "over" ? "Round's over. Start a new one from settings."
              : `A miss = ${ruleLabel(group.rule)}. Only today can be ticked, so no backfilling.`}
            {canEditTasks && <> <a href="#" onClick={(e) => { e.preventDefault(); onSheet("tasks"); }} style={{ color: "var(--lime)" }}>Edit tasks</a></>}
          </span>
        </div>
      </div>

      {/* ---- friends today ---- */}
      {others.map((p) => {
        const done = new Set(doneIds(p, today));
        const left = p.tasks.length - done.size;
        return (
          <div className="card" key={p.uid}>
            <div className="friend">
              <div>
                <div className="name">{p.name}</div>
                <div className="sub" style={{ marginTop: 2 }}>{done.size}/{p.tasks.length} today · 🔥 {streak(group, p, today)}</div>
              </div>
              {canTick && left > 0 ? (
                <button className="btn small ghost" onClick={() => onNudge(p)}>Nudge 👀</button>
              ) : canTick ? <span className="chip hot">done ✓</span> : null}
            </div>
            <div style={{ marginTop: 10 }}>
              {p.tasks.map((t) => (
                <div className="ftask" key={t.id}><span className={`dot ${done.has(t.id) ? "on" : ""}`} />{t.text}</div>
              ))}
            </div>
          </div>
        );
      })}

      {/* ---- round grid ---- */}
      <div className="card">
        <h2>Round {group.round}</h2>
        <div className="dayhead">{days.map((k) => <span key={k}>{prettyDay(k, { weekday: "narrow" })}</span>)}</div>
        <div className="grid">
          {[...members, ...Object.entries(group.kicked || {}).filter(([k, v]) => v.round === group.round && players[k]).map(([k]) => players[k])].map((p) => {
            const out = !group.members.includes(p.uid) ? group.kicked?.[p.uid] : undefined;
            return (
              <div className={`grow${out ? " out" : ""}`} key={p.uid}>
                <div className="who">{p.uid === uid ? "You" : p.name}{out && <small>out · {prettyDay(out.day, { weekday: "short" })}</small>}</div>
                <div className="cells">
                  {days.map((k) => {
                    const n = doneCount(p, k), total = p.tasks.length;
                    const pen = dare ? penalties.find((x) => x.uid === p.uid && x.day === k) : undefined;
                    let cls = "cell", label = "", title = `${prettyDay(k)}: ${n}/${total}`;
                    if ((out && k >= out.day) || k > end) cls += " na";
                    else if (k > today) cls += "";
                    else if (k < p.joined) cls += " na";
                    else if (k === today) { cls += " today" + (n >= total && total ? " done" : ""); label = `${n}`; }
                    else if (pen?.status === "passed") { cls += " dared"; label = "🎭"; title += " · dare passed"; }
                    else if (pen && ["open", "dare", "voting", "retry"].includes(pen.status)) { cls += " pending"; label = "?"; title += " · pay or dare, not decided yet"; }
                    else if (isMiss(group, p, k)) { cls += " miss"; label = "✗"; }
                    else if (n >= total) { cls += " done"; label = "✓"; }
                    else { cls += " partial"; label = `${n}`; }
                    return <div className={cls} key={k} title={title}>{label}</div>;
                  })}
                </div>
              </div>
            );
          })}
        </div>
        {dare && penalties.some((x) => x.round === group.round && x.status === "passed") && <div className="note">🎭 = a miss dared away (nothing owed).</div>}
      </div>

      {/* ---- activity ---- */}
      <div className="card">
        <h2>Activity {newCount > 0 && <span className="chip hot">{newCount} new</span>}</h2>
        {feed.length === 0 ? <div className="note tik-row" style={{ marginTop: 0 }}><Tik mood="sleeping" size={32} />Nothing yet. Tick something.</div> : (
          <ul className="feed">
            {feed.slice(0, 30).map((f) => (
              <li key={f.id} className={f.by !== uid && f.ts > lastSeen ? "new" : ""}>
                <time>{ago(f.ts)}</time>
                <span>{feedLine(f, name, uid)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="note" style={{ textAlign: "center", marginTop: 20 }}>code {group.code}</div>

    </div>
  );
}
