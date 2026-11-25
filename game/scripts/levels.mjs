// How loud the game is in each situation (audio-design: measure, then listen). Plays the title, a day, a
// calm night, a night with something after him, and the stingers, a few seconds each, in the installed Edge
// (or Chrome), headless and muted at the speakers, and meters the master inside the page: the peak after
// the limiter, the average (RMS) level, and the peak before the limiter (how hard the limiter is working).
// All in dBFS. Targets: peaks after the limiter at or under -1 dBFS; calm play well under the tense moments.
//   node scripts/levels.mjs          (the dev server must be running)
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const executablePath = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find(existsSync);
const browser = await puppeteer.launch({
  executablePath, headless: true, defaultViewport: { width: 960, height: 540 }, protocolTimeout: 180000,
  args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--hide-scrollbars", "--mute-audio", "--autoplay-policy=no-user-gesture-required"],
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = [];
async function phase(label, shot, seconds, setup) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 160)));
  await page.goto(`http://localhost:5173/#shot=${shot}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => /ready/.test(document.title), { timeout: 180000 });
  await page.evaluate(() => { const a = window.__aswang; a.sound.wake(); a.show?.(); a.useGame.getState().set({ dialogue: null }); });
  await sleep(800);
  if (setup) await page.evaluate(setup);
  await page.evaluate(() => window.__aswang.sound.meter(true));
  await sleep(seconds * 1000);
  const m = await page.evaluate(() => window.__aswang.sound.meter(false));
  rows.push({ label, ...m, errors: errors.length });
  console.log(`${label.padEnd(34)} peak ${String(m.peakDb).padStart(6)}  rms ${String(m.rmsDb).padStart(6)}  before limiter ${String(m.prePeakDb).padStart(6)}  (${m.state})${errors.length ? `  page errors: ${errors.join(" | ")}` : ""}`);
  await page.close();
}

await phase("title", "title", 8);
await phase("day", "day", 8);
await phase("night, calm", "night", 10, () => { const L = window.__aswang.live; L.player.set(-30, 0, 25); });
await phase("night, it has seen him", "night", 10, () => { window.__aswang.useGame.setState({ hunted: true }); });
await phase("night 5, the worst of it", "night5", 10, () => { window.__aswang.useGame.setState({ hunted: true, overhead: true }); window.__aswang.sound.breach(); });
await phase("stingers back to back", "night", 9, () => { const s = window.__aswang.sound; s.sting("night"); setTimeout(() => s.sting("seen"), 2500); setTimeout(() => s.unmask(), 5000); setTimeout(() => s.whisper(), 6000); setTimeout(() => s.howl(0.5, 1), 6500); });
await browser.close();

const loudest = Math.max(...rows.map((r) => r.peakDb));
const calm = rows.find((r) => r.label === "night, calm"), tense = rows.find((r) => r.label === "night, it has seen him");
console.log(`\nloudest peak after the limiter: ${loudest} dBFS (target <= -1)`);
console.log(`calm night ${calm.rmsDb} dB RMS against ${tense.rmsDb} when seen: ${tense.rmsDb - calm.rmsDb > 3 ? "the danger is audible" : "too little difference"}`);
console.log(rows.every((r) => r.state === "running") ? "audio ran in every phase" : "AUDIO DID NOT RUN in some phase: the numbers mean nothing");
