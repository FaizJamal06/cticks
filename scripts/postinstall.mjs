// Runs after `npm install` (locally and on Vercel):
// 1. writes the app icons into /public from scripts/icons.json (kept as text so the repo has no binaries)
// 2. copies the Firebase "compat" scripts the service worker loads into /public/fb (same version as the app)
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const icons = JSON.parse(readFileSync("scripts/icons.json", "utf8"));
for (const [name, b64] of Object.entries(icons)) writeFileSync(`public/${name}`, Buffer.from(b64, "base64"));

mkdirSync("public/fb", { recursive: true });
for (const f of ["firebase-app-compat.js", "firebase-messaging-compat.js"]) {
  const src = `node_modules/firebase/${f}`;
  if (existsSync(src)) copyFileSync(src, `public/fb/${f}`);
  else console.warn(`[postinstall] missing ${src}`);
}
