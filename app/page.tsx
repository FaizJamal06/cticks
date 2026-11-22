// The landing page: a one-week story for signed-out visitors, or a short invite card for /?join=CODE.
// Static and server-rendered. No Firebase and no client components: three small inline scripts do the work.
import type { CSSProperties, ReactNode } from "react";
import Tik, { Logo } from "@/components/Tik";
import type { Mood } from "@/lib/tik";
import "./landing.css";

// Runs before first paint. Signed in (flag set by the app) or opened as the installed app → go to /app.
// Otherwise flag the invite view and, if motion is OK, arm the scroll animations.
const BOOT = `(function(){var d=document.documentElement,q=new URLSearchParams(location.search);
try{if(matchMedia('(display-mode: standalone)').matches||navigator.standalone===true||localStorage.getItem('payup.auth')){d.setAttribute('data-leaving','');location.replace('/app'+location.search);return}}catch(e){}
if((q.get('join')||'').replace(/[^a-z0-9]/gi,'').length===6)d.setAttribute('data-invite','');
if(!matchMedia('(prefers-reduced-motion: reduce)').matches){d.setAttribute('data-motion','');
setTimeout(function(){if(!d.hasAttribute('data-io'))d.removeAttribute('data-motion')},3000)}})()`;

// Fills the invite card (code, friend's name, links) and keeps the code for after sign-up, before first paint.
const INVITE = `(function(){var q=new URLSearchParams(location.search),c=(q.get('join')||'').toUpperCase().replace(/[^A-Z0-9]/g,'');if(c.length!==6)return;
var f=(q.get('from')||'').replace(/[\\u0000-\\u001f\\u007f]/g,'').trim(),$=function(i){return document.getElementById(i)};
// cut to 24 whole characters, never through the middle of an emoji
f=(window.Intl&&Intl.Segmenter?Array.from(new Intl.Segmenter().segment(f),function(x){return x.segment}):Array.from(f)).slice(0,24).join('');
try{sessionStorage.setItem('payup.join',c)}catch(e){}
$('inv-code').textContent=c;if(f)$('inv-name').textContent=f;
$('inv-signup').href='/signup?join='+c;$('inv-login').href='/login?join='+c;})()`;

// One shared IntersectionObserver for everything that reacts to scroll. Its line sits at 70% of the screen height,
// where the week thread's Tik rides. Per element:
// [data-scene] blocks: data-in once (plays the entrance), data-live while on screen (runs Tik's idle loop)
// [data-wk] day markers: data-on once the line has passed them (fills them in; unfills on the way back up)
// [data-past=x]: html[data-x] while the element is above the screen. [data-near=x]: html[data-x] while it's on screen.
// Markers and past-flags are re-read from their positions on every callback, so a jump (Home key, an anchor link)
// can't leave them stale: any jump moves some scene block across the line, which fires a callback.
const SCENES = `(function(){var d=document.documentElement,q=function(s){return document.querySelectorAll(s)},w=q('[data-wk]'),p=q('[data-past]');d.setAttribute('data-io','');
if(!('IntersectionObserver' in window)){q('[data-scene]').forEach(function(e){e.setAttribute('data-in','');e.setAttribute('data-live','')});return}
var io=new IntersectionObserver(function(es){es.forEach(function(e){var t=e.target,k=t.dataset,on=e.isIntersecting;
if(k.scene!=null){if(on)t.setAttribute('data-in','');t.toggleAttribute('data-live',on)}
if(k.near)d.toggleAttribute('data-'+k.near,on)});
var y=innerHeight*.7;w.forEach(function(m){m.toggleAttribute('data-on',m.getBoundingClientRect().top<y)});
p.forEach(function(m){d.toggleAttribute('data-'+m.dataset.past,m.getBoundingClientRect().bottom<0)})},{rootMargin:'0px 0px -30% 0px'});
q('[data-scene],[data-wk],[data-past],[data-near]').forEach(function(e){io.observe(e)})})()`;

/** Entrance delay (and optional rise distance) for an element inside a scene. */
const at = (ms: number, y?: number): CSSProperties => ({ ["--d" as string]: `${ms}ms`, ...(y !== undefined && { ["--y" as string]: `${y}px` }) });

