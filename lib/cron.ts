import "server-only";
import { adminDb } from "./admin";
import type { Group, Player } from "./logic";

/** Vercel sends `Authorization: Bearer $CRON_SECRET` to cron routes when CRON_SECRET is set. */
export function cronAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/** Every challenge with its players, in member order. */
export async function allGroups(): Promise<{ group: Group; players: Player[] }[]> {
  const db = adminDb();
  const groups = await db.collection("groups").get();
  return Promise.all(
    groups.docs.map(async (g) => {
      const group = { ...(g.data() as Group), code: g.id };
      const ps = await db.collection(`groups/${g.id}/players`).get();
      const byId = new Map(ps.docs.map((d) => [d.id, { ...(d.data() as Player), uid: d.id }]));
      return { group, players: group.members.map((m) => byId.get(m)).filter(Boolean) as Player[] };
    })
  );
}
