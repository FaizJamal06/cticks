// Tik, the cTicks mascot, as an SVG string. One source for the app (components/Tik.tsx),
// the landing page and the icon generator (scripts/make-icons.mjs), so every Tik is identical.
// The ✓ is the body, its short stroke is a raised arm, and a stopwatch crown sits on its head.
// Pure TS, no imports: it runs in the browser, on the server and under `node --experimental-strip-types`.

export type Mood = "proud" | "nudge" | "ticking" | "collector" | "sleeping";
export const MOODS: Mood[] = ["proud", "nudge", "ticking", "collector", "sleeping"];

export const LIME = "#d7ff3a", DARK = "#0f0f0d", INK = "#f2f0e8", AMBER = "#ffb23a", MUTE = "#8d8b80";

type Pal = { lime: string; dark: string; ink: string; amber: string; mute: string; drop: string; rim: string };
const COLOR: Pal = { lime: LIME, dark: DARK, ink: INK, amber: AMBER, mute: MUTE, drop: "#bfe8ff", rim: "#c7861c" };
// Monochrome: body white, features black, then the whole thing is used as a mask (Android status-bar badge).
const MONO: Pal = { lime: "#fff", dark: "#000", ink: "#000", amber: "#fff", mute: "#fff", drop: "#fff", rim: "#000" };

const ln = (d: string, c: string, w: number, cls = "") =>
  `<path d="${d}" stroke="${c}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" fill="none"${cls ? ` class="${cls}"` : ""}/>`;