/** A block that plays its entrance when it scrolls into view. */
const Blk = ({ children }: { children: ReactNode }) => <div className="blk" data-scene="" suppressHydrationWarning>{children}</div>;

/** A day on the week thread. `d` is the letter ("" for a plain dot); `className` places it (see landing.css). */
const Wk = ({ d, className = "" }: { d: string; className?: string }) => (
  <i className={`wk ${className}`} data-wk={d} aria-hidden="true" suppressHydrationWarning />
);

function Scene({ id, kicker, title, children, stage, flip, split, shape, marks }: {
  id: string; kicker: string; title: ReactNode; children: ReactNode; stage: ReactNode; flip?: boolean;
  split?: boolean; // the stage is made of <Blk>s that trigger on their own (tall phone mocks on mobile)
  shape?: boolean; // a big faded brand shape drifts behind this scene (landing.css picks it by id)
  marks?: ReactNode; // day markers on the week thread
}) {
  return (
    <section className={`scene${flip ? " flip-side" : ""}${shape ? " has-shape" : ""}`} id={id} aria-labelledby={`${id}-h`}>
      {marks}
      <div className="scene-copy" data-scene="" suppressHydrationWarning>
        <p className="kicker rv" style={at(0, 6)}>{kicker}</p>
        <h2 id={`${id}-h`} className="rv" style={at(40, 16)}>{title}</h2>
        {children}
      </div>
      {split ? <div className="scene-stage">{stage}</div> : <div className="scene-stage" data-scene="" suppressHydrationWarning>{stage}</div>}
    </section>
  );
}

function Notif({ time, title, body, d }: { time: string; title: string; body: string; d: number }) {
  return (
    <div className="notif" style={at(d)}>
      <span className="notif-icon"><Tik mood="proud" size={26} /></span>
      <div>
        <div className="notif-app">cTicks · {time}</div>
        <b>{title}</b>
        <span>{body}</span>
      </div>
    </div>
  );
}

function Lock({ who, time, day, children, buzz }: { who: string; time: string; day: string; children: ReactNode; buzz: number }) {
  return (
    <figure className="lock" style={at(buzz)}>
      <figcaption className="device-label">{who}</figcaption>
      <div className="lock-time">{time}</div>
      <div className="lock-day">{day}</div>
      {children}
    </figure>
  );
}

/** One row of round-grid cells. One char per day: ✓ done, ✗ miss, 🎭 dared away, ? undecided, . not yet, a digit = today (dashed). */
function Cells({ marks }: { marks: string }) {
  return (
    <div className="cells">
      {[...marks].map((m, i) => (
        <div key={i} className={`cell${m === "✓" ? " done" : m === "✗" ? " miss" : m === "🎭" ? " dared" : m === "?" ? " pending" : /\d/.test(m) ? " today" : ""}`}>{m === "." ? "" : m}</div>
      ))}
    </div>
  );
}

/** Tik appears (at d) as one mood, then turns into another (at s). */
function Crossfade({ from, to, size, d, s }: { from: Mood; to: Mood; size: number; d: number; s: number }) {
  return (
    <span className="xfade" style={{ ...at(d), ["--s" as string]: `${s}ms` }}>
      <span className="xf-a"><Tik mood={from} size={size} still={false} /></span>
      <span className="xf-b"><Tik mood={to} size={size} still={false} /></span>
    </span>
  );
}

const DAYS = ["M", "T", "W", "T", "F", "S", "S"];
const THREAD_MOODS: Mood[] = ["proud", "nudge", "ticking", "collector"];

