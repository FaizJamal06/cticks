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
| `proud` | Happy closed eyes, open grin, arm up, sparkles | Task ticked, day cleared, round won, the logo, app icons, CTAs |
| `nudge` | Side-eye, one brow up, poking | Nudges (sent or received), the invite card |
| `ticking` | Wide eyes, worried brows, sweating, crown turns amber and rings | The ~9pm warning, "tasks still open" |
| `collector` | Smug half-lidded eyes, ✓-shaped smirk, holding a ₹ coin | A miss, "You owe…", the results push, round over |
| `sleeping` | Closed eyes, z z z, leaning back | Round not started, empty states, waiting for a friend |

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

## Voice

- Short, punchy, casual. A friend talking, not a bank.
- Indian context: ₹, UPI, India time. Amounts like ₹1,00,000.
- Funny, but the joke never hides the rule. Say exactly what happens and when.
- No em dashes. Use a full stop, a comma or a colon.
- Only true claims. No made-up users, ratings, testimonials or press logos. cTicks keeps score; it never moves money. Say "around 9pm", because the cron fires within the hour.
- Example people are made up (Aryaan and Shanayaa on the landing page).
