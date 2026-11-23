# STATUS: cTicks (formerly Pay Up)

_Last updated: 23 Nov 2026. Update this file whenever something gets done, tested or found broken._

**State in one line:** cTicks lives at <https://cticks.vercel.app> with **Pay or Dare + eliminations** live (merged 23 Nov, rules phase B deployed). Existing groups stay Money only until someone switches. Next: the Pay or Dare phone test with a real friend (section 4). Spec: [docs/PENALTIES_SPEC.md](docs/PENALTIES_SPEC.md).

| | |
|---|---|
| Live site | <https://cticks.vercel.app> (landing) · <https://cticks.vercel.app/app> (the app) |
| Old domain | `payup-xi.vercel.app` stays attached and 308-redirects to cticks.vercel.app, keeping the path and query (old `?join=` links still work) |
| Firebase project | `payup-c1ee8` (Firestore `asia-south1`, Spark plan) |
| Vercel project | `cticks`, auto-deploys `main` from `FaizJamal06/cticks` (repo renamed from `payup`; old URLs redirect), Node 24.x |
| Crons | `/api/cron/reminder` 15:30 UTC (~9pm IST), `/api/cron/results` 03:30 UTC (~9am IST) |
| Secrets | `.env.local` (git-ignored) and Vercel Production env. Service account JSON lives outside the repo |

## 1. Done ✅

**Pay or Dare + eliminations (23 Nov 2026, merged to `main` at `c93714c`, live)**
- [x] Spec approved with 17 changes to the original rules (docs/PENALTIES_SPEC.md section 0), e.g. the 48h is to *act*, a second rejection means you must pay (not an instant kick), rejected only if more than half of all voters say ❌, deadlines at 9am, no netting
- [x] Pure state machine `lib/penalty.ts` (`step()` for every transition, `tally`, `planKicks`, `penaltyLedger`), dare deck `lib/dares.ts` (25 starter dares, blocklist, pick), 9am deadline helpers + misses-in-a-row in `lib/logic.ts`
- [x] Server: `/api/penalty`, `/api/dares`, `/api/group` (round start + rejoin) and the 9am check in `lib/penalty-server.ts` (create penalties with a 4-day catch-up, tally closed votes, auto-confirm payments, kick on timeout / unpaid / 3 in a row, never empty a group, end the round with a winner). Cron routes take `?gid=` for tests
- [x] Rules deployed in two phases. A (before the merge, additive): penalties/votes/dares read-only for members, server-only group fields, kicked players can't rejoin client-side. B (after the production deploy): members may change only `stake`, `rule` and `next` (in Pay or Dare groups only `next`); starting a round is server-only (`/api/group`)
- [x] App version check: `lib/version.ts` `APP_VERSION` (now 2) + `/api/version`. The app shows a "cTicks was updated. Reload" bar when the server is newer; the API routes answer 426 "Close and reopen the app" to an older app; a denied Settings write shows the same text. Bump `APP_VERSION` in any release that changes write paths
- [x] UI: penalty card in every state with the dare spin, vote card (reasons), confirm-payment card, Pay or Dare money card (unpaid per pair, no netting), grid 🎭 / "?" / kicked rows, "You're out" screen with Rejoin, penalty mode setting (next round only), dare deck sheet; new groups default to Pay or Dare
- [x] Landing: miss beat (penalty push + card + dare), final beat without netting, 5 new FAQ answers; WEBSITE_COPY, CONTEXT, USER_FLOW and BRAND updated
- [x] Preview env: the 8 env vars copied to Vercel Preview; a Protection Bypass for Automation secret lives in `.env.local` only

