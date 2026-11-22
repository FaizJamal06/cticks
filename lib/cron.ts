import "server-only";
import { adminDb } from "./admin";
import type { Group, Player } from "./logic";

/** Vercel sends `Authorization: Bearer $CRON_SECRET` to cron routes when CRON_SECRET is set. */
export function cronAuthorized(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/** `?gid=CODE` on a cron URL limits the run to that one group (tests on previews never touch real groups). */
export const onlyGroup = (req: Request) => {
  const g = new URL(req.url).searchParams.get("gid");
  return g && /^[A-Z0-9]{6}$/.test(g) ? g : null;
};

/** Every challenge (or just `only`) with its players, in member order. */
export async function allGroups(only?: string | null): Promise<{ group: Group; players: Player[] }[]> {
  const db = adminDb();
  const groups = only ? [await db.doc(`groups/${only}`).get()].filter((g) => g.exists) : (await db.collection("groups").get()).docs;
  return Promise.all(
    groups.map(async (g) => {
      const group = { ...(g.data() as Group), code: g.id };
      const ps = await db.collection(`groups/${g.id}/players`).get();
      const byId = new Map(ps.docs.map((d) => [d.id, { ...(d.data() as Player), uid: d.id }]));
      return { group, players: group.members.map((m) => byId.get(m)).filter(Boolean) as Player[] };
    })
  );
}
