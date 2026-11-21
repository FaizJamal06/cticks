"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import TikStroke from "./tik-stroke";
import TikWatch from "./tik-watch";
import TikBox from "./tik-box";
import { MOODS, type TikProps } from "./shared";

type Concept = {
  name: string; Tik: (p: TikProps) => React.ReactNode; axis: string; clock: string; wins: string; cost: string;
};

const CONCEPTS: Concept[] = [
  {
    name: "Stroke", Tik: TikStroke,
    axis: "The ✓ is the body. Its short stroke is a raised arm, so every pose starts as a cheer.",
    clock: "A stopwatch crown sits on its head like a hat. It turns amber and rings at 9pm.",
    wins: "The logo and the mascot are the same shape. Most ownable, most 'tick'.",
    cost: "The leaning shape is the hardest to pose, and the clock is only the crown.",
  },
  {
    name: "Stopwatch", Tik: TikWatch,
    axis: "A round stopwatch is the body. The ✓ is its grin, set in a dark watch face.",
    clock: "The whole body. Crown on top, side pusher, the button rings amber at 9pm.",
    wins: "Both meanings of 'tick' in one shape. Biggest eyes, best face at 32px.",
    cost: "Round clock characters are a familiar idea, so it's the least ownable.",
  },
  {
    name: "Checkbox", Tik: TikBox,
    axis: "The task box you tap every day, come alive. The ✓ is its hair.",
    clock: "A prop. It carries a ringing stopwatch at 9pm and an invoice when you slip.",
    wins: "Matches the app's UI exactly. Deadpan, the most quietly menacing.",
    cost: "The clock meaning is weakest, and a square sits inside a square app icon.",
  },
];

const TAGLINES = [
  { t: "Tick it or pay for it.", note: "your default" },
  { t: "Every tick counts. Every miss costs." },
  { t: "Your friends are watching. Your wallet's on the line." },
  { t: "Do the thing. Or pay your friend." },
  { t: "The clock's ticking. Are you?", note: "new: clock + tick" },
  { t: "Tick tock. Tick it off.", note: "new: clock + tick" },
];

function Wordmark({ kind, size = 44 }: { kind: "bold" | "mono" | "sticker"; size?: number }) {
  if (kind === "bold") return <span className="wm wm-bold" style={{ fontSize: size }} aria-label="cTicks">c<i>T</i>icks</span>;
  if (kind === "mono") return (
    <span className="wm wm-mono" style={{ fontSize: size * 0.78 }} aria-label="cTicks">
      <span className="dim">c</span>Ticks<span className="cur" aria-hidden="true">_</span>
    </span>
  );
  return <span className="wm wm-sticker" style={{ fontSize: size * 0.62 }} aria-label="cTicks">cTicks</span>;
}

function Variant({ c, n }: { c: Concept; n: number }) {
  const { Tik } = c;
  return (
    <div className="bp-variant">
      <header className="bp-head">
        <div className="bp-kicker">Tik concept {n} of 3</div>
        <h1>{c.name}</h1>
        <p>{c.axis}</p>
        <dl className="bp-facts">
          <div><dt>Clock</dt><dd>{c.clock}</dd></div>
          <div><dt>Wins</dt><dd>{c.wins}</dd></div>
          <div><dt>Costs</dt><dd>{c.cost}</dd></div>
        </dl>
      </header>

      <section className="bp-hero">
        <Tik mood="proud" size={168} />
        <div>
          <Wordmark kind="bold" size={56} />
          <div className="bp-tag">Tick it or pay for it.</div>
        </div>
      </section>

      <h2 className="bp-h2">5 poses · large and 32px</h2>
      <section className="bp-poses">
        {MOODS.map((m) => (
          <figure className="bp-pose" key={m.id}>
            <div className="bp-pose-big"><Tik mood={m.id} size={132} /></div>
            <div className="bp-pose-small">
              <Tik mood={m.id} size={32} still />
              <span className="bp-px">32px</span>
            </div>
            <figcaption><b>{m.label}</b><span>{m.use}</span></figcaption>
          </figure>
        ))}
      </section>

      <h2 className="bp-h2">Wordmark · 3 treatments</h2>
      <section className="bp-marks">
        {(["bold", "mono", "sticker"] as const).map((k) => (
          <div className="bp-mark" key={k}>
            <div className="bp-lockup"><Tik mood="proud" size={44} still /><Wordmark kind={k} size={44} /></div>
            <div className="bp-lockup sm"><Tik mood="proud" size={24} still /><Wordmark kind={k} size={22} /></div>
            <span className="bp-mark-name">
              {k === "bold" ? "Bold · Space Grotesk 700, lime T" : k === "mono" ? "Mono · JetBrains Mono, cursor ticks once a second" : "Sticker · lime pill, for small spots"}
            </span>
          </div>
        ))}
      </section>

      <h2 className="bp-h2">In context</h2>
      <section className="bp-context">
        <div className="bp-phone">
          <div className="top">
            <div>
              <div className="bp-applogo"><Tik mood="proud" size={30} still /><Wordmark kind="bold" size={30} /></div>
              <div className="sub">Round 1 · Day 4 of 7 · ₹100 per miss</div>
            </div>
            <button className="iconbtn" aria-label="Settings" tabIndex={-1}>⚙</button>
          </div>
          <div className="card ledger">
            <h2>The money <span className="tag">₹100 / missed day</span></h2>
            <div className="bp-waiting">
              <Tik mood="sleeping" size={64} />
              <div className="big">Waiting for your friend</div>
            </div>
          </div>
        </div>

        <div className="bp-side">
          <div className="bp-push">
            <div className="bp-push-icon"><Tik mood="proud" size={30} still /></div>
            <div>
              <div className="bp-push-app">cTicks · now</div>
              <b>Zoya is on the board</b>
              <span>First task done: Run 5k (1/3)</span>
            </div>
          </div>
          <div className="bp-push">
            <div className="bp-push-icon"><Tik mood="ticking" size={30} still /></div>
            <div>
              <div className="bp-push-app">cTicks · 9:04 pm</div>
              <b>⏰ Clock&apos;s ticking</b>
              <span>2 left: Gym, 2 LeetCode problems. Finish before midnight or you owe ₹100. Zoya is at 3/3.</span>
            </div>
          </div>
          <div className="bp-icons">
            <figure><div className="bp-appicon"><Tik mood="proud" size={44} still /></div><figcaption>cTicks</figcaption></figure>
            <figure><div className="bp-sil"><Tik mood="proud" size={48} still /><Tik mood="proud" size={24} still /></div><figcaption>silhouette 48 / 24</figcaption></figure>
          </div>
        </div>
      </section>
    </div>
  );
}

