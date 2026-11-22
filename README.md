# cTicks ✓

*Tick it or pay for it.* (Formerly Pay Up.) An accountability app for you and your friends. Each person picks a few daily tasks. Tick them off every day. Miss a day and you owe everyone else the stake. It's an installable app (PWA) that sends real push notifications to Android and iPhone.

- **Live ticks**: your friend gets a push the moment you finish a task ("Faiz is on the board · First task done: Gym (1/3)") and when you clear the day.
- **Nudges**: poke someone who still has tasks open.
- **9pm warning**: a push if you're about to miss today, saying how much you'd owe.
- **9am results**: who missed yesterday and the running total. At the end of a round, the final settle-up.
- **No cheating**: you can only tick *your own* tasks, and only *today's* (India time). Both are enforced by Firestore security rules, not just the UI.
- Two rules to choose from: *finish every task*, or *do at least one*. Pick 7/14/21/30-day rounds, up to 6 people.

**Docs:** [CONTEXT.md](CONTEXT.md) (architecture and decisions) · [STATUS.md](STATUS.md) (done / tested / to do) · [docs/USER_FLOW.md](docs/USER_FLOW.md) (screens and notifications) · [docs/BRAND.md](docs/BRAND.md) (name, Tik the mascot, voice) · [docs/WEBSITE_COPY.md](docs/WEBSITE_COPY.md) (landing page copy)

The landing page is at `/`, the app at `/app`.

**Stack:** Next.js 16 (App Router) on Vercel · Firebase Auth + Firestore (realtime) · Firebase Cloud Messaging (web push) · Vercel Cron.

---

## Setup (~15 minutes, all free)

### 1. Firebase project
1. Go to <https://console.firebase.google.com> → **Add project** (you can turn Analytics off).
2. **Build → Authentication → Get started → Email/Password → Enable.**
3. **Build → Firestore Database → Create database** → choose a location near you (e.g. `asia-south1`, Mumbai) → start in **production mode**.
4. Deploy the rules: `npx firebase deploy --only firestore:rules` (or paste [`firestore.rules`](firestore.rules) into Firestore → **Rules** → **Publish**).
5. **Project settings (⚙) → General → Your apps → Web (`</>`)** → register an app called "cTicks" (no hosting needed). Copy the config values.
6. **Project settings → Cloud Messaging → Web Push certificates → Generate key pair.** Copy the key. This is your VAPID key.
7. **Project settings → Service accounts → Generate new private key.** This downloads a JSON file. Keep it secret and never commit it.

### 2. Get the code
It's already on GitHub at `FaizJamal06/cticks` (private; renamed from `payup`). To work on it locally: `git clone https://github.com/FaizJamal06/cticks && cd cticks && npm install`.

### 3. Deploy on Vercel
1. <https://vercel.com/new> → import the `cticks` repo.
2. Add the environment variables listed in [`.env.example`](.env.example):
   - the six `NEXT_PUBLIC_FIREBASE_*` values from steps 5–6
   - `FIREBASE_SERVICE_ACCOUNT`: the **entire** contents of the JSON from step 7, pasted as one value
   - `CRON_SECRET`: any long random string (e.g. run `openssl rand -hex 24`)
3. Click **Deploy**. Vercel picks up the two daily cron jobs from `vercel.json` by itself.
4. Back in Firebase: **Authentication → Settings → Authorized domains → Add domain** → your `something.vercel.app` domain.

### 4. Get both phones set up
| | Android (Chrome) | iPhone (Safari, iOS 16.4+) |
|---|---|---|
| Install | Open the link → tap **Install** (or ⋮ → *Add to Home screen*) | Open the link → **Share** → **Add to Home Screen** |
| Notifications | Open the app → **Turn on notifications** | Open it **from the home-screen icon** → **Turn on notifications** |

One person creates the challenge and taps **Share invite**. The other person signs up and enters the 6-letter code, or just opens the shared link.

> On iPhone, push notifications **only** work in the home-screen version. That's an Apple rule. The app shows the steps if you open it in Safari.

---

## Local development
```bash
cp .env.example .env.local   # fill it in
npm install
npm run dev                  # http://localhost:3000 (landing) and /app (the app)
npm test                     # game-logic tests
npm run test:rules           # Firestore rules in the emulator (needs Java 21+)
node --experimental-strip-types scripts/make-icons.mjs && node scripts/postinstall.mjs   # after changing Tik: rebuild icons + OG image
```
Push needs HTTPS or localhost. For testing on a real phone, use the Vercel deployment.

## How it works
```
app/                 UI shell, manifest, /firebase-messaging-sw.js (service worker built from env)
app/api/notify       verifies the sender's Firebase ID token → pushes the event to the others
app/api/cron/*       9pm reminder + 9am results (Vercel Cron, guarded by CRON_SECRET)
components/          Auth, Onboard (create/join), Dashboard, Settings sheets, install/push banners
lib/logic.ts         pure game logic: days (Asia/Kolkata), misses, ledger, streaks. Shared by client + server
lib/feed.ts          activity feed lines + push notification text
firestore.rules      who can read/write what; "today only" and "only your own ticks" are enforced here
```

**Data model:** `groups/{code}` holds members, stake, rule, round dates. `groups/{code}/players/{uid}` holds tasks plus `checks: { "YYYY-MM-DD": [taskIds] }`. `groups/{code}/feed/*` is the append-only activity feed. `users/{uid}` holds your name, current group, and push tokens (private to you).

**Notes**
- On Vercel's free Hobby plan a cron fires somewhere *within* its scheduled hour, so the "9pm" reminder lands between about 9:00 and 10:00 pm IST.
- Changing the stake or rule mid-round re-scores the whole round. The app warns about this, and everyone gets notified.
- Money isn't moved for you. The app keeps score, and you settle up over UPI.
