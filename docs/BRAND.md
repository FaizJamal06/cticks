# cTicks brand

## Name

**cTicks**: lowercase c, capital T, always one word. Never "Cticks", "CTicks" or "c-Ticks".

"Ticks" means two things, and the copy leans on both:
- the **✓** you tick off every day, and
- the **clock ticking** toward midnight, when today's tasks lock in.

Formerly "Pay Up". The site is <https://cticks.vercel.app> (the old `payup-xi.vercel.app` redirects there). The Firebase project, Firestore paths and `payup.*` storage keys keep the old name on purpose, so no data moves.

## Tagline

**Tick it or pay for it.**

Also fine in context: "The clock's ticking. Are you?" · "Tick tock. Tick it off." · "Every tick counts. Every miss costs."

## Tik, the mascot

An original character, drawn in code (`lib/tik.ts`). Tik's body **is** the ✓: the short stroke is a raised arm, the long stroke is the body, and a **stopwatch crown** sits on its head like a hat. Lime `#d7ff3a`, dark features, two stubby feet, one stubby arm. Not an insect, and not based on any existing character or logo.

Personality: your hype friend, slightly menacing when you slip.

| Mood | Looks like | Use it for |
|---|---|---|
| `proud` | Happy closed eyes, open grin, arm up, sparkles | Task ticked, day cleared, round won, a dare passed, the logo, app icons, CTAs |
| `nudge` | Side-eye, one brow up, poking | Nudges (sent or received), the invite card, the dare spin, waiting for votes, the vote card |
| `ticking` | Wide eyes, worried brows, sweating, crown turns amber and rings | The ~9pm warning, "tasks still open", a penalty with under 12h left, "pay or you're out" |
| `collector` | Smug half-lidded eyes, ✓-shaped smirk, holding a ₹ coin | A miss, an open penalty, "You owe…", confirming a payment, the results push, round over |
| `sleeping` | Closed eyes, z z z, leaning back | Round not started, empty states, waiting for a friend, the "You're out" screen |

Rules:
- In the app Tik is **small and still** (`<Tik mood size />`, 24 to 44px). Big Tiks and idle motion belong on the landing page.
- Tik reads at 32px. Below 48px the extras (sparkles, extra sweat, third z) drop out automatically.
- One Tik per moment. Don't stack moods or recolour Tik; misses are shown with coral elsewhere, not on Tik.
- Icons, favicons, the Android badge and the link preview are all generated from the same drawing (`scripts/make-icons.mjs`).

## Logo

`<Logo />`: a small proud Tik + the wordmark "c**T**icks" in Space Grotesk 700, tight tracking (−0.045em), with the **T in lime**. On the dark background only.

## Colour

| Token | Hex | Use |
|---|---|---|
| `--bg` | `#0f0f0d` | Background everywhere |
| `--card` / `--card2` | `#181816` / `#1f1f1c` | Cards, inputs |
| `--line` | `#2c2c28` | Borders |
| `--ink` | `#f2f0e8` | Text |
| `--mute` | `#8d8b80` | Secondary text |
| `--lime` | `#d7ff3a` | Tik, the brand, done, "owes you" |
| `--coral` | `#ff5b39` | Misses, "you owe" |
| `--amber` | `#ffb23a` | Partial days, Tik's alarm and coin |

## Type

- **Space Grotesk** (400/500/700): headlines, body, the wordmark.
- **JetBrains Mono** (400/600): labels, kickers, codes, small UI text.

## Landing page

All of it lives in `app/landing.css` and `app/page.tsx`. CSS and inline SVG only, no images.

- **Background system** (bottom to top):
  - mood glows per section (`--glow` / `--ga` / `--gx` / `--gy` on each section's `::before`, spilling 25% into its neighbours so colour changes with no edges): lime for the ticks, amber from the nudge to 9pm, coral at the miss, lime at the end,
  - big faded brand shapes on `.has-shape` (watch dial, oversized ✓, stopwatch at 9) drifting with scroll-driven `animation-timeline: view()`, 4–10% opacity,
  - a loose grid of tiny ✓s and dial ticks at 5%, masked out toward the edges,
  - fixed SVG grain at 7%.

  Body text must stay WCAG AA on every glow; check it after any colour change.
- **Spacing tokens:**
  - `--s1`…`--s24` = 4, 8, 12, 16, 20, 24, 32, 48, 64, 96px; use only these.
  - `--rhythm: clamp(64px, 10vh, 128px)` between sections (each pads half top and bottom).
  - One grid: `--maxw: 1120px`, `--gutter` 20px (32px from 600px), edges via `--edge-l` / `--edge-r` (safe-area aware).
  - Type scale `--fs-hero` / `--fs-h1` / `--fs-h2` / `--fs-h3` / `--fs-lede` / `--fs-body` / `--fs-small` / `--fs-kicker` / `--fs-cap`.
- **The week thread:**
  - A 2px line in the left gutter (`--thread-x`) from the pact to the round's end.
  - Day markers (`<Wk>`, `data-wk`) fill lime once the observer line (70% down the screen) passes them.
  - A 28px Tik rides the line with `position: sticky` (no JS) and changes mood at the nudge, 9pm, the miss and the end.
  - Reduced motion: filled line, all markers lit, Tik parked at the end.
- **Header behaviour:**
  - Sticky, 60px + safe area, transparent at the top.
  - `html[data-scrolled]` (set by a sentinel) fades in a blurred bar with a hairline.
  - Log in is a ghost button (44px tall).
  - After the hero's CTA scrolls away (`data-hero-out`), "Start your first round" appears in the header on desktop or as a bottom bar on phones. Both hide while the final CTA is on screen (`data-cta-near`) and never show on the invite card.
- **Motion:** every scene enters the same way: kicker 0ms, heading 40ms (rises furthest), body 120ms, small print 180ms, the stage's lead at 280ms, then the story beats inside the mock. Transform and opacity only, one shared IntersectionObserver.

## Voice

- Short, punchy, casual. A friend talking, not a bank.
- Indian context: ₹, UPI, India time. Amounts like ₹1,00,000.
- Funny, but the joke never hides the rule. Say exactly what happens and when.
- No em dashes. Use a full stop, a comma or a colon.
- Never gendered. The app doesn't know anyone's pronouns, so push and in-app text says "Aryaan says the dare is done", never "he did his dare". (The landing story's made-up characters are the only exception.)
- Pay or Dare copy always says where proof goes and that paying is an option: "Proof goes to your group chat. cTicks holds the vote." Deadlines are always "9am <day>" and "checked every morning at 9".
- Dares are silly, not risky. The starter deck (`lib/dares.ts`) and the dare rules in the deck screen are the reference for tone and safety.
- Only true claims. No made-up users, ratings, testimonials or press logos. cTicks keeps score; it never moves money. Say "around 9pm", because the cron fires within the hour.
- Example people are made up (Aryaan and Shanayaa on the landing page).