export default function BrandHarness() {
  const [current, setCurrent] = useState(0);
  const [nonce, setNonce] = useState(0);
  const [ready, setReady] = useState(false);
  const items = useRef<(HTMLButtonElement | null)[]>([]);
  const hl = useRef<HTMLSpanElement>(null);

  const setActive = useCallback((i: number) => {
    if (i < 0 || i >= CONCEPTS.length) return;
    setCurrent(i);
    setNonce((x) => x + 1);
    const url = new URL(location.href);
    url.searchParams.set("v", String(i + 1));
    history.replaceState(null, "", url);
  }, []);

  const move = useCallback(() => {
    const el = items.current[current];
    if (!el || !hl.current) return;
    hl.current.style.width = el.offsetWidth + "px";
    hl.current.style.transform = `translateX(${el.offsetLeft}px)`;
  }, [current]);

  useLayoutEffect(() => { move(); }, [move]);

  useEffect(() => {
    const v = parseInt(new URLSearchParams(location.search).get("v") || "", 10);
    if (v >= 1 && v <= CONCEPTS.length) setCurrent(v - 1);
    requestAnimationFrame(() => requestAnimationFrame(() => setReady(true)));
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (/^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName) || t.isContentEditable) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      const num = parseInt(e.key, 10);
      if (num >= 1 && num <= CONCEPTS.length) setActive(num - 1);
      else if (e.key === "ArrowRight") setActive((current + 1) % CONCEPTS.length);
      else if (e.key === "ArrowLeft") setActive((current - 1 + CONCEPTS.length) % CONCEPTS.length);
      else if (e.key === "r" || e.key === "R") setNonce((x) => x + 1);
    };
    document.addEventListener("keydown", onKey);
    window.addEventListener("resize", move);
    return () => { document.removeEventListener("keydown", onKey); window.removeEventListener("resize", move); };
  }, [current, setActive, move]);

  return (
    <div className="bp">
      <Variant key={`${current}-${nonce}`} c={CONCEPTS[current]} n={current + 1} />

      <section className="bp-taglines">
        <h2 className="bp-h2">Taglines</h2>
        <ol>
          {TAGLINES.map((x) => (
            <li key={x.t}><span>{x.t}</span>{x.note && <em>{x.note}</em>}</li>
          ))}
        </ol>
      </section>

      <nav className="proto-picker" aria-label="Prototype variants" data-ready={ready ? "" : undefined}>
        <span className="proto-picker-highlight" aria-hidden="true" ref={hl}></span>
        {CONCEPTS.map((c, i) => (
          <button key={c.name} ref={(el) => { items.current[i] = el; }} className="proto-picker-item"
            data-active={i === current ? "" : undefined} aria-current={i === current ? "true" : undefined}
            onClick={() => setActive(i)}>{c.name}</button>
        ))}
        <span className="proto-picker-divider" aria-hidden="true"></span>
        <button className="proto-picker-item proto-picker-replay" aria-label="Replay animation (R)" onClick={() => setNonce((x) => x + 1)}>↻</button>
      </nav>
    </div>
  );
}
