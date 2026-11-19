# Notes for AI coding agents

Before changing anything, read these:

1. **[CONTEXT.md](CONTEXT.md)**: what the app is, architecture, data model, scoring rules, decisions, conventions.
2. **[STATUS.md](STATUS.md)**: what's done, what's tested, what's not, and next steps. **Update it when you finish or test something.**
3. **[docs/USER_FLOW.md](docs/USER_FLOW.md)**: every screen and notification.
4. **[AGENTS.md](AGENTS.md)**: Next.js 16 note (read `node_modules/next/dist/docs/` before framework-level changes).

Ground rules:
- `firestore.rules` is the security boundary. Any new write path needs a rule.
- Keep `lib/logic.ts` pure and covered by `tests/logic.test.ts`. Run `npm test` and `npm run build` before calling something done.
- All dates are IST (`Asia/Kolkata`) in the app, server and rules.
