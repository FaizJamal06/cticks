// Regenerates scripts/icons.json (app icons, favicons, Android badge, link-preview image) from Tik in lib/tik.ts.
// scripts/postinstall.mjs then writes each entry to public/. Run after changing Tik:
//   node --experimental-strip-types scripts/make-icons.mjs && node scripts/postinstall.mjs
// Needs the dev dependency @resvg/resvg-js. Font: Space Grotesk Bold (OFL, scripts/fonts/OFL.txt).
import { writeFileSync } from "node:fs";
import { Resvg } from "@resvg/resvg-js";
import { DARK, INK, LIME, MUTE, tikShapes } from "../lib/tik.ts";

const FONT = "scripts/fonts/SpaceGrotesk-Bold.ttf";

/** Tik in a size×size box at x,y. Tik's drawing sits about 1.5,2 units up-left of centre in its 64 box. */
const tik = (mood, x, y, size, opts = {}) =>
  `<g transform="translate(${x} ${y}) scale(${size / 64}) translate(1.5 2)">${tikShapes(mood, { detail: false, ...opts })}</g>`;
const svg = (w, h, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">${body}</svg>`;
const png = (s) => new Resvg(s, { font: { fontFiles: [FONT], loadSystemFonts: false, defaultFontFamily: "Space Grotesk" } }).render().asPng();

/** Dark tile with Tik. `pad` is the margin on each side as a share of the tile; `round` for icons shown unmasked. */
const tile = (n, pad, round = false) =>
  svg(n, n, `<rect width="${n}" height="${n}"${round ? ` rx="${n * 0.22}"` : ""} fill="${DARK}"/>` + tik("proud", n * pad, n * pad, n * (1 - 2 * pad)));

// Android status-bar badge: only the alpha channel is used, so Tik is a white silhouette with the face cut out.
const badge = svg(72, 72,
  `<mask id="m" maskUnits="userSpaceOnUse" x="0" y="0" width="72" height="72">${tik("proud", 6, 6, 60, { mono: true })}</mask>` +
  `<rect width="72" height="72" fill="#fff" mask="url(#m)"/>`);

// 1200×630 link preview (WhatsApp, iMessage, etc.).
const og = svg(1200, 630,
  `<defs><radialGradient id="g" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="${LIME}" stop-opacity="0.16"/>` +
  `<stop offset="1" stop-color="${LIME}" stop-opacity="0"/></radialGradient></defs>` +
  `<rect width="1200" height="630" fill="${DARK}"/>` +
  `<circle cx="290" cy="320" r="300" fill="url(#g)"/>` +
  tik("proud", 90, 120, 390, { detail: true }) +
  `<text x="530" y="305" font-family="Space Grotesk" font-weight="700" font-size="168" letter-spacing="-7.5" fill="${INK}">c<tspan fill="${LIME}">T</tspan>icks</text>` +
  `<text x="536" y="395" font-family="Space Grotesk" font-weight="700" font-size="54" letter-spacing="-1.5" fill="${INK}">Tick it or pay for it.</text>` +
  `<text x="538" y="455" font-family="Space Grotesk" font-weight="700" font-size="30" fill="${MUTE}">Friends watching. Money on the line.</text>`);

/** Wraps PNGs in an .ico container (modern browsers read PNG-in-ICO). */
function ico(pngs) {
  const head = Buffer.alloc(6 + 16 * pngs.length);
  head.writeUInt16LE(1, 2);
  head.writeUInt16LE(pngs.length, 4);
  let offset = head.length;
  pngs.forEach(({ size, data }, i) => {
    const e = 6 + 16 * i;
    head.writeUInt8(size, e);
    head.writeUInt8(size, e + 1);
    head.writeUInt16LE(1, e + 4);
    head.writeUInt16LE(32, e + 6);
    head.writeUInt32LE(data.length, e + 8);
    head.writeUInt32LE(offset, e + 12);
    offset += data.length;
  });
  return Buffer.concat([head, ...pngs.map((p) => p.data)]);
}

const fav = (n) => tile(n, 0.06, true);
const fav16 = png(fav(16)), fav32 = png(fav(32));
const out = {
  "icon-192.png": png(tile(192, 0.14, true)),
  "icon-512.png": png(tile(512, 0.14, true)),
  "icon-maskable-512.png": png(tile(512, 0.24)), // Tik inside the 80% safe circle
  "apple-touch-icon.png": png(tile(180, 0.13)), // iOS rounds the corners itself
  "badge-72.png": png(badge),
  "favicon-32.png": fav32,
  "favicon.ico": ico([{ size: 16, data: fav16 }, { size: 32, data: fav32 }]),
  "favicon.svg": Buffer.from(fav(64)),
  "og.png": png(og),
};

const json = Object.fromEntries(Object.entries(out).map(([k, v]) => [k, Buffer.from(v).toString("base64")]));
writeFileSync("scripts/icons.json", JSON.stringify(json, null, 2) + "\n");
for (const [k, v] of Object.entries(out)) console.log(k.padEnd(24), `${(v.length / 1024).toFixed(1)} KB`);
