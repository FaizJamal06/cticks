# CONTEXT: cTicks

> Read this first, whether you're a person or an AI coding agent (Claude Code, Cursor, etc.). It explains what this project is, how it's built, and why it's built that way. For the current state of the work, see [STATUS.md](STATUS.md). For screen-by-screen flows, see [docs/USER_FLOW.md](docs/USER_FLOW.md).

## What it is

cTicks (formerly Pay Up) is a money-on-the-line accountability app for 2–6 friends. Brand, mascot and voice: [docs/BRAND.md](docs/BRAND.md). The original use case is Faiz and one friend in India, one on Android and one on iPhone.

- Each person picks their own list of **daily tasks** (e.g. "Gym 60 min", "2 LeetCode problems").
- A **round** lasts N days (7 / 14 / 21 / 30).
- Each day you tick off what you did. A day where you didn't meet the rule is a **missed day**.
- Every missed day, you owe **the stake** (e.g. ₹100) to **each** other player. The app nets this per pair and shows who owes whom.
- People get **push notifications** for: a friend ticking a task, a friend clearing the day, nudges, a 9pm "you're about to miss" warning, and 9am results.
- The app only keeps score. Money is settled outside the app (UPI).
- **Penalty mode** (per group, changes only from the next round): **Money only** (the above, misses net out per pair) or **Pay or Dare** (default for new groups): every missed day is a *penalty*; the player pays the stake to each other member, or takes a random dare, sends proof to the group chat (never to cTicks) and the group votes. Ignoring a penalty, failing a dare twice and not paying, or missing 3 days in a row gets you **kicked** until the next round. Full rules: [docs/PENALTIES_SPEC.md](docs/PENALTIES_SPEC.md).

## Product decisions (and why)

