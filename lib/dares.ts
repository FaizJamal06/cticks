// The dare deck for Pay or Dare. Pure TS (no Firebase): used by the API routes, the app and the tests.
// Deck = starter dares (below) + custom dares a second member approved, minus anything reported.

export type Dare = { id: string; text: string };
/** A custom dare, or a starter dare someone reported (then a doc with the starter's id exists). */
export type DareDoc = {
  text: string;
  by: string; // uid, or "cticks" for a starter
  createdAt: number;
  approvedBy: string | null; // null = waiting for a second member's OK
  active: boolean;
  reported: { by: string; at: number; reason?: string } | null;
};

/** Silly, safe, about 30 seconds at home, filmed for the group only. ids s01–s25 are stable. */
export const STARTER: Dare[] = [
  "Sing the chorus of a pop song out loud, full volume.",
  "Film a 30-second dance to a song the group picks.",
  "Crack a raw egg on your head (in the shower or outside).",
  "Talk in an accent the group picks for a 1-minute video.",
  "Perform a dramatic poem about the task you missed.",
  "20 push-ups on camera (knee push-ups count).",
  "Commentate your missed day like a cricket match, for 30 seconds.",
  "Wear socks on your hands while explaining why you missed.",
  "Sing \"Happy Birthday\" to the task you skipped.",
  "Hold a plank for 30 seconds while saying the alphabet.",
  "Catwalk across your room to dramatic music.",
  "Act out a famous Bollywood dialogue scene, solo.",
  "Narrate your room like a nature documentary for 30 seconds.",
  "Make a 30-second advert for the task you skipped.",
  "Speak only in rhymes for a 1-minute video.",
  "Draw a portrait of someone in the group in 60 seconds with your other hand, and send it.",
  "30 jumping jacks while singing a nursery rhyme.",
  "Put on your most mismatched outfit and give a 20-second fashion review of it.",
  "Walk across the room with a book balanced on your head.",
  "Read a news headline in the most dramatic newsreader voice you can.",
  "Play a 30-second air-guitar solo, full commitment.",
  "Give your task list a heartfelt 30-second apology.",
  "Do your best villain laugh three times, each louder than the last.",
  "Make a paper hat, wear it, and explain your miss in it.",
  "Talk in slow motion for 30 seconds.",
].map((text, i) => ({ id: `s${String(i + 1).padStart(2, "0")}`, text }));

export const isStarter = (id: string) => /^s\d{2}$/.test(id);
export const MAX_DARE = 120;

/** The rules shown when adding a dare, in the same order as the checks. */
export const DARE_RULES = [
  "Nothing that could hurt anyone: fire, heights, sharp or hot things, choking, extreme cold or heat, eating non-food, or extreme amounts or spice.",
  "No alcohol or drugs.",
  "No vehicles.",
  "Nothing illegal.",
  "No nudity or sexual stuff.",
  "No strangers, and no pranks on anyone who didn't agree.",
  "No damaging things.",
  "Never post it publicly. Proof goes to your group only.",
];

// A basic word filter, one list per rule above (English plus common Hinglish). Whole-word-ish matching.
// ponytail: a word list, not moderation. The real safeguards are a second member's OK and the report button.
const BLOCK: [number, string[]][] = [
  [0, ["fire", "flame", "burn", "lighter", "matchstick", "light a match", "candle", "firecracker", "patakha", "knife", "knives", "blade", "razor", "scissors",
    "needle", "broken glass", "eat glass", "roof", "terrace", "balcony", "ledge", "cliff", "bridge", "jump off", "climb", "boiling", "hot iron", "stove", "hot oil",
    "choke", "choking", "hold your breath", "strangle", "ice bath", "freezing", "frozen", "chilli", "chili", "mirchi", "ghost pepper",
    "hot sauce", "carolina reaper", "bleach", "detergent", "soap", "tide pod", "shampoo", "pills", "tablets", "electric", "socket", "wire",
    "gun", "weapon", "faint", "blackout", "chug", "whole bottle", "gallon", "litre of", "liter of", "raw chicken", "cinnamon challenge"]],
  [1, ["alcohol", "beer", "vodka", "whisky", "whiskey", "rum", "wine", "tequila", "drunk", "daaru", "daru", "sharab", "peg", "weed", "ganja",
    "joint", "drug", "drugs", "cocaine", "smoke", "smoking", "cigarette", "cigar", "vape", "hookah", "bhang", "charas"]],
  [2, ["drive", "driving", "car", "bike", "scooter", "motorcycle", "cycle", "traffic", "highway", "road", "train track", "train tracks", "metro track"]],
  [3, ["steal", "shoplift", "illegal", "trespass", "police", "cops", "fake id", "vandal"]],
  [4, ["naked", "nude", "nudes", "strip", "topless", "underwear", "sex", "sexy", "boobs", "kiss", "lap dance", "nsfw"]],
  [5, ["stranger", "strangers", "random person", "random people", "prank", "pranks", "passerby", "neighbour", "neighbor", "call your boss",
    "call your ex", "text your ex", "propose to"]],
  [6, ["smash", "break", "breaking", "damage", "graffiti", "spray paint", "throw your phone", "set off"]],
  [7, ["post it", "post on", "upload", "instagram story", "insta story", "whatsapp status", "reel", "tiktok", "youtube", "go live", "public",
    "publicly", "tweet"]],
];

const norm = (s: string) => ` ${s.toLowerCase().replace(/[^a-z0-9ऀ-ॿ]+/g, " ").trim()} `;

/** Cleans a custom dare and checks it. `rule` is the index into DARE_RULES that it broke. */
export function checkDare(raw: string): { ok: true; text: string } | { ok: false; error: string; rule?: number } {
  const text = String(raw ?? "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (text.length < 8) return { ok: false, error: "Make it a full dare (at least 8 characters)." };
  if (text.length > MAX_DARE) return { ok: false, error: `Keep it under ${MAX_DARE} characters.` };
  const n = norm(text);
  for (const [rule, words] of BLOCK)
    if (words.some((w) => n.includes(` ${w} `))) return { ok: false, rule, error: `That one breaks a rule: ${DARE_RULES[rule]}` };
  return { ok: true, text };
}

/** The live deck: starters that aren't reported, plus approved custom dares that are active. */
export function deckOf(docs: Record<string, DareDoc>): Dare[] {
  const starters = STARTER.filter((s) => !docs[s.id] || docs[s.id].active);
  const custom = Object.entries(docs)
    .filter(([id, d]) => !isStarter(id) && d.active && d.approvedBy)
    .map(([id, d]) => ({ id, text: d.text }));
  return [...starters, ...custom];
}

/** A random dare, never `exclude`, preferring ones this player hasn't had this round. `rand` returns [0, 1). */
export function pickDare(deck: Dare[], opts: { exclude?: string; avoid?: string[]; rand: () => number }): Dare | null {
  const pool = deck.filter((d) => d.id !== opts.exclude);
  if (!pool.length) return null;
  const fresh = pool.filter((d) => !opts.avoid?.includes(d.id));
  const from = fresh.length ? fresh : pool;
  return from[Math.min(from.length - 1, Math.floor(opts.rand() * from.length))];
}