const rupee = (c: string, w: number) => ln("M-3.5 -5 H3.5 M-3.5 -2.2 H3.5 M-3.5 -5 H-1.2 C2.6 -5 2.6 0.8 -1.2 0.8 H-3.5 L2.6 6.5", c, w);
const spark = (x: number, y: number, s: number, c: string) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path class="tk-spark" d="M0 -3.4 L0.9 -0.9 L3.4 0 L0.9 0.9 L0 3.4 L-0.9 0.9 L-3.4 0 L-0.9 -0.9Z" fill="${c}"/></g>`;
const drop = (x: number, y: number, s: number, c: string) =>
  `<g transform="translate(${x} ${y}) scale(${s})"><path class="tk-drip" d="M0 -4.2 C2.6 -0.8 3 0.8 3 2 A3 3 0 0 1 -3 2 C-3 0.8 -2.6 -0.8 0 -4.2Z" fill="${c}"/></g>`;
const zs = (x: number, y: number, n: number, c: string) =>
  `<g transform="translate(${x} ${y})">` +
  [[0, 6, 0.8], [5, 0, 1.05], [11, -6, 0.75]].slice(0, n)
    .map(([dx, dy, s], i) => `<g transform="translate(${dx} ${dy}) scale(${s})"><g class="tk-z" style="animation-delay:${i * 0.8}s">${ln("M0 0 H4.5 L0 4.5 H4.5", c, 1.7)}</g></g>`)
    .join("") + `</g>`;

const CHECK = "M11 32 L24 45 L50 16";
const ARM: Record<Mood, string> = {
  proud: "M44 33 L53 24.5",
  nudge: "M44.5 34 L57 34",
  ticking: "M45 33 L55 30",
  collector: "M44 35 L52.5 32",
  sleeping: "M44 35 L51.5 39.5",
};

function face(mood: Mood, p: Pal) {
  const { dark: d, ink: k } = p;
  switch (mood) {
    case "proud":
      return ln("M35 24.5 Q38 19.5 41 24.5", d, 2.6) + ln("M44 24.5 Q47 19.5 50 24.5", d, 2.6) +
        `<path d="M36.2 28.6 Q40.6 35.4 45.6 28 Z" fill="${d}" stroke="${d}" stroke-width="1.2" stroke-linejoin="round"/>`;
    case "nudge":
      return `<path d="M35.6 22.2 H41.6 A3 3.8 0 0 1 35.6 22.2Z M44.6 22.2 H50.6 A3 3.8 0 0 1 44.6 22.2Z" fill="${d}"/>` +
        `<circle cx="40.1" cy="24.2" r="0.9" fill="${k}"/><circle cx="49.1" cy="24.2" r="0.9" fill="${k}"/>` +
        ln("M36 19 L41 19.6", d, 1.9) + ln("M45 17.2 Q48 14.8 51 16.6", d, 1.9) + ln("M37 30.6 Q40.6 31.6 44 28.6", d, 2.2);
    case "ticking":
      return `<circle cx="38" cy="23" r="3.7" fill="${d}"/><circle cx="47" cy="23" r="3.7" fill="${d}"/>` +
        `<circle cx="39" cy="21.8" r="1.1" fill="${k}"/><circle cx="48" cy="21.8" r="1.1" fill="${k}"/>` +
        ln("M34.6 18.4 L40 16.6", d, 1.9) + ln("M44.6 16.4 L50.2 17.6", d, 1.9) + ln("M36 31 q1.3 -1.6 2.6 0 t2.6 0 t2.6 0", d, 1.9);
    case "collector":
      return `<path d="M35 22.6 H41 A3 3.6 0 0 1 35 22.6Z M44 22.6 H50 A3 3.6 0 0 1 44 22.6Z" fill="${d}"/>` +
        `<circle cx="38.8" cy="24.6" r="0.9" fill="${k}"/><circle cx="47.8" cy="24.6" r="0.9" fill="${k}"/>` +
        ln("M35.6 19.6 Q38 18.4 40.6 19.4 M44.4 19.2 Q47 18 49.6 19.2", d, 1.8) + ln("M36.4 29.2 L38.8 31.4 L44.6 27.2", d, 2.3);
    case "sleeping":
      return ln("M35.4 23.4 Q38 26.6 40.6 23.4", d, 2.2) + ln("M44.4 23.4 Q47 26.6 49.6 23.4", d, 2.2) +
        `<ellipse cx="41" cy="30" rx="1.4" ry="1.7" fill="${d}"/>`;
  }
}

/** Tik's shapes in a 64×64 box (props may poke a little outside it). `detail` adds sparkles, extra drops, a third z. */
export function tikShapes(mood: Mood, { detail = true, mono = false } = {}) {
  const p = mono ? MONO : COLOR;
  const crown = mood === "ticking" ? p.amber : p.lime;
  let s = `<g${mood === "sleeping" ? ` transform="rotate(14 24 54)"` : ""}><g class="tk-body">` +
    ln("M20 52 v5 M28 52 v5", p.lime, 5.5) +
    `<g class="tk-arm">${ln(ARM[mood], p.lime, 6)}</g>` +
    `<rect x="48" y="3" width="4" height="6" fill="${p.lime}"/>` +
    `<rect class="tk-crown" x="44" y="0" width="12" height="4.4" rx="2.2" fill="${crown}"/>` +
    ln(CHECK, p.lime, 18) +
    `<g transform="translate(-0.7 2) rotate(-8 42 25)">${face(mood, p)}</g>` +
    `</g></g>`;
  if (mono) return s; // the badge is the silhouette only
  if (mood === "proud" && detail) s += spark(7, 14, 1, p.lime) + spark(60, 30, 0.7, p.lime);
  if (mood === "nudge" && detail) s += ln("M60 29 L62.5 26.5 M60.5 39 L63 41.5", p.ink, 1.4, "tk-pokemark");
  if (mood === "ticking") {
    s += `<g class="tk-ring">${ln("M41 -2 Q38.8 2.2 41 6.4 M59 -2 Q61.2 2.2 59 6.4", p.amber, 1.8)}` +
      (detail ? ln("M37 -3.6 Q33.8 2.2 37 8 M63 -3.6 Q66.2 2.2 63 8", p.amber, 1.6) : "") + `</g>` +
      drop(31, 12, 1, p.drop) + (detail ? drop(27, 20, 0.6, p.drop) : "");
  }
  if (mood === "collector") {
    s += `<g transform="translate(58 29)"><g class="tk-coin"><circle r="6.4" fill="${p.amber}"/>` +
      `<circle r="4.8" fill="none" stroke="${p.rim}" stroke-width="1"/><g transform="scale(0.62)">${rupee(p.dark, 2.2)}</g></g></g>`;
  }
  if (mood === "sleeping") s += zs(46, 4, detail ? 3 : 2, p.mute);
  return s;
}

/** A complete <svg> for Tik. `still` turns off the idle animation (always still below 48px). */
export function tikSvg(mood: Mood, { size = 64, still = false, title = "" } = {}) {
  const detail = size >= 48;
  const a11y = title ? `role="img" aria-label="${title}"` : `aria-hidden="true"`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="${size}" height="${size}" overflow="visible" ${a11y} ` +
    `class="tk tk-${mood}${still || !detail ? " still" : ""}">${tikShapes(mood, { detail })}</svg>`;
}
