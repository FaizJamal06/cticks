"use client";
import { useEffect, useRef, useState } from "react";
import type { User } from "firebase/auth";
import {
  arrayRemove, arrayUnion, collection, doc, FieldPath, limit, onSnapshot, orderBy, query, updateDoc,
} from "firebase/firestore";
import { db } from "@/lib/firebase";
import {
  dayKey, doneCount, doneIds, inr, isMiss, ledger, openTasks, prettyDay, roundDays, roundEnd, roundState, ruleLabel, streak,
  type Group, type Player,
} from "@/lib/logic";
import { feedLine, type FeedItem } from "@/lib/feed";
import { authError, listenForeground, postFeed, store, toast } from "@/lib/client";
import { EditTasksSheet, SettingsSheet } from "./Sheets";
import Banners from "./Banners";
import Tik, { Logo } from "./Tik";

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
  const [today, setToday] = useState(dayKey());
  const [sheet, setSheet] = useState<null | "settings" | "tasks">(null);
  const playersRef = useRef(players);
  playersRef.current = players;
  const loadedAt = useRef(Date.now());
  const lastSeen = useRef(Number(store.get(`payup.seen.${gid}`) || 0));

  // ---- live data ----
  useEffect(() => {
    if (!db) return;
    const offs = [
      onSnapshot(doc(db, "groups", gid), (s) => setGroup(s.exists() ? (s.data() as Group) : null), () => setGroup(null)),
      onSnapshot(collection(db, "groups", gid, "players"), (q) => {
        const m: Record<string, Player> = {};
        q.forEach((d) => { m[d.id] = { ...(d.data() as Player), uid: d.id }; });
        setPlayers(m);
      }),
      onSnapshot(query(collection(db, "groups", gid, "feed"), orderBy("ts", "desc"), limit(60)), (q) => {
        q.docChanges().forEach((c) => {
          const f = c.doc.data() as FeedItem;
          if (c.type === "added" && f.by !== uid && f.ts > loadedAt.current) {
            const nm = playersRef.current[f.by]?.name || "Your friend";
            toast(feedLine(f, (x) => (x === uid ? "You" : playersRef.current[x]?.name || nm), uid));
          }
        });
        setFeed(q.docs.map((d) => ({ ...(d.data() as FeedItem), id: d.id })));
      }),
    ];
    let offMsg: () => void = () => {};
    listenForeground().then((f) => (offMsg = f));
    const tick = setInterval(() => setToday(dayKey()), 30_000);
    const seen = setTimeout(() => store.set(`payup.seen.${gid}`, String(Date.now())), 4000);
    return () => { offs.forEach((o) => o()); offMsg(); clearInterval(tick); clearTimeout(seen); };
  }, [gid, uid]);

  const me = players[uid];

  if (group === undefined || (group && !me)) return <div className="wrap center">loading…</div>;
  if (group === null) return <div className="wrap center">This challenge no longer exists.</div>;

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
        onToggle={toggle} onNudge={nudge} onSheet={setSheet} />
      {sheet === "settings" && <SettingsSheet group={group} gid={gid} uid={uid} phase={st.phase} onClose={() => setSheet(null)} />}
      {sheet === "tasks" && <EditTasksSheet gid={gid} uid={uid} tasks={me.tasks} onClose={() => setSheet(null)} />}
    </>
  );
}

export function DashboardView({ group, players, feed, today, uid, lastSeen, onToggle, onNudge, onSheet }: {
  group: Group; players: Record<string, Player>; feed: FeedItem[]; today: string; uid: string; lastSeen: number;
  onToggle: (taskId: string, text: string) => void; onNudge: (p: Player) => void; onSheet: (s: "settings" | "tasks") => void;
}) {
  const members = (group.members || []).map((m) => players[m]).filter(Boolean) as Player[];
  const me = players[uid];
  const others = members.filter((p) => p.uid !== uid);
  const name = (x: string) => (x === uid ? "You" : players[x]?.name || "Someone");
  const st = roundState(group, today);
  const days = roundDays(group);
  const { misses, debts } = ledger(group, members, today);
  const myDone = new Set(doneIds(me, today));
  const myTotal = me.tasks.length;
  const canTick = st.phase === "active";
  const canEditTasks = st.phase !== "active" || (st.day === 1 && myDone.size === 0);

  // ---- header line ----
  const sub =
    st.phase === "upcoming" ? `Round ${group.round} starts ${prettyDay(group.start)} · ${inr(group.stake)} per miss`
    : st.phase === "active" ? `Round ${group.round} · Day ${st.day} of ${group.days} · ${inr(group.stake)} per miss`
    : `Round ${group.round} finished ${prettyDay(roundEnd(group))} · settle up`;

  // ---- ledger headline (from my point of view) ----
  const mine = debts.filter((d) => d.from === uid || d.to === uid);
  const net = mine.reduce((s, d) => s + (d.to === uid ? d.amount : -d.amount), 0);
  const final = st.phase === "over" ? "Final: " : "";
  let headline: React.ReactNode;
  if (!others.length) headline = <div className="big tik-row"><Tik mood="sleeping" size={44} />Waiting for your friend</div>;
  else if (others.length === 1) {
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
        {others.length > 1 && debts.map((d, i) => (
          <div className="row" key={i}><span>{name(d.from)} → {name(d.to)}</span><b>{inr(d.amount)}</b></div>
        ))}
        {st.phase === "over" && <>
          <div className="note tik-row"><Tik mood="collector" size={40} />Round&apos;s done. Settle up on UPI, then go again.</div>
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
          {members.map((p) => (
            <div className="grow" key={p.uid}>
              <div className="who">{p.uid === uid ? "You" : p.name}</div>
              <div className="cells">
                {days.map((k) => {
                  const n = doneCount(p, k), total = p.tasks.length;
                  let cls = "cell", label = "";
                  if (k > today) cls += "";
                  else if (k < p.joined) cls += " na";
                  else if (k === today) { cls += " today" + (n >= total && total ? " done" : ""); label = `${n}`; }
                  else if (isMiss(group, p, k)) { cls += " miss"; label = "✗"; }
                  else if (n >= total) { cls += " done"; label = "✓"; }
                  else { cls += " partial"; label = `${n}`; }
                  return <div className={cls} key={k} title={`${prettyDay(k)}: ${n}/${total}`}>{label}</div>;
                })}
              </div>
            </div>
          ))}
        </div>
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