**Landing polish (22 Nov 2026)**
- [x] Background with depth: grain, a faint ✓ and dial-tick pattern, mood glows that follow the story (lime → amber at 9pm → coral at the miss → lime), big faded brand shapes with scroll-driven drift. All CSS/SVG data URIs. See [docs/BRAND.md](docs/BRAND.md#landing-page)
- [x] The week thread: a line in the left gutter from the pact to the round's end with a marker per day, and a sticky Tik riding it whose mood follows the story
- [x] Spacing tokens on a 4/8px scale, one section rhythm (`clamp(64px, 10vh, 128px)`), one content grid, a type scale. Desktop story 35% shorter
- [x] Sticky header (transparent, then blurred with a hairline) with a ghost Log in button; a compact CTA in the header (desktop) or a bottom bar (phones) after the hero, hidden near the final CTA; the footer closes the story
- [x] One shared IntersectionObserver; the page's own JS grew by 121 bytes gzipped. Reduced motion: filled thread, no drift, no riding Tik

**Domain move (21 Nov 2026)**
- [x] Vercel project renamed `payup` → `cticks`; `cticks.vercel.app` added and made the main domain; `payup-xi.vercel.app` kept as a 308 redirect (path + query kept)
- [x] `metadataBase` (link previews, OG image URL) points at cticks.vercel.app. Share links, the service worker and FCM links use the page's own origin, so they follow the domain by themselves
- [x] Crons are unaffected: Vercel calls them on the deployment's own URL, not a domain

**Rebrand + landing page (21 Nov 2026)**
- [x] Renamed to **cTicks** everywhere users see it (manifest, titles, logo, auth screen, push text, invite share text, banners). Firebase project, Firestore paths, `payup.*` localStorage keys, Vercel domain and GitHub repo unchanged
- [x] Mascot **Tik** (the ✓ is its body, a stopwatch crown is its hat), 5 moods, one SVG source in `lib/tik.ts`, `components/Tik.tsx` in the app (empty states, "Waiting for your friend", round over, round not started, toasts, logo). See [docs/BRAND.md](docs/BRAND.md)
- [x] Landing page at `/`: one-week story in 9 scenes (Aryaan and Shanayaa), install steps, FAQ, footer. Static, no Firebase JS, mocks reuse the app's CSS. Scroll-triggered CSS animations (transform/opacity), reduced motion shows the final state of every scene
- [x] Invite version at `/?join=CODE&from=Name`: "Shanayaa challenged you on cTicks", code, Sign up to join. The app's Share invite now adds `&from=<your name>`; old links fall back to "Your friend"
- [x] Routing: app at `/app`; `/login` and `/signup` open the Auth screen on the right tab (query strings carry over); signed-in visitors and the installed app go from `/` straight to `/app`
- [x] Manifest `start_url` `/app` (with `id: "/"` so existing installs stay the same app); notification taps and FCM links open `/app`
- [x] New icons from Tik (192, 512, maskable, apple-touch, monochrome badge, favicon .svg/.png/.ico) and a 1200×630 link-preview image, generated by `scripts/make-icons.mjs` into `scripts/icons.json`

**App**
- [x] Email/password sign up, log in, password reset
- [x] Create a challenge: stake, round length (7/14/21/30), start today/tomorrow, miss rule (`all` / `none`), your tasks (1–8)
- [x] Join by 6-char code or `?join=CODE` link (code survives sign-up). Max 6 people
- [x] Dashboard: money card (net per pair), today's tasks with progress and streak, friend cards with nudge, round grid, activity feed with "new since last visit"
- [x] Tick/untick today's tasks (atomic `arrayUnion`/`arrayRemove`, no race)
- [x] Edit tasks before the round starts / between rounds / on day 1 until the first tick
- [x] Settings: change stake and rule (with mid-round warning), start a new round (confirm when mid-round), switch challenge, log out
- [x] Invite banner with native share sheet (copy fallback)
- [x] In-app toasts for friends' activity while the app is open
- [x] Dark UI, mobile-first, safe-area aware (notch / home bar)
- [x] Layout holds at 360/390/430px and desktop with 24-char names and 60-char tasks; round grid is one row per week

**PWA + push**
- [x] Web manifest, icons (192/512/maskable/apple-touch/badge), standalone display, theme color
- [x] Service worker at `/firebase-messaging-sw.js` (config injected from env), notification click opens/focuses the app
- [x] Android install prompt banner (`beforeinstallprompt`); Firefox / Samsung Internet get their menu steps instead
- [x] iPhone: "Add to Home Screen" steps for Safari, Chrome, Edge and Firefox; iOS < 16.4 told push needs an update
- [x] In-app browsers (WhatsApp, Instagram, Facebook, Telegram, LinkedIn, Snapchat, Android WebView): "Open in Safari/Chrome" + Copy link that keeps `?join=CODE`
- [x] Notification permission flow (permission requested first, from the tap, as iOS requires), token saved to `users/{uid}.fcmTokens`, token refreshed quietly on each launch
- [x] Several devices per user (one token each). Log out removes this device's token, revokes it (`deleteToken`) and clears `payup.token`; switch challenge keeps it
- [x] `/api/notify`: verifies the Firebase ID token, membership and authorship, dedupes with `pushed: true`, sends FCM, prunes dead tokens
- [x] Cron `/api/cron/reminder` (~9pm IST) and `/api/cron/results` (~9am IST), protected by `CRON_SECRET`

**Security (firestore.rules), deployed**
- [x] Only members read a group's players/feed. Groups can be fetched by code but never listed
- [x] Only you can write your player doc (no ticking for someone else)
- [x] Only **today's** (IST, server time) `checks` key can change, so no backfilling
- [x] Joining can only add *yourself* to `members`. Members can't remove/swap members
- [x] Feed is append-only and you can only post as yourself
- [x] Push tokens are private (`users/{uid}`)
- [x] Player `joined` can't be in the future and never changes; `uid` must match and never changes; `tasks` must be 1–8 items (0 tasks meant you could never miss)
- [x] Group `stake` is a number 1–1,00,000, `rule` is all|none, `days` is 7|14|21|30, `round` is an int, on create and every update

**Tooling**
- [x] `npm run test:rules`: 47 Firestore emulator tests (`tests/rules.test.ts`, needs Java 21+)
- [x] CI (`.github/workflows/ci.yml`): Node 24 + Java 21, `npm ci`, unit tests, rules tests, firebase-admin load check, build
- [x] Emil Kowalski design/animation skills installed for Claude Code (`.claude/skills/`, pinned in `skills-lock.json`)

**Fixed while deploying (19 Nov 2026)**
- [x] Every API route returned 500 on Vercel: `jwks-rsa@4` (under firebase-admin 14) does `require('jose')` but jose 6 is ESM-only. Pinned `jose@4.15.9` for jwks-rsa via `overrides` in package.json
- [x] A fast tap on Join / Lock it in right after sign-up saved a blank name (friends saw "Someone"). Sign-up now writes the name to Firestore before `updateProfile`

## 2. What has been tested 🧪

| What | How | Result |
|---|---|---|
| Game logic (dates, phases, both rules, ledger, streaks) | `npm test` (6 tests, `node:test`), Node 22 and Node 24 | ✅ pass |
| Firestore rules: users, groups get/list/create/delete, joining (self only, no removing, 6 max), member edits, players read/write, today-only `checks`, `joined`/`uid`/`tasks` locks, group field validation, feed | `npm run test:rules` (47 tests in the emulator). Mutation check: loosening each rule makes its tests fail | ✅ 47/47, mutations caught |
| Production build | `next build` locally (Node 22) and on Vercel (Node 24) | ✅ |
| Firebase setup | Email/Password enabled (Identity Toolkit config read), FCM v1 enabled (dry-run send), rules deployed | ✅ |
| Live deploy | curl: `/` 200, manifest 200, service worker 200 with real `payup-c1ee8` config, compat libs + icons 200 | ✅ |
| Cron + notify auth | curl on live: both crons 401 without/wrong secret, 200 with it; `/api/notify` 401 without/bad token | ✅ |
| Both crons registered | Vercel project API: `30 15 * * *` and `30 3 * * *` | ✅ |
| Sign up, create (start today), join via `?join=` link, live join + tick, nudge | Two isolated browser contexts against real Firebase, locally and on the live site | ✅ tick seen by friend in ~0.2s, no console errors |
| `/api/notify` on Vercel with real ID tokens | Same run, responses recorded | ✅ 200 |
| Real push delivery | Headless Chrome, 3 separate profiles on the live site: user A on 2 devices, user B on 1. B changed the stake → `sent: 2`, both of A's devices displayed it with the app closed | ✅ |
| Logout stops pushes on that device only | A logged out on device 2 → token gone from Firestore, push subscription revoked; next push `sent: 1`, only device 1 displayed it | ✅ |
| Dead tokens pruned | Device lost notification permission → Chrome dropped the subscription → next push pruned both dead tokens, valid one kept | ✅ |
| 9pm reminder delivered | curl to `/api/cron/reminder` → `sent: 1`, device displayed "⏰ Clock's ticking · 2 left: Gym, Read…"; the player who was done got nothing | ✅ |
| Layout | 360/390/430 (mobile emulation) and 1280px, 24-char unbreakable names, 8 × 60-char tasks, 30-day round, ₹1,00,000 stake; scanned every element for overflow. Safe areas emulated (47px top, 34px bottom) | ✅ no overflow, 7 cells per row, padding 65px/74px |
| Landing routes | Local dev + prod build: `/` story, `/?join=CODE&from=Name` invite, `/login?join=X` → `/app?join=X&mode=login`, `/signup?tab=join` → `/app?tab=join&mode=signup` | ✅ |
| Redirects from `/` | Signed-in flag set → `/app` (keeps `?join=`); faked `display-mode: standalone` → `/app` | ✅ |
| Invite code survives sign-up | Real sign-up through the invite page against Firebase → Onboard opens on Join with code `K7XQ2M` filled in (test user deleted after) | ✅ |
| Invite worst cases (break-ui) | Long, unbreakable, emoji, Arabic (RTL) and `<script>` names; lowercase/dashed codes, short and junk codes; 320px | ✅ after fixes: emoji no longer cut in half, RTL isolated with `<bdi>`, only 6-char codes show the invite |
| Landing layout | 320 / 390 / 1280px, every element scanned for horizontal overflow; reduced motion shows final states | ✅ no overflow |
| Landing JS | Prod build: 171 KB gzipped (Next/React runtime only, no Firebase); `/app` is 364 KB | ✅ |
| Icons + OG image | Rendered with resvg; badge checked as a white silhouette with the face cut out | ✅ |
| Per-platform banners | User-agent emulation: iPhone Safari/Chrome/Edge/Firefox, iOS 16.3, iPhone home screen, Instagram, iOS webview, Android WebView, Facebook, Android Chrome/Firefox/Samsung, desktop Chrome/Edge/Firefox/Safari | ✅ right text each; desktop never told to install |
| In-app Copy link | Clipboard read back after tapping Copy link | ✅ `/?join=CODE` kept |
| Pay or Dare logic | `npm test`: 53 new tests (every transition and guard in the spec, ties, no votes, retry, second rejection, payments, 3 in a row across a round boundary and with a gap, a group shrinking to 1 and to 0, ledger, deck, blocklist, push text never gendered) | ✅ 59/59 |
| Pay or Dare rules | `npm run test:rules`: 12 new tests (members read, nobody writes penalties/votes/dares from the client, server-only fields, valid `next`, kicked can't rejoin client-side, kicked loses access). Each new rule loosened on purpose fails at least one test | ✅ 59/59 |
| Pay or Dare end to end | Preview deploy, 3 throwaway accounts, 2 test groups, real UI + real API with ID tokens; deadlines moved into the past with the admin SDK, cron called with `?gid=` only. (1) miss → dare → reroll → Done → 2 ✅ → passed; (2) miss → dare → ❌❌ → retry → ❌❌ → must pay → deadline → kicked, owes ₹200; (3) miss → Pay → I paid → both payees confirmed; (4) 3 misses in a row → kicked → group of 1 → round ended early, winner. Also: rejoin refused in the same round and accepted in round 2; re-running the check changes nothing; can't vote on your own dare; no dare once locked; deck permissions; blocklist refuses unsafe dares. Test data deleted afterwards | ✅ |
| Rules phase B | `npm run test:rules` 63/63 (4 new: no direct round start and the doc stays unchanged, Pay or Dare stake/rule only via `next`). Each new rule loosened on purpose fails at least one test | ✅ 63/63 |
| Production rules after the deploy | The ruleset Firestore serves, fetched through the Rules API, is byte-for-byte `firestore.rules`. Then live in production with the client SDK, 2 throwaway accounts and a throwaway group (deleted after): old app creates a group, joins, saves rules in a Money only group → allowed; old app starts a round directly → denied and the group is unchanged; new app queues `next` → allowed; mode / kicked / penalty / dare writes → denied; Pay or Dare group: direct stake change denied, `next` allowed | ✅ 12/12 |
| Production after the merge | Real browser on cticks.vercel.app: landing (thread, no horizontal scroll, no Vercel toolbar), `/app`, a real sign-in, new challenges default to Pay or Dare, no console errors. The round button in preview screenshots is Vercel's preview-only feedback toolbar (`vercel-live-feedback`); production has none | ✅ |
| Real groups untouched | Read-only snapshot before the merge and after the deploy: both groups still Money only, same round, members, ticks digest and money card, no penalty or dare docs | ✅ identical |
| Pay or Dare worst case (break-ui) | 6 members with 24-char, Arabic and emoji names, ₹1,00,000 stake, 120-char dares, 80-char notes, 5 open penalties + 2 votes + 2 confirmations, a kicked player's debt; 320 and 390px | ✅ after fixes: buttons stack instead of wrapping 3 lines, voter names no longer squeezed, names isolated with `<bdi>`; no horizontal scroll, no console errors |
| New domain cticks.vercel.app (21 Nov) | curl + headless Chrome after deploy `c369cce`: `/`, `/app`, invite 200; og:image `https://cticks.vercel.app/og.png`; manifest `cTicks`, id `/`, start_url `/app`; service worker 200 with the `payup-c1ee8` config and `openWindow('/app')`; both crons 401 with no or a wrong secret; `/api/notify` 401; `/app` registers the SW on the new origin, no console errors. The authorised cron call was skipped because it would have pushed to the 3 real players | ✅ |
| Old domain redirect | `payup-xi.vercel.app/?join=K7XQ2M&from=Shanayaa`, `/app`, `/login?join=…`, the SW: all 308 to the same path + query on cticks.vercel.app; in Chrome the old invite link shows the card with "Shanayaa" and code `K7XQ2M` | ✅ |
| Auto-deploy after the Vercel rename | Push of `c369cce` to `main` → production deploy READY on project `cticks` | ✅ |
| Landing polish (22 Nov) | Prod build in Chromium at 320/360/390/430/1440: no horizontal scroll; 0 of 81 text elements below WCAG AA over the glows (pixel-sampled); visible text identical to the previous version; reduced motion; Home/End/anchor jumps leave no day marker wrong; sticky header and riding Tik still stick with `overflow: clip` | ✅ |

## 3. Not tested yet ⚠️ (needs real phones)

- [ ] **Pay or Dare pushes on real phones**: penalty created, dare spun, "says the dare is done", vote result, retry, "says you've been paid", got it / didn't arrive, 2-in-a-row warning, kicked. Test accounts had no devices, so every push in the end-to-end run was `sent: 0`
- [ ] **Share dare** from the iPhone and Android share sheets (and the copy fallback); the spin animation on a real phone
- [ ] **The real 9am run** creating penalties and closing votes in production (it only touches groups in Pay or Dare mode)
- [ ] The "cTicks was updated" Reload bar on a phone (shows the next time `APP_VERSION` is bumped)

- [ ] Install + push on **Android Chrome** (installed) and **iPhone home-screen app** (iOS 16.4+)
- [ ] The "Turn on notifications" **tap** itself (in automated runs permission was pre-granted)
- [ ] Notification tap opens/focuses the app
- [ ] Real WhatsApp / Instagram in-app browsers (detection is user-agent based)
- [ ] Vercel crons firing on schedule (check Vercel → Project → Settings → Cron Jobs → logs after 9pm / 9am IST)
- [ ] 9am results push delivered (route returns 200; it only sends once a round has a finished day)
- [ ] Password reset email arrives
- [ ] Midnight rollover while the app is open

### Device test matrix

✅ = verified (see section 2). "UI emulated" = banner text checked with a faked user agent, not on the device.

| Platform | Install works | Notifications turn on | Push arrives when closed | Tapping the notification opens the app | Logout stops pushes |
|---|---|---|---|---|---|
| Android Chrome (installed) | needs Faiz | needs Faiz | needs Faiz | needs Faiz | needs Faiz |
| Android Samsung Internet | needs Faiz (steps banner UI emulated) | needs Faiz | needs Faiz | needs Faiz | needs Faiz |
| Android Firefox | needs Faiz (steps banner UI emulated) | needs Faiz | needs Faiz | needs Faiz | needs Faiz |
| iPhone Safari (home screen, 16.4+) | needs Faiz (steps banner UI emulated) | needs Faiz | needs Faiz | needs Faiz | needs Faiz |
| iPhone Chrome (home screen) | needs Faiz (steps banner UI emulated) | needs Faiz | needs Faiz | needs Faiz | needs Faiz |
| iPhone opened from a WhatsApp link | needs Faiz (in-app banner UI emulated) | n/a until opened in Safari | n/a | n/a | n/a |
| iPhone below 16.4 | needs Faiz | n/a, no web push before 16.4 (banner UI emulated) | n/a | n/a | n/a |
| Desktop Chrome | n/a (optional) | ✅ token saved (permission pre-granted) | ✅ | needs Faiz | ✅ |
| Desktop Safari | n/a (optional) | needs Faiz | needs Faiz | needs Faiz | needs Faiz |

## 4. To do: your next steps 📋

**Pay or Dare phone test (with a real friend: ~15 minutes, plus waiting for midnight):** a throwaway group, so your real group isn't touched.
1. [ ] Both phones: close and reopen cTicks so it runs the new version; notifications on. Note your real group's code (bottom of the dashboard)
2. [ ] Tick today's tasks in your real group first
3. [ ] Faiz: Settings → Switch challenge → Start a challenge: stake ₹10, 7 days, **Starts Today**, **Pay or Dare**, one task "Test" → share the code
4. [ ] Friend: Settings → Switch challenge → Join with code → one task. Faiz gets "joined"
5. [ ] Both: leave "Test" unticked today (that's the miss). Optional: fire the 9pm reminder for this group → both get "⏰ Clock's ticking … it's pay ₹10 or a dare"
6. [ ] Any time after midnight IST: fire the 9am check for this group (command below) → both get "💸 You missed yesterday. Pay ₹10 or take a dare."
7. [ ] Faiz: Take a dare → the spin → friend gets "🎲 Faiz's dare: …" → Share dare (share sheet) → do it, send it on WhatsApp → Done, I sent the proof → friend gets "🎭 Faiz says the dare is done"
8. [ ] Friend: ❌ with a reason → Faiz gets "❌ Your dare didn't pass" → Faiz: Sent it again → friend: ✅ → both get "✅ Faiz's dare passed"
9. [ ] Friend: Pay ₹10 → pay on UPI (or pretend) → I paid → Faiz gets "💸 … says you've been paid ₹10" → Faiz: Didn't get it → friend gets "🤨 … didn't arrive" → friend: Mark paid again → Faiz: Got it → friend gets "✅ Faiz got your ₹10"
10. [ ] Grid: 🎭 for Faiz, ✗ for the friend. Tap a notification → the app opens
11. [ ] Both: Switch challenge → Join with code → your real group's code. Send me the test group's code and I'll delete it (otherwise the real 9am run keeps processing it)

Fire a cron for one group only (from the repo folder; the secret is read from `.env.local`, never typed or printed):
- bash: `curl -s -H "Authorization: Bearer $(grep '^CRON_SECRET=' .env.local | cut -d= -f2-)" "https://cticks.vercel.app/api/cron/results?gid=CODE"` (`/api/cron/reminder?gid=CODE` for the 9pm one)
- PowerShell: `$s = (Select-String '^CRON_SECRET=' .env.local).Line.Split('=',2)[1]; curl.exe -s -H "Authorization: Bearer $s" "https://cticks.vercel.app/api/cron/results?gid=CODE"`

Existing groups stay Money only; switch yours in Settings → Penalty mode (it starts with your next round).

**Setup:** done (Firebase project, rules, auth, FCM, Vercel, env, authorized domain).
- [x] Firebase Auth → Authorized domains: `cticks.vercel.app` and the `pay-or-dare` preview domain added (22 Nov)
- [x] GitHub repo renamed `payup` → `cticks`; git remote updated; Vercel's Git connection followed the rename (pushes still auto-deploy)

**One-time migration to cticks.vercel.app (21 Nov 2026), on every phone that had the old app:**

The old app lived on `payup-xi.vercel.app`. A browser treats a new domain as a different site, so the old install can't follow: it now just opens the new site in a browser view, and its login and notification setup stay behind. Your challenge, tasks, ticks and money are in Firebase and carry over untouched.

Android (Chrome):
1. [ ] Uninstall the old app: long-press its icon → **Uninstall** (or App info → Uninstall)
2. [ ] Stop the old site's notifications, or you'll get every push twice: Chrome → ⋮ → **Settings** → **Site settings** → **All sites** → `payup-xi.vercel.app` → **Clear & reset** (newer Chrome: **Delete data and reset permissions**) → confirm
3. [ ] In Chrome open <https://cticks.vercel.app> → **Log in** → in the app tap **Install** on the banner (or ⋮ → **Install app** / **Add to Home screen**)
4. [ ] Open cTicks from the new icon → **Turn on notifications** → **Allow**

iPhone (Safari):
1. [ ] Delete the old app: long-press its icon → **Remove App** → **Delete** (its login and notification setup go with it)
2. [ ] In **Safari** open <https://cticks.vercel.app> → Share → **Add to Home Screen** → **Add**
3. [ ] Open cTicks **from the new icon** → **Log in** (the home-screen app doesn't share Safari's login)
4. [ ] **Turn on notifications** → **Allow**

Then one of you ticks a task and the other should get the push once. Expect the activity feed to show everything as "new" one time, and the nudge cooldown to reset (both are kept per site, on the phone). Old invite links keep working; new Share invite links use cticks.vercel.app automatically.

**On-phone test plan (do in order, tick as you go):**
1. [ ] Android: open <https://cticks.vercel.app> in Chrome → the landing page → **Start your first round** → Install → sign up → create challenge (start **Today** so you can tick)
2. [ ] Android: Turn on notifications → allowed
3. [ ] iPhone: open the invite link **in Safari** (from WhatsApp: tap the compass / Open in Safari) → it shows "<your name> challenged you on cTicks" → Share → Add to Home Screen → open from the icon
4. [ ] iPhone: sign up → Join with code (type the code if it isn't pre-filled; the home-screen app may not get the link) → Android gets a "joined" push
5. [ ] iPhone: Turn on notifications → allowed
6. [ ] Lock the iPhone. On Android tick a task → iPhone gets a push. Swap roles
7. [ ] Clear all tasks → "cleared the day 🔥" push
8. [ ] Nudge → only the other phone gets it. Nudge again right away → "recently" toast
9. [ ] Untick + re-tick → no second push
10. [ ] Tap a notification → the app opens
11. [ ] Fire the 9pm reminder by hand: `curl -H "Authorization: Bearer $CRON_SECRET" https://cticks.vercel.app/api/cron/reminder` → the player with open tasks gets it. Without the header → 401
12. [ ] Same for `/api/cron/results` (sends only after a round day has finished)
13. [ ] Log out on one phone → it stops getting pushes; log back in → it gets them again
14. [ ] Next morning: the real 9am push arrived and the grid shows yesterday as ✓/✗
15. [ ] Mixed group: add a desktop browser (third account or your second device) and check every action reaches every other device
16. [ ] Paste the live link into WhatsApp: the preview shows Tik, "cTicks" and the tagline

## 5. Known limitations / risks

- **Vercel Hobby cron timing** is ±1h, so the reminder lands between 9 and 10pm IST. Need exact times? Use a free external pinger (cron-job.org / GitHub Actions) hitting the same routes with the `CRON_SECRET` header.
- **"Once per task per day" push dedupe is per device** (`localStorage`). Ticking the same task on two devices could push twice.
- **Nudge cooldown is client-side only.** A determined spammer could bypass it.
- **Feed is never pruned.** Fine for years at 2 people, but there's no cleanup.
- **Members can't leave** a group (only switch away). There's no account deletion screen.
- **Any member can change stake/rule or restart the round.** Fine between friends, everyone is notified, but there's no voting.
- **Timezone is hardcoded to IST** (`lib/logic.ts` `TZ` + `firestore.rules`). Supporting other zones means a per-group timezone and changing both.
- **Task lock is UI-only.** The rules require 1–8 tasks, but a player can still silently swap to one easy task mid-round with a crafted write (a normal edit posts to the feed and pushes).
- **iOS can silently drop web-push subscriptions** after long inactivity or if the app is deleted. Re-opening the app refreshes the token.
- **`jose` is pinned to 4.15.9 for `jwks-rsa`** (`overrides` in package.json, firebase/firebase-admin-node#3181). Drop it once firebase-admin ships a jwks-rsa that loads jose with `import()`. CI fails if firebase-admin can't load without `require(esm)`.
- **A stake above ₹1,00,000** is refused by the rules but the app shows the generic "Not allowed" message.
- **Joining near midnight with a phone clock running ahead** can be refused until real midnight (`joined` can't be after today in IST).
- **In-app browser detection is by user agent.** WhatsApp on iPhone often opens links in an in-app Safari view that looks exactly like Safari, so no banner shows; the Safari install steps say "open it in Safari first" for that case.
- **Install steps for Firefox / Samsung Internet / iPhone browsers** follow today's menu layouts and may drift.
- **First push token on a new device can take 8+ seconds** (Firebase Installations + FCM registration).
- **Revoking notification permission kills the token**; it's pruned on the next push. Turning permission back on and opening the app re-registers.
- **`pushTo` also prunes on `invalid-argument`**, which FCM can return for a bad payload, not only a bad token. With `saveToken`'s `payup.token` short-circuit, a device whose token was pruned that way won't re-add it until the token changes (log out and in fixes it).
- **Logout cleanup is capped at 4s** so a dead network can't block it; a token that slips through is pruned once FCM rejects it.
- **Local Node is 22** on the dev laptop; firebase 13 wants ≥24.12. Everything passes on 22 with engine warnings; Vercel and CI use 24.
- **`npm audit`** flags `@grpc/grpc-js` under firebase; the only "fix" is downgrading firebase.

- **An app that was open before a release keeps its old code until it's reopened.** There's no offline cache (the service worker only does pushes), so any launch loads the new code. A copy left open across the Pay or Dare release that tries to start a round is denied by the rules and shows its old generic "Not allowed" message once; nothing is written. From this release on, the Reload bar and the 426 answer cover it.
- **Pay or Dare deadlines are enforced by the 9am cron** (Vercel Hobby fires within the hour). The server refuses actions after a deadline even before the check runs, so the consequence can land up to an hour after 9am.
- **In a 2-person Pay or Dare group the only voter decides.** A second rejection only forces paying (never a direct kick), so the worst a hostile voter can do is make you pay the normal stake.
- **The dare blocklist is a word list**, not moderation. The real safeguards are a second member's OK and the report button.
- **The dashboard listens to up to 500 penalties per group.** Fine for years at 2–6 people; filter by round if it ever grows.
- **Previews share the production Firebase project.** Test only with test accounts and `?gid=`-scoped cron calls; preview deploys also show Vercel's toolbar (not part of the app).
- **`/` forwards signed-in people using a `payup.auth` flag** the app sets in localStorage. Someone signed in from before the rebrand who opens `/` in a browser sees the landing page once; tapping Log in takes them into the app, which sets the flag.
- **Installs from `payup-xi.vercel.app` stopped being the app** when the domain moved: they open the new site in a browser view. Re-install from cticks.vercel.app (migration steps in section 4).
- **Push tokens from the old domain stay in `users/{uid}.fcmTokens`** until FCM rejects them. While the old site still has notification permission on a phone, that phone gets each push twice (once via the old site). Clearing the old site's data, or deleting the old iPhone app, kills the token and the next push prunes it.
- **The landing story is hand-written copy** that mirrors the app's real push text and screens. If notification wording or the UI changes, update `app/page.tsx` and `docs/WEBSITE_COPY.md` to match.
- **Landing JS is the Next/React runtime (~171 KB gz).** Our own landing code is three small inline scripts. Going lower would mean serving `/` as plain HTML outside Next.
- **Landing: the brand shapes' drift uses CSS scroll-driven animations** (Chrome/Edge, Safari 26+). Firefox shows them still. The blurred header and sticky Tik are verified in Chromium only; check them on a real iPhone.
- **The friend's name on the invite page comes from the link** (`&from=`), not the database, so anyone can craft a link with any name. It's shown as plain text and the code is still checked on join.

## 6. Ideas / backlog 💡

- [ ] Proof mode: attach a photo to a tick (Firebase Storage) and the friend can 👍/👎
- [ ] "Freeze" days (e.g. 1 per round, for when you're sick)
- [ ] UPI deep link on the money card (`upi://pay?pa=…&am=…`) to settle in one tap
- [ ] Per-task stakes instead of per-day
- [ ] Weekly history: past rounds and lifetime earnings
- [ ] Exact-time reminders via external cron, and a user-chosen reminder time
