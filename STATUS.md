# STATUS: Pay Up

_Last updated: 19 Nov 2026. Update this file whenever something gets done, tested or found broken._

**State in one line:** the code is complete and the production build passes, but nothing is deployed yet. The next step is the Firebase + Vercel setup (section 3), then the on-phone test plan (section 4).

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

**PWA + push**
- [x] Web manifest, icons (192/512/maskable/apple-touch/badge), standalone display, theme color
- [x] Service worker at `/firebase-messaging-sw.js` (config injected from env), notification click opens/focuses the app
- [x] Android install prompt banner (`beforeinstallprompt`)
- [x] iPhone detection → "Add to Home Screen" instructions when opened in Safari
- [x] Notification permission flow (permission requested first, from the tap, as iOS requires), token saved to `users/{uid}.fcmTokens`, token refreshed quietly on each launch
- [x] `/api/notify`: verifies the Firebase ID token, membership and authorship, dedupes with `pushed: true`, sends FCM, prunes dead tokens
- [x] Cron `/api/cron/reminder` (~9pm IST): warns each player who's still missing today, with what's left and their rival's progress
- [x] Cron `/api/cron/results` (~9am IST): yesterday's misses + running total, final score when a round ends
- [x] Cron routes protected by `CRON_SECRET`

**Security (firestore.rules)**
- [x] Only members read a group's players/feed. Groups can be fetched by code but never listed
- [x] Only you can write your player doc (no ticking for someone else)
- [x] Only **today's** (IST, server time) `checks` key can change, so no backfilling
- [x] Joining can only add *yourself* to `members`. Members can't remove/swap members
- [x] Feed is append-only and you can only post as yourself
- [x] Push tokens are private (`users/{uid}`)

**Docs**
- [x] README (setup), CONTEXT.md (architecture/decisions), docs/USER_FLOW.md (flows + every notification), this file

## 2. What has been tested 🧪

| What | How | Result |
|---|---|---|
| Game logic: date math (month/year rollover, IST day boundary), round phases, both miss rules, deleted-task ids ignored, only finished days count, join date respected, 2- and 3-player ledger netting, streaks | `npm test` (6 tests, `node:test`) | ✅ all pass |
| TypeScript + production build | `next build` (Next 16.4.6, Turbopack) | ✅ compiles, type-checks, 3 API routes + static pages |
| Dashboard UI rendering | Rendered `DashboardView` with sample data in headless Chrome at iPhone size (390×844 @2x), screenshot reviewed | ✅ renders correctly, no console errors |
| "Not configured" state | Loaded `/` with no env vars | ✅ shows setup message instead of crashing |

## 3. Not tested yet ⚠️ (needs a real Firebase project / real phones)

These are written but **have never run against real services**:

- [ ] **Firestore security rules.** Not executed. The Firebase emulator download is blocked in the environment where this was built, so the rules were checked by reading only. Most worth checking: `istToday()` (uses `let` + `duration.value`), the join rule (`members.concat([uid])`), the player update rule (`checks` diff)
- [ ] Sign up / log in / reset email against real Firebase Auth
- [ ] Create + join + live updates between two accounts
- [ ] FCM token generation on **Android Chrome**
- [ ] FCM token generation on **iPhone home-screen app** (iOS 16.4+)
- [ ] Background notifications (app closed / phone locked) on both
- [ ] `/api/notify` on Vercel (service account parsing, sends)
- [ ] Both crons firing on Vercel (check Vercel → Project → Settings → Cron Jobs → logs)
- [ ] Notification tap opens the app
- [ ] Midnight rollover while the app is open

## 4. To do: your next steps 📋

**Setup (one-time, ~15 min). Full clicks in README.md:**
1. [ ] Create Firebase project → enable Email/Password auth → create Firestore (`asia-south1`)
2. [ ] Paste `firestore.rules` into Firestore → Rules → Publish
3. [ ] Register a web app → copy config. Generate a Web Push (VAPID) key. Download a service account JSON
4. [ ] Import this repo on Vercel → add env vars from `.env.example` → Deploy
5. [ ] Firebase Auth → Authorized domains → add the `*.vercel.app` domain

**On-phone test plan (do in order, tick as you go):**
1. [ ] Android: open URL → Install → sign up → create challenge (start **Today** so you can tick)
2. [ ] Android: Turn on notifications → allowed
3. [ ] iPhone: open invite link in Safari → see "Add to Home Screen" banner → add → open from icon
4. [ ] iPhone: sign up → join (code pre-filled) → Android gets a "joined" push
5. [ ] iPhone: Turn on notifications → allowed
6. [ ] Lock the iPhone. On Android tick a task → iPhone gets a push. Swap roles
7. [ ] Clear all tasks → "cleared the day 🔥" push
8. [ ] Nudge → only the other phone gets it. Nudge again right away → "recently" toast
9. [ ] Untick + re-tick → no second push
10. [ ] **Rules check:** in the Firebase console (Firestore → Rules → Rules Playground), simulate an `update` to `groups/CODE/players/<your uid>` that changes yesterday's `checks` key → should be **denied**. Same for writing someone else's player doc
11. [ ] Hit `https://<app>/api/cron/reminder` with header `Authorization: Bearer <CRON_SECRET>` (e.g. `curl -H "Authorization: Bearer $CRON_SECRET" https://<app>/api/cron/reminder`) → the player with open tasks gets the 9pm message. Without the header → 401
12. [ ] Same for `/api/cron/results`
13. [ ] Next morning: check the real 9am push arrived and the grid shows yesterday as ✓/✗

## 5. Known limitations / risks

- **Vercel Hobby cron timing** is ±1h, so the reminder lands between 9 and 10pm IST. Need exact times? Use a free external pinger (cron-job.org / GitHub Actions) hitting the same routes with the `CRON_SECRET` header.
- **"Once per task per day" push dedupe is per device** (`localStorage`). Ticking the same task on two devices could push twice.
- **Nudge cooldown is client-side only.** A determined spammer could bypass it.
- **Feed is never pruned.** Fine for years at 2 people, but there's no cleanup.
- **Members can't leave** a group (only switch away). There's no account deletion screen.
- **Any member can change stake/rule or restart the round.** Fine between friends, everyone is notified, but there's no voting.
- **Timezone is hardcoded to IST** (`lib/logic.ts` `TZ` + `firestore.rules`). Supporting other zones means a per-group timezone and changing both.
- **Task-lock (day 1) is UI-only.** The rules don't stop editing tasks mid-round (the feed and a push announce it, though).
- **iOS can silently drop web-push subscriptions** after long inactivity or if the app is deleted. Re-opening the app refreshes the token.

## 6. Ideas / backlog 💡

- [ ] Proof mode: attach a photo to a tick (Firebase Storage) and the friend can 👍/👎
- [ ] "Freeze" days (e.g. 1 per round, for when you're sick)
- [ ] UPI deep link on the money card (`upi://pay?pa=…&am=…`) to settle in one tap
- [ ] Per-task stakes instead of per-day
- [ ] Weekly history: past rounds and lifetime earnings
- [ ] Emulator test suite for `firestore.rules` (`@firebase/rules-unit-testing`) in CI
- [ ] GitHub Actions: `npm test` + `next build` on every push
- [ ] Exact-time reminders via external cron, and a user-chosen reminder time