| Decision | Why |
|---|---|
| **PWA, not native** | One codebase covers Android and iPhone. No App Store, no $99 Apple account. Install with "Add to Home Screen". Real web push works on Android Chrome and on iOS 16.4+ **when the app is installed to the home screen** (Apple's rule). |
| **Email + password auth** | Google sign-in through popups/redirects is unreliable inside an installed iOS PWA. Email/password works everywhere. |
| **Two miss rules** | `all` = leaving any task undone counts as a miss (default, stricter). `none` = only a day with zero tasks done counts. The original ask ("if we miss a day without doing any of the things") could mean either, so the group picks. |
| **Only today can be ticked** | Stops backfilling. Enforced in `firestore.rules` from server time (India time), so a phone's clock can't beat it. |
| **Only you can tick your tasks** | Enforced in `firestore.rules` (`players/{uid}` is writable only by that uid). |
| **All dates are India time (`Asia/Kolkata`)** | Both users are in India, so "today" is identical on client, server and in the rules. Hardcoded in `lib/logic.ts` (`TZ`) and `firestore.rules` (`istToday()`, +330 min). |
| **Invite = 6-char code that is also the group's doc id** | No lookup collection is needed. Rules let a signed-in user `get` (never `list`) a group and add *only themselves* to `members`. |
| **Server composes push text** | The client posts a feed item, and `/api/notify` verifies the ID token, checks membership and authorship, and writes the message. Clients can't send arbitrary pushes. |
| **Vercel Cron (Hobby)** | Free. It allows once per day per job, firing *within* the scheduled hour. So "9pm" really means 9–10pm IST. |
| **Pay or Dare is server-authoritative** | Penalties, dare spins, Done taps, votes, payment marks, tallies and kicks are written only by API routes (admin SDK) after verifying the ID token. Rules give members read-only access. The state machine is one pure reducer (`lib/penalty.ts`) so every transition is unit-tested. |
| **Every Pay or Dare deadline is 9:00am IST** | The cron runs once a day at 9am, so deadlines land exactly when they're enforced ("checked every morning at 9"). 48h to act; vote and retry windows end at the first 9am ≥ 24h away; unconfirmed payments auto-confirm at the first 9am ≥ 48h after "I paid". The server also refuses actions after a deadline. |
| **No uploads, no money** | Dare proof goes to the group chat (WhatsApp/Instagram); payments happen on UPI. cTicks stores only the penalty, the dare text and the votes. Still the free Spark plan. |

## Routes

| Path | What |
|---|---|
| `/` | Landing page (`app/page.tsx`): the one-week story, install steps, FAQ. Static, no Firebase. `/?join=CODE&from=Name` shows the short invite card instead. Signed-in visitors (`payup.auth` flag) and the installed app (`display-mode: standalone`) are sent to `/app` before paint, keeping the query string |
| `/app` | The app (`app/app/page.tsx` → `components/App.tsx`). Manifest `start_url`, notification taps and FCM links all point here |
| `/login`, `/signup` | Redirects (next.config.mjs) to `/app?mode=login` / `/app?mode=signup`; query strings carry over (`?join=CODE`, `?tab=join`) |
| `/api/*`, `/firebase-messaging-sw.js`, `/manifest.webmanifest` | Unchanged; the SW scope is still `/` |

The manifest keeps `id: "/"` so phones that installed the app when `start_url` was `/` are treated as the same app.

## Stack

- **Next.js 16** (App Router, Turbopack) deployed on **Vercel**. Note: Next 16 has breaking changes vs. older versions, and `AGENTS.md` (generated by Next) says to read `node_modules/next/dist/docs/` before changing framework-level code.
- **Firebase**: Auth (email/password), Firestore (realtime listeners), Cloud Messaging (web push). Client SDK `firebase@13`, server `firebase-admin@14`.
- **TypeScript**, React 19, plain CSS (`app/globals.css`, no Tailwind).
- Node **24.x** on Vercel (Firebase 13 requires Node ≥ 24.12).

## Repo map

```
app/
  layout.tsx                    fonts, PWA meta, Open Graph image (/og.png), favicons
  page.tsx                      landing page + invite card (server component; 3 small inline scripts, no client components)
  landing.css                   landing styles + scroll animations (final state is the default; html[data-motion] arms them)
  app/page.tsx                  /app, renders <App/>
  manifest.ts                   PWA manifest (→ /manifest.webmanifest)
  globals.css                   all styles (dark theme, lime #d7ff3a accent, coral #ff5b39 for misses)
  firebase-messaging-sw.js/route.ts   serves the service worker with Firebase config injected from env
  api/notify/route.ts           POST: verify ID token → push a feed event to the other members
  api/penalty/route.ts          POST: Pay or Dare actions (pay, dare, reroll, paid, done, again, vote, got, notgot)
  api/dares/route.ts            POST: dare deck (add with blocklist check, approve, report)
  api/group/route.ts            POST: start the next round (server-side, settles the outgoing round) and rejoin after a kick
  api/version/route.ts          GET: the APP_VERSION this deployment expects (an older open app shows a Reload bar)
  api/cron/reminder/route.ts    GET (Vercel Cron 15:30 UTC ≈ 9pm IST): warn anyone about to miss today
  api/cron/results/route.ts     GET (Vercel Cron 03:30 UTC ≈ 9am IST): yesterday's misses + running total / final score
components/
  App.tsx          auth state → profile → routes to Auth | Onboard | Dashboard; registers SW; remembers ?join=CODE
  Auth.tsx         sign up / log in / reset password
  Onboard.tsx      "Start a challenge" (rules + your tasks) or "Join with code" (lookup → your tasks)
  Dashboard.tsx    container (Firestore listeners, toggle/nudge actions) + DashboardView (pure UI, props only)
  Sheets.tsx       bottom sheets: Settings (stake, rule, new round, switch, log out) and Edit tasks
  Banners.tsx      per-platform setup: install steps (Android prompt / Firefox / Samsung, iPhone per browser), iOS < 16.4,
                   notification setup; InAppBanner ("open in Safari/Chrome" + copy link) for WhatsApp/Instagram/etc.
  TaskEditor.tsx   task list editor + RulePicker
  Toasts.tsx       in-app toasts (window "payup-toast" event, optional Tik mood)
  Penalties.tsx    Pay or Dare cards: your penalty (every state + the dare spin), vote card, confirm-payment card, "You're out" screen
                   (Sheets.tsx also has the Dare deck sheet, the penalty-mode picker and round start via /api/group)
  Tik.tsx          <Tik mood size/> (the mascot) and <Logo/> (Tik + "cTicks" wordmark)
lib/
  logic.ts         PURE game logic shared by client + server: dayKey, round state, isMiss, ledger, streak, 9am deadlines, misses in a row
  penalty.ts       PURE Pay or Dare state machine: step(penalty, event, ctx), tally, planKicks, penaltyLedger (tests/penalty.test.ts)
  dares.ts         PURE dare deck: 25 starter dares, checkDare() blocklist, deckOf(), pickDare()
  penalty-server.ts  server-only: penalty actions in transactions, the 9am check (create, tally, auto-confirm, kick), round start, rejoin
  feed.ts          feed item type + feedLine() (in-app text) + feedPush() (notification text)
  client.ts        browser helpers: postFeed (+ calls /api/notify), push enable/token, toasts, codes, error text
  firebase.ts      client Firebase init from NEXT_PUBLIC_* env
  admin.ts         server-only firebase-admin init + pushTo(uids, msg) (prunes dead tokens)
  cron.ts          cron auth (CRON_SECRET) + allGroups()
  tik.ts           Tik as an SVG string (5 moods). Pure TS, shared by the app, the landing page and the icon script
firestore.rules    security rules: `npx firebase deploy --only firestore:rules` (project in .firebaserc)
firebase.json      Firestore emulator config + rules path
scripts/postinstall.mjs   writes icons from scripts/icons.json → public/, copies Firebase compat libs → public/fb/
scripts/make-icons.mjs    regenerates scripts/icons.json from lib/tik.ts with @resvg/resvg-js (dev dependency):
                          icons 192/512/maskable, apple-touch 180, monochrome badge-72, favicon svg/png/ico, og.png 1200×630.
                          Run: node --experimental-strip-types scripts/make-icons.mjs && node scripts/postinstall.mjs
scripts/fonts/            Space Grotesk Bold (OFL) for the OG image text
tests/logic.test.ts       node:test unit tests for lib/logic.ts (`npm test`)
tests/rules.test.ts       Firestore rules tests in the emulator (`npm run test:rules`, needs Java 21+)
.github/workflows/ci.yml  CI: unit tests, rules tests, firebase-admin load check, build
vercel.json        the two cron schedules
.claude/skills/    Emil Kowalski's design-engineering skills for Claude Code (animate, review-animations,
                   emil-design-eng, break-ui, …). Use them for UI/motion polish. Update: `npx skills update -p`
skills-lock.json   pins the skill versions (restore with `npx skills install`)
```

## Data model (Firestore)

```
users/{uid}                         private to that user (+ server)
  name: string
  groupId?: string                  current challenge code
  fcmTokens: string[]               one per device that enabled push

groups/{CODE}                       CODE = 6 chars from ABCDEFGHJKMNPQRSTUVWXYZ23456789
  code, createdBy, createdAt
  members: uid[]                    max 6; only grows (join adds yourself)
  stake: number (₹ per missed day, per other player)
  rule: "all" | "none"
  days: number                      round length
  start: "YYYY-MM-DD"               first day of current round (IST)
  round: number

groups/{CODE}/players/{uid}         readable by members, writable ONLY by uid
  uid, name
  tasks: { id, text }[]
  checks: { "YYYY-MM-DD": taskId[] }   only today's key may change (rules)
  joined: "YYYY-MM-DD"              days before this never count

groups/{CODE}/feed/{autoId}         append-only; readable by members
  by, kind ("check"|"nudge"|"join"|"round"|"settings"|"tasks"|"mode"; server: "pen"|"kick"|"ended"|"dare"), ts (ms)
  + kind fields: task, n, total, to, open, stake, rule, round, start, days, next, mode, ev, pid, dare, attempt, …
  pushed?: true                     set by the server so a push is sent at most once (server events are written with it)

Pay or Dare (docs/PENALTIES_SPEC.md section 4):
groups/{CODE} also: penaltyMode ("money"|"dare", missing = money), next {penaltyMode, stake, rule} (queued for the next
  round, members write it), and server-only kicked {uid: {round, day, why, owed}}, endedEarly, winner, checkedOn
groups/{CODE}/penalties/{uid}_{day} server-only writes, members read. status open|dare|voting|retry|pay|paid|passed|kicked,
  due (the one deadline the 9am check acts on), stake + payees (snapshots), dare, attempt, voters, tallies, payments {payee: owed|marked|confirmed}
groups/{CODE}/penalties/{id}/votes/{attempt}_{voterUid}   server-only writes, members read
groups/{CODE}/dares/{id}            custom dares (+ override docs for reported starters); server-only writes, members read
```

New rounds don't delete anything. They move `start` and bump `round`. Old `checks` stay in the doc, and scoring only looks at the current round's days.

## Scoring rules (lib/logic.ts)

- `isMiss(g, p, day)`: with `rule="all"`, a day is missed if fewer than all tasks are done. With `rule="none"`, it's missed if zero are done. Tick ids for deleted tasks are ignored.
- **Counted days** are days of the current round that are already over (`day < today`) and on or after `p.joined`. Today never counts until midnight.
- **Ledger**: for each pair (a, b), net = (misses_a − misses_b) × stake. A positive net means a owes b.
- **Streak**: consecutive non-missed days going back from yesterday, plus today if today is already clean with at least one tick.
- Changing `stake` or `rule` mid-round re-scores the whole round (the UI warns about this). **Money only.**
- **Pay or Dare money** (`penaltyLedger`): PAY penalties, and penalties closed by a kick, owe their snapshot stake to each payee; a passed dare owes nothing; nothing nets out. Unfinished penalties are "on the line". Stake and rule changes are queued in `next` and apply at the next round start.
- **Kicks** (`planKicks`): a kick never empties a group (everyone at once → nobody removed, round ends, no winner); one left → `endedEarly` = yesterday, `winner` set. 3 in a row = consecutive calendar days that each have a penalty, since the player last joined.

## Notification pipeline

1. A client action (tick, nudge, join, settings, new round, edit tasks) → `postFeed()` adds a feed doc.
2. `postFeed()` then calls `POST /api/notify { gid, feedId }` with `Authorization: Bearer <Firebase ID token>`.
3. The server verifies the token, the membership, and that `feed.by == caller`. It sets `pushed: true` (dedupe), builds the text with `feedPush()`, and sends it with FCM to the other members (or only to `to` for nudges).
4. Devices: in the background, the service worker (`/firebase-messaging-sw.js`, compat SDK) shows the system notification. In the foreground, the Firestore feed listener shows an in-app toast instead. Server reminders/results arrive via `onMessage` as toasts.
5. Tapping a notification focuses an open `/app` window or opens `/app` (service worker `notificationclick` + `fcmOptions.link`).
6. A tick only pushes **once per task per day per device**: `localStorage` key `payup.told.<gid>.<day>.<taskId>`, so untick/re-tick doesn't spam.
7. **Pay or Dare** events don't go through `/api/notify`: the API route or the 9am check that made the transition writes the feed item (`pushed: true`) and sends the push itself (`penaltyMsgs()` / `penaltyFeed()` in `lib/feed.ts`). A push only goes out when a transaction actually changed something, so double taps and repeated cron runs never repeat it.

## Environment variables

See `.env.example`. `NEXT_PUBLIC_FIREBASE_*` (6 values incl. VAPID) go to the browser. `FIREBASE_SERVICE_ACCOUNT` (full JSON, raw or base64) and `CRON_SECRET` are server-only. The service-worker route is `force-static`, so it's baked at build time: **redeploy after changing Firebase env vars.**

## Conventions

- Keep `lib/logic.ts` pure (no Firebase imports) so it runs in the browser, in API routes and in `node --test`.
- Add new scoring behavior with a test in `tests/logic.test.ts`.
- Never store display names in feed items. Names are resolved from `players/{uid}.name` at render/push time.
- User-facing copy is short, casual and direct. No em dashes in UI strings. The name is always "cTicks" (lowercase c, capital T).
- Tik in the app is small and still (`<Tik mood size/>`); motion and big Tiks belong on the landing page.
- Keep `payup.*` localStorage/sessionStorage keys and the `payup-toast` event name: renaming them would wipe people's state.
- The landing story copies the app's real push text and screens. Change one, change the other (`app/page.tsx`, `docs/WEBSITE_COPY.md`).
- Any new write path needs a matching rule in `firestore.rules`. Rules are the real security boundary.
- Penalty transitions live only in `lib/penalty.ts` `step()`. Add a transition there, with a test, never in a route.
- Bump `APP_VERSION` in `lib/version.ts` in any release that changes what the app writes or which API it calls. Open copies of the older app then show "cTicks was updated. Reload", and the API routes answer them 426 "Close and reopen the app". Deploy rule changes that deny an old write path only after the new app is live in production.
- Push and in-app text never uses gendered pronouns (the app doesn't know anyone's): "Aryaan says the dare is done", not "he did his dare".
- Cron routes accept `?gid=CODE` (with `CRON_SECRET`) to run for one group; use it for tests on previews, which share the production Firebase project.

## Gotchas

- **iPhone push** only works from the home-screen app, and `Notification.requestPermission()` must be the first thing called from a tap (`enablePush` does permission before token).
- Add the Vercel domain to **Firebase Auth → Authorized domains**, or sign-in fails.
- Vercel Hobby cron timing is loose (±1h).
- The public Firebase web config is not a secret. The Firestore rules are what protect the data.
