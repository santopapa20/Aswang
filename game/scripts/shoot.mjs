// Photographs the game in chosen states with the installed Edge (or Chrome), headless, and runs the self-test.
// The dev server must be running (npm run dev). Pictures go to game/shots/ (not committed).
//   node scripts/shoot.mjs title door night breach roof trail bag trade morning ending
//   node scripts/shoot.mjs selftest        plays all five nights by script and prints a pass/fail list
// The states are defined in src/devshots.ts; the self-test in src/devtest.ts.
import puppeteer from "puppeteer-core";
import { existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "shots");
mkdirSync(out, { recursive: true });
const browsers = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"];
const executablePath = browsers.find(existsSync);
if (!executablePath) { console.error("No Edge or Chrome found."); process.exit(1); }
const browser = await puppeteer.launch({
  executablePath, headless: true, defaultViewport: { width: 1280, height: 720 }, protocolTimeout: 600000,
  args: ["--window-size=1280,720", "--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--hide-scrollbars", "--mute-audio"],
});
let failed = false;
async function shoot(name) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  const t0 = Date.now();
  await page.goto(`http://localhost:5173/#shot=${name}`, { waitUntil: "domcontentloaded" });
  try { await page.waitForFunction((n) => document.title === `shot ${n} ready`, { timeout: name === "selftest" ? 600000 : 120000 }, name); } catch { errors.push("timed out"); }
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: join(out, `${name}.png`) });
  const report = await page.evaluate(() => document.querySelector("#selftest")?.textContent ?? "");
  if (report) { console.log(report); if (/FAIL/.test(report)) failed = true; }
  if (errors.length) failed = true;
  console.log(name, `${Math.round((Date.now() - t0) / 1000)}s`, errors.join(" | "));
  await page.close();
}
const names = process.argv.slice(2);
for (const name of names) await shoot(name);      // one at a time: two copies of the game at once starve each other
await browser.close();
process.exit(failed ? 1 : 0);
