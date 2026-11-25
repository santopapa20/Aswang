// Frame rate of a PRODUCTION build (performance-optimization: measure a release-like build, not the dev
// server). Serve the build first:  npm run build && npx vite preview --port 4173 --strictPort
// then:  node scripts/prodfps.mjs [url=http://localhost:4173/] [seconds=12]
// It starts a new game from the title screen like a player, then records frame times while standing in
// the yard, and while walking and running a loop, and prints average fps, p95 and worst frame in ms.
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const url = process.argv[2] ?? "http://localhost:4173/";
const seconds = Number(process.argv[3] ?? 12);
const executablePath = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find(existsSync);
const browser = await puppeteer.launch({
  executablePath, headless: true, defaultViewport: { width: 1280, height: 720 }, protocolTimeout: 300000,
  args: ["--window-size=1280,720", "--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--hide-scrollbars", "--mute-audio"],
});
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
await page.goto(url, { waitUntil: "domcontentloaded" });
// the title screen's "Begin" button appears once everything has loaded
await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /Begin/.test(b.textContent ?? "")), { timeout: 180000 });
await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Begin/.test(b.textContent ?? ""))?.click());
await new Promise((r) => setTimeout(r, 1500));
for (let i = 0; i < 12; i++) { await page.keyboard.press("Enter"); await new Promise((r) => setTimeout(r, 250)); }   // through the opening lines
await new Promise((r) => setTimeout(r, 4000));
const measure = (label) => page.evaluate(async (seconds, label) => {
  const gaps = []; let last = performance.now();
  const start = last;
  await new Promise((done) => { const f = (t) => { gaps.push(t - last); last = t; if (t - start < seconds * 1000) requestAnimationFrame(f); else done(); }; requestAnimationFrame(f); });
  gaps.shift(); gaps.sort((a, b) => a - b);
  const avg = gaps.reduce((s, g) => s + g, 0) / gaps.length;
  const cv = document.querySelector("canvas");
  return { label, fps: Math.round(1000 / avg), avgMs: +avg.toFixed(1), p95Ms: +gaps[Math.floor(gaps.length * 0.95)].toFixed(1), worstMs: Math.round(gaps[gaps.length - 1]), frames: gaps.length, resolution: cv ? +(cv.width / cv.clientWidth).toFixed(2) : null };
}, seconds, label);
console.log(JSON.stringify(await measure("standing in the yard")));
const walking = measure("walking and running about");
for (const [keys, ms] of [[["KeyW"], 2500], [["KeyD", "ShiftLeft"], 2500], [["KeyS"], 2500], [["KeyA", "ShiftLeft"], 2500], [["KeyW", "KeyD"], 2000]]) {
  for (const k of keys) await page.keyboard.down(k);
  await new Promise((r) => setTimeout(r, ms));
  for (const k of keys) await page.keyboard.up(k);
}
console.log(JSON.stringify(await walking));
if (errors.length) console.log("page errors:", errors);
await browser.close();
