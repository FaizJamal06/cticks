# STATUS: Pay Up

_Last updated: 19 Nov 2026. Update this file whenever something gets done, tested or found broken._

**State in one line:** deployed and verified end to end in browsers, including real push delivery; the next step is the on-phone test plan (section 4).

| | |
|---|---|
| Live app | <https://payup-xi.vercel.app> |
| Firebase project | `payup-c1ee8` (Firestore `asia-south1`, Spark plan) |
| Vercel project | `payup`, auto-deploys `main` from `FaizJamal06/payup`, Node 24.x |
| Crons | `/api/cron/reminder` 15:30 UTC (~9pm IST), `/api/cron/results` 03:30 UTC (~9am IST) |
| Secrets | `.env.local` (git-ignored) and Vercel Production env. Service account JSON lives outside the repo |

## 1. Done ✅

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
| Per-platform banners | User-agent emulation: iPhone Safari/Chrome/Edge/Firefox, iOS 16.3, iPhone home screen, Instagram, iOS webview, Android WebView, Facebook, Android Chrome/Firefox/Samsung, desktop Chrome/Edge/Firefox/Safari | ✅ right text each; desktop never told to install |
| In-app Copy link | Clipboard read back after tapping Copy link | ✅ `/?join=CODE` kept |

## 3. Not tested yet ⚠️ (needs real phones)

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

**Setup:** done (Firebase project, rules, auth, FCM, Vercel, env, authorized domain).

**On-phone test plan (do in order, tick as you go):**
1. [ ] Android: open <https://payup-xi.vercel.app> in Chrome → Install → sign up → create challenge (start **Today** so you can tick)
2. [ ] Android: Turn on notifications → allowed
3. [ ] iPhone: open the invite link **in Safari** (from WhatsApp: tap the compass / Open in Safari) → Share → Add to Home Screen → open from the icon
4. [ ] iPhone: sign up → Join with code (type the code if it isn't pre-filled; the home-screen app may not get the link) → Android gets a "joined" push
5. [ ] iPhone: Turn on notifications → allowed
6. [ ] Lock the iPhone. On Android tick a task → iPhone gets a push. Swap roles
7. [ ] Clear all tasks → "cleared the day 🔥" push
8. [ ] Nudge → only the other phone gets it. Nudge again right away → "recently" toast
9. [ ] Untick + re-tick → no second push
10. [ ] Tap a notification → the app opens
11. [ ] Fire the 9pm reminder by hand: `curl -H "Authorization: Bearer $CRON_SECRET" https://payup-xi.vercel.app/api/cron/reminder` → the player with open tasks gets it. Without the header → 401
12. [ ] Same for `/api/cron/results` (sends only after a round day has finished)
13. [ ] Log out on one phone → it stops getting pushes; log back in → it gets them again
14. [ ] Next morning: the real 9am push arrived and the grid shows yesterday as ✓/✗
15. [ ] Mixed group: add a desktop browser (third account or your second device) and check every action reaches every other device

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

## 6. Ideas / backlog 💡

- [ ] Proof mode: attach a photo to a tick (Firebase Storage) and the friend can 👍/👎
- [ ] "Freeze" days (e.g. 1 per round, for when you're sick)
- [ ] UPI deep link on the money card (`upi://pay?pa=…&am=…`) to settle in one tap
- [ ] Per-task stakes instead of per-day
- [ ] Weekly history: past rounds and lifetime earnings
- [ ] Exact-time reminders via external cron, and a user-chosen reminder time