export default function Landing() {
  return (
    <>
      <script dangerouslySetInnerHTML={{ __html: BOOT }} />
      <div className="land">
        <i className="sentinel" data-past="scrolled" aria-hidden="true" />
        <header className="nav">
          <a href="/" className="logo nav-logo" aria-label="cTicks home"><Logo /></a>
          <div className="nav-actions">
            <a href="/signup" className="btn nav-cta">Start your first round</a>
            <a href="/login" className="btn ghost nav-login">Log in</a>
          </div>
        </header>

        {/* ---------- invite version (/?join=CODE) ---------- */}
        <main className="invite has-shape" aria-label="Invite">
          <Tik mood="nudge" size={132} still={false} className="invite-tik" />
          <p className="kicker">You&apos;ve been challenged</p>
          <h1><bdi id="inv-name" suppressHydrationWarning>Your friend</bdi> challenged you on c<i>T</i>icks</h1>
          <p className="lede">Pick your daily tasks, tick them off before midnight, and pay up if you miss a day.</p>
          <div className="inv-code">Invite code <b id="inv-code" suppressHydrationWarning>······</b></div>
          <div className="cta-row">
            <a id="inv-signup" className="btn" href="/signup" suppressHydrationWarning>Sign up to join</a>
            <a id="inv-login" className="btn ghost" href="/login" suppressHydrationWarning>I have an account</a>
          </div>
          <p className="note">
            On iPhone? Add cTicks to your Home Screen first (Share, then Add to Home Screen), open it from the icon, then enter the code.
          </p>
          <a className="text-link" href="/">New here? See how it works</a>
        </main>
        <script dangerouslySetInnerHTML={{ __html: INVITE }} />

        {/* ---------- the story ---------- */}
        <main className="story">
          <section className="scene opening has-shape" id="top">
            <div className="scene-copy" data-scene="" suppressHydrationWarning>
              <p className="kicker rv" style={at(0, 6)}>two kinds of ticks. the ✓ and the clock.</p>
              <h1 className="rv" style={at(40, 18)}>Tick it or pay for it.</h1>
              <p className="lede rv" style={at(120, 8)}>
                Pick your daily tasks. Tick them off before midnight. Miss a day and you owe your friends real money. cTicks keeps the score.
              </p>
              <div className="cta-row rv" style={at(200, 8)} data-past="hero-out">
                <a className="btn" href="/signup">Start your first round</a>
                <a className="btn ghost" href="/signup?tab=join">I have an invite code</a>
              </div>
              <p className="small rv" style={at(260, 6)}>Already playing? <a href="/login">Log in</a></p>
            </div>
            <div className="scene-stage" data-scene="" suppressHydrationWarning>
              <span className="hero-tik rv" style={at(0, 24)}><Tik mood="proud" size={240} still={false} /></span>
            </div>
            <a className="scroll-cue" href="#pact">Here&apos;s how one week goes ↓</a>
          </section>

          {/* The week: one thread runs down every scene from the pact to the round's end, with a Tik riding it. */}
          <div className="week">
          <div className="thread" aria-hidden="true">
            <span className="thread-fill" />
            <span className="thread-tik">{THREAD_MOODS.map((m) => <Tik key={m} mood={m} size={28} className={`m-${m}`} />)}</span>
          </div>

          <Scene id="pact" kicker="the pact" title="Two friends. One week. ₹100 a slip." marks={<Wk d="" className="dot" />} stage={
            <div className="pact">
              <div className="pact-cards">
                <div className="card rv-x" style={{ ...at(280), ["--x" as string]: "-24px" }}>
                  <div className="name">Aryaan</div><div className="sub">3 daily tasks</div>
                </div>
                <span className="vs rv" style={at(420, 0)}>vs</span>
                <div className="card rv-x" style={{ ...at(280), ["--x" as string]: "24px" }}>
                  <div className="name">Shanayaa</div><div className="sub">3 daily tasks</div>
                </div>
              </div>
              <div className="chips rv" style={at(500, 0)}>
                <span className="chip">7 days</span><span className="chip">₹100 / missed day</span><span className="chip">Pay or Dare</span><span className="chip">Finish every task</span>
              </div>
              <Crossfade from="sleeping" to="proud" size={120} d={580} s={1400} />
            </div>
          }>
            <p className="rv" style={at(120, 8)}>
              Aryaan and Shanayaa made a deal. A few promises each, every single day, for seven days. Miss a day and you pay the other one.
            </p>
            <p className="small rv" style={at(180, 6)}>Aryaan and Shanayaa are made up. The excuses are very real.</p>
          </Scene>

          <Scene id="ticks" kicker="step 1" title="Pick your ticks." flip shape stage={
            <div className="card mock rv" style={at(280, 16)}>
              <h2>Your daily tasks</h2>
              <div className="note" style={{ marginTop: 0 }}>Things you&apos;ll do every single day this round. Keep them specific.</div>
              {["Gym", "2 LeetCode problems", "No reels before noon"].map((t, i) => (
                <div className="te-row rv" style={at([540, 620, 680][i], 8)} key={t}>
                  <span className="n">0{i + 1}</span><div className="input">{t}</div>
                </div>
              ))}
              <span className="btn ghost small rv" style={{ ...at(760, 0), display: "inline-block" }}>+ add task</span>
            </div>
          }>
            <p className="rv" style={at(120, 8)}>Everyone sets their own list. Make them small and specific, because you&apos;ll be ticking them every day.</p>
            <p className="small rv" style={at(180, 6)}>Up to 8 tasks each. Shanayaa picked Run 5k, Read 20 pages and Practice guitar.</p>
          </Scene>

          <Scene id="stakes" kicker="step 2" title="Put a price on a bad day." marks={<><Wk d="M" className="late" /><Wk d="T" className="later" /></>} stage={
            <div className="stack">
            <div className="card mock rv" style={at(280, 16)}>
              <h2>The rules</h2>
              <div className="row2">
                <div className="f">STAKE PER MISSED DAY (₹)<div className="input">100</div></div>
                <div className="f">ROUND LENGTH<div className="input">7 days</div></div>
              </div>
              <div className="f">WHAT COUNTS AS A MISSED DAY</div>
              <div className="choice">
                <div className="opt">
                  <b>Finish every task</b><span>Leave even one task undone and that day counts as a miss.</span>
                  <i className="sel" style={at(760)} />
                </div>
                <div className="opt"><b>Do at least one</b><span>It only counts as a miss if you did none of your tasks that day.</span></div>
              </div>
            </div>
            <span className="side-tik rv" style={at(960, 12)}><Tik mood="collector" size={72} still={false} /></span>
            </div>
          }>
            <p className="rv" style={at(120, 8)}>You pick the stake and what counts as a miss. Strict or chill, your call.</p>
            <p className="small rv" style={at(180, 6)}>Rounds run 7, 14, 21 or 30 days. Aryaan and Shanayaa went strict.</p>
          </Scene>

          <Scene id="live" kicker="wednesday, 7:12am" title="Tick it. They'll know." flip split marks={<Wk d="W" />} stage={
            <div className="duo">
              <Blk>
              <figure className="phone rv" style={at(280, 16)}>
                <figcaption className="device-label">Shanayaa&apos;s phone</figcaption>
                <div className="card">
                  <h2>Today · Wednesday <span className="tag">1/3 · 🔥 2</span></h2>
                  <div className="progress"><span className="bar" style={{ width: "33.3%", ...at(700) }} /></div>
                  <div className="task"><span className="box"><span className="box-fill" style={at(700)}>✓</span></span><span className="txt">Run 5k</span></div>
                  <div className="task"><span className="box" /><span className="txt">Read 20 pages</span></div>
                  <div className="task"><span className="box" /><span className="txt">Practice guitar</span></div>
                </div>
              </figure>
              <span className="side-tik rv" style={at(760, 12)}><Tik mood="proud" size={84} still={false} /></span>
              </Blk>
              <Blk>
              <Lock who="Aryaan's phone" time="7:12" day="Wednesday" buzz={1300}>
                <Notif d={900} time="now" title="Shanayaa is on the board" body="First task done: Run 5k (1/3)" />
              </Lock>
              </Blk>
            </div>
          }>
            <p className="rv" style={at(120, 8)}>Shanayaa finishes her run and taps it off. Across town, Aryaan&apos;s phone buzzes.</p>
            <p className="small rv" style={at(180, 6)}>Your friends hear about every tick. Clear the whole list and they get &ldquo;cleared the day 🔥&rdquo;.</p>
          </Scene>

          <Scene id="nudge" kicker="4:02pm" title="Then comes the nudge. 👀" split marks={<Wk d="" className="dot mk-nudge" />} stage={
            <div className="duo">
              <Blk>
              <figure className="phone rv" style={at(280, 16)}>
                <figcaption className="device-label">Shanayaa&apos;s phone</figcaption>
                <div className="card">
                  <div className="friend">
                    <div><div className="name">Aryaan</div><div className="sub" style={{ marginTop: 2 }}>1/3 today · 🔥 2</div></div>
                    <span className="btn small ghost press" style={at(700)}>Nudge 👀</span>
                  </div>
                  <div className="ftasks">
                    <div className="ftask"><span className="dot on" />No reels before noon</div>
                    <div className="ftask"><span className="dot" />Gym</div>
                    <div className="ftask"><span className="dot" />2 LeetCode problems</div>
                  </div>
                </div>
              </figure>
              <span className="side-tik rv" style={at(760, 12)}><Tik mood="nudge" size={84} still={false} /></span>
              </Blk>
              <Blk>
              <Lock who="Aryaan's phone" time="4:02" day="Wednesday" buzz={1250}>
                <Notif d={900} time="now" title="👀 Shanayaa nudged you" body="2 tasks still open today. ₹100 on the line." />
              </Lock>
              </Blk>
            </div>
          }>
            <p className="rv" style={at(120, 8)}>Aryaan still has two tasks open, and Shanayaa can see exactly which ones. One tap.</p>
            <p className="small rv" style={at(180, 6)}>One nudge per friend every 30 minutes. Pressure, not spam.</p>
          </Scene>

          <Scene id="ninepm" kicker="9:04pm" title="Tick tock." flip shape marks={<Wk d="" className="dot mk-9" />} stage={
            <div className="duo solo">
              <Lock who="Aryaan's phone" time="9:04" day="Wednesday" buzz={900}>
                <Notif d={560} time="9:04 pm" title="⏰ Clock's ticking"
                  body="2 left: Gym, 2 LeetCode problems. Finish before midnight or you owe ₹100. Shanayaa is at 3/3." />
              </Lock>
              <span className="big-tik rv" style={at(280, 16)}><Tik mood="ticking" size={150} still={false} /></span>
            </div>
          }>
            <p className="rv" style={at(120, 8)}>Around 9pm, cTicks warns anyone who&apos;s about to miss. Aryaan knocks out his LeetCode. The gym can wait, right?</p>
            <p className="small rv" style={at(180, 6)}>The day ends at midnight, India time. No extensions.</p>
          </Scene>

          <Scene id="miss" kicker="thursday, 9:02am" title="Midnight. That's a miss." split marks={<><Wk d="T" className="mk-thu" /><Wk d="F" className="late" /><Wk d="S" className="later" /></>} stage={
            <div className="stack">
              <Blk>
              <Lock who="Aryaan's phone" time="9:02" day="Thursday" buzz={700}>
                <Notif d={300} time="9:02 am" title="💸 You missed yesterday" body="Pay ₹100 or take a dare. Decide by 9am Sat." />
              </Lock>
              </Blk>
              <Blk>
              <div className="card pen rv" style={at(280, 16)}>
                <h2>Penalty <span className="tag">₹100 / person</span></h2>
                <div className="tik-row pen-head"><Tik mood="collector" size={40} /><div><b>You missed Wednesday.</b><span>Pay ₹100 or take a dare.</span></div></div>
                <div className="deadline">2d left · by 9am Sat</div>
                <div className="row2">
                  <span className="btn ghost">Pay ₹100</span>
                  <span className="btn press" style={at(900)}>Take a dare 🎲</span>
                </div>
                <blockquote className="dare rv" style={{ ...at(1150, 8), marginTop: 12 }}>Sing the chorus of a pop song out loud, full volume.</blockquote>
              </div>
              <span className="side-tik rv" style={at(1300, 12)}><Tik mood="nudge" size={72} still={false} /></span>
              </Blk>
              <Blk>
              <div className="card rv" style={at(280, 16)}>
                <h2>Round 1</h2>
                <div className="dayhead">{DAYS.map((x, i) => <span key={i}>{x}</span>)}</div>
                <div className="grid">
                  <div className="grow">
                    <div className="who">You</div>
                    <div className="cells">
                      <div className="cell done">✓</div><div className="cell done">✓</div>
                      <div className="cell-stack"><div className="cell today">2</div><div className="cell pending flip-in" style={at(600)}>?</div></div>
                      <div className="cell today">0</div><div className="cell" /><div className="cell" /><div className="cell" />
                    </div>
                  </div>
                  <div className="grow"><div className="who">Shanayaa</div><Cells marks="✓✓✓1..." /></div>
                </div>
              </div>
              </Blk>
            </div>
          }>
            <p className="rv" style={at(120, 8)}>The gym did not wait. At midnight Wednesday locks in, and in the morning Aryaan gets a choice: pay Shanayaa ₹100, or take a dare.</p>
            <p className="small rv" style={at(180, 6)}>Proof goes to your group chat. cTicks holds the vote.</p>
          </Scene>

          <Scene id="final" kicker="monday, 9:01am" title="Sunday night, it's over." flip split shape marks={<><Wk d="S" className="mk-sun" /><Wk d="✓" className="end" /></>} stage={
            <div className="stack">
              <Blk>
              <Lock who="Aryaan's phone" time="9:01" day="Monday" buzz={700}>
                <Notif d={300} time="9:01 am" title="🏁 Round 1 is over"
                  body="Everything's settled. Start round 2 in the app." />
              </Lock>
              </Blk>
              <Blk>
              <div className="upi rv" style={at(280, 16)}>
                <span className="upi-tick">✓</span>
                <div><b>₹100 sent to Shanayaa</b><span>in your UPI app, not in cTicks</span></div>
              </div>
              </Blk>
              <Blk>
              <div className="card ledger rv" style={at(280, 16)}>
                <h2>The money <span className="tag">₹100 / missed day</span></h2>
                <div className="big">All settled</div>
                <div className="meta">Missed days this round: you 2 · Shanayaa 1. Settled this round: ₹200.</div>
                <div className="grid ledger-grid">
                  <div className="grow"><div className="who">You</div><Cells marks="✓✓🎭✓✓✗✓" /></div>
                  <div className="grow"><div className="who">Shanayaa</div><Cells marks="✓✓✓✓✗✓✓" /></div>
                </div>
                <span className="btn press next-round" style={at(1300)}>Start the next round</span>
              </div>
              <span className="side-tik"><Crossfade from="collector" to="proud" size={72} d={300} s={1300} /></span>
              </Blk>
            </div>
          }>
            <p className="rv" style={at(120, 8)}>Aryaan sang the chorus, sent the video to the group, and Shanayaa voted it through. That miss cost nothing: 🎭 on the grid.</p>
            <p className="rv" style={at(180, 8)}>Shanayaa slipped on Friday, Aryaan on Saturday. Each paid ₹100 on UPI, one miss at a time. cTicks never touches your money, it just keeps the score honest. Then: round 2.</p>
          </Scene>
          </div>

          <section className="scene cta" id="start" data-scene="" data-near="cta-near" suppressHydrationWarning aria-labelledby="start-h">
            <span className="rv" style={at(0, 20)}><Tik mood="proud" size={150} still={false} /></span>
            <h2 id="start-h" className="rv" style={at(60, 16)}>Your move.</h2>
            <p className="lede rv" style={at(120, 8)}>Pick a friend. Pick your ticks. Put money on it.</p>
            <div className="cta-row rv" style={at(200, 8)}>
              <a className="btn" href="/signup">Start your first round</a>
              <a className="btn ghost" href="/signup?tab=join">I have an invite code</a>
            </div>
            <p className="small rv" style={at(260, 6)}>Free. Android, iPhone and desktop. 2 to 6 people per challenge.</p>
          </section>

          <section className="info" id="install" aria-labelledby="install-h">
            <h2 id="install-h">Put it on your home screen.</h2>
            <p className="lede">cTicks is a web app. No app store, nothing to download. Add it to your home screen so it opens like an app and can send you notifications.</p>
            <div className="install">
              <div className="card">
                <h3>Android <span>Chrome</span></h3>
                <ol>
                  <li><span className="glyph">🌐</span><div>Open cTicks in Chrome.</div></li>
                  <li><span className="glyph"><span className="pill-btn">Install</span></span>
                    <div>Tap <b>Install</b> when it pops up. No pop-up? Tap <b>⋮</b>, then <b>Add to Home screen</b> or <b>Install app</b>.</div></li>
                  <li><span className="glyph app-glyph"><Tik mood="proud" size={30} /></span><div>Open it from your home screen and turn on notifications.</div></li>
                </ol>
              </div>
              <div className="card">
                <h3>iPhone <span>Safari</span></h3>
                <ol>
                  <li><span className="glyph">🧭</span><div>Open cTicks in Safari.</div></li>
                  <li><span className="glyph">
                    <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 3v12M8 7l4-4 4 4M6 11H5v10h14V11h-1" /></svg></span>
                    <div>Tap <b>Share</b> (the square with the arrow), then <b>Add to Home Screen</b>.</div></li>
                  <li><span className="glyph app-glyph"><Tik mood="proud" size={30} /></span><div>Open it from the new icon and turn on notifications.</div></li>
                </ol>
              </div>
            </div>
            <p className="note">On iPhone, notifications only work once cTicks is on your Home Screen. That&apos;s Apple&apos;s rule. You need iOS 16.4 or newer.</p>
            <p className="note">Opened the link inside WhatsApp or Instagram? Open it in Chrome or Safari first. The app&apos;s built-in browser can&apos;t install anything.</p>
          </section>

          <section className="info" id="faq" aria-labelledby="faq-h">
            <h2 id="faq-h">Questions</h2>
            <div className="faq">
              {[
                ["Is it free?", "Yes. No ads, no subscription."],
                ["What's Pay or Dare?", "Miss a day and you choose: pay the stake to each friend, or spin a dare. Do it, send the proof to your group chat, and the group votes in the app. Paying is always an option."],
                ["Who sees my dare video?", "Only the people you send it to. cTicks never sees, uploads or stores videos or photos. Proof goes to your group chat. cTicks holds the vote."],
                ["Can I get kicked out?", "In Pay or Dare, yes: ignore a penalty for 48 hours, fail a dare twice and then don't pay, or miss 3 days in a row. You can rejoin when the next round starts."],
                ["Are the dares safe?", "They're meant to be silly, not risky: sing a chorus, a 30-second dance. Custom dares need a second person's OK, and anything dangerous, illegal or public is off limits. Anyone can report a dare."],
                ["Can we just play for money?", "Yes. Pick Money only when you start a challenge, or switch in settings from the next round."],
                ["Does cTicks move money?", "No. It keeps score and tells you who owes whom. You pay on UPI or however you like."],
                ["Can you cheat?", "Not easily. You can only tick your own tasks, and only today's. “Today” comes from our server in India time, so changing your phone's clock does nothing. If someone edits their task list, everyone gets told."],
                ["Does it work on iPhone?", "Yes, on iOS 16.4 or newer, once you add it to your Home Screen from Safari. Older iPhones can still use it, just without notifications."],
                ["How many people can play?", "2 to 6 per challenge. A missed day costs the stake to every other player, unless you take a dare and it passes."],
                ["Does it work on a laptop?", "Yes, in any modern browser. Notifications work there too."],
                ["When does a day end?", "At midnight, India time. The warning comes around 9pm. Results, new penalties and every Pay or Dare deadline land at 9am."],
              ].map(([q, a]) => (
                <details key={q}><summary>{q}</summary><p>{a}</p></details>
              ))}
            </div>
          </section>
        </main>

        {/* The end of the story: Tik, the wordmark and the closing line. */}
        <footer className="foot">
          <span className="logo foot-logo"><Logo /></span>
          <span className="foot-tag">Tick it or pay for it.</span>
          <p>Keeps score. Never touches your money.</p>
          <a href="/login" className="btn ghost foot-login">Log in</a>
        </footer>

        {/* Phones: the next step stays in reach after the hero, and steps aside while the final CTA is on screen. */}
        <div className="dock">
          <a className="btn" href="/signup">Start your first round</a>
        </div>
      </div>
      <script dangerouslySetInnerHTML={{ __html: SCENES }} />
    </>
  );
}
