// Plays the first day and night in real time with real key presses, in the installed Edge (or Chrome),
// headless, taking pictures as it goes and noting anything that looks wrong. It is the nearest thing to
// a person at the keyboard that can be automated; the self-test (shoot.mjs selftest) steps the game
// instead and cannot see problems of timing, input or looks.
//   node scripts/play.mjs            pictures go to game/shots/play/, notes are printed
import puppeteer from "puppeteer-core";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const out = join(dirname(fileURLToPath(import.meta.url)), "..", "shots", "play");
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const executablePath = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find(existsSync);
const browser = await puppeteer.launch({
  executablePath, headless: true, defaultViewport: { width: 1280, height: 720 },
  args: ["--window-size=1280,720", "--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--hide-scrollbars", "--mute-audio"],
});
const page = await browser.newPage();
const notes = [];
const note = (s) => { notes.push(s); console.log("NOTE", s); };
page.on("pageerror", (e) => note(`page error: ${String(e).slice(0, 300)}`));
page.on("response", (r) => { if (r.status() >= 400) note(`${r.status()} ${r.url()}`); });
page.on("console", (m) => { if (["error", "warning"].includes(m.type())) note(`console ${m.type()}: ${m.text().slice(0, 240)}`); });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let n = 0;
const snap = async (label, clip) => { await page.screenshot({ path: join(out, `${String(++n).padStart(2, "0")}_${label}.png`), ...(clip ? { clip } : {}) }); };
const st = () => page.evaluate(() => {
  const a = window.__aswang, g = a.useGame.getState(), l = a.live;
  return {
    stage: g.stage, night: g.night, dialogue: !!g.dialogue, panel: g.panel, x: +l.player.x.toFixed(2), z: +l.player.z.toFixed(2), fps: Math.round(l.fps),
    clock: Math.round(l.clock), bag: g.bag, wards: g.wards, hunted: g.hunted, breach: +l.breach.toFixed(2), near: +l.aswang.near.toFixed(1), caught: l.caught, E: l.prompts.E?.label, G: l.prompts.G?.label, rosing: g.rosing, toasts: g.toasts.map((t) => t.text),
  };
});
const put = (x, z) => page.evaluate((x, z) => window.__aswang.live.player.set(x, 0, z), x, z);
const hold = async (keys, ms) => { for (const k of keys) await page.keyboard.down(k); await sleep(ms); for (const k of keys) await page.keyboard.up(k); };
const tap = async (k) => { await page.keyboard.press(k); await sleep(120); };
const talkThrough = async () => { for (let i = 0; i < 40 && (await st()).dialogue; i++) { await tap("Enter"); await sleep(180); } };
/** Samples his position every 50 ms while `fn` runs, and reports the path length against the straight line. */
const trace = async (fn) => {
  await page.evaluate(() => { const l = window.__aswang.live; window.__trace = []; window.__gap = 0; let last = performance.now(); const f = (t) => { window.__gap = Math.max(window.__gap, t - last); last = t; window.__raf = requestAnimationFrame(f); }; window.__raf = requestAnimationFrame(f); window.__tid = setInterval(() => window.__trace.push([l.player.x, l.player.z]), 50); });
  await fn();
  return page.evaluate(() => {
    clearInterval(window.__tid); cancelAnimationFrame(window.__raf);
    const t = window.__trace; let len = 0, back = 0;
    for (let i = 1; i < t.length; i++) len += Math.hypot(t[i][0] - t[i - 1][0], t[i][1] - t[i - 1][1]);
    for (let i = 2; i < t.length; i++) { const a = [t[i - 1][0] - t[i - 2][0], t[i - 1][1] - t[i - 2][1]], b = [t[i][0] - t[i - 1][0], t[i][1] - t[i - 1][1]]; if (a[0] * b[0] + a[1] * b[1] < -1e-5) back++; }
    return { samples: t.length, path: +len.toFixed(2), straight: +Math.hypot(t.at(-1)[0] - t[0][0], t.at(-1)[1] - t[0][1]).toFixed(2), reversals: back, longestFrameMs: Math.round(window.__gap) };
  });
};
// on a slow machine the pictures take long enough for the day to run out: top the day up between steps
const keepDay = () => page.evaluate(() => { const a = window.__aswang; if (a.useGame.getState().stage === "day") a.live.clock = Math.max(a.live.clock, 90); });
const body = { x: 480, y: 200, width: 320, height: 320 };       // the middle of the screen, where he stands

await page.goto("http://localhost:5173/", { waitUntil: "domcontentloaded" });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: "domcontentloaded" });
await sleep(1200); await snap("loading");
await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /Begin/.test(b.textContent)), { timeout: 120000 });
await sleep(2500);
await snap("title");
await page.evaluate(() => [...document.querySelectorAll("button")].find((b) => /Begin/.test(b.textContent))?.click());
await sleep(1500); await snap("intro");
await talkThrough(); await sleep(3500); await snap("day_start");
console.log("start", JSON.stringify(await st()));

// ---- moving
await keepDay();
await page.keyboard.down("KeyW"); await sleep(900);
for (let i = 0; i < 4; i++) { await snap(`walk${i}`, body); await sleep(110); }
await page.keyboard.up("KeyW");
console.log("walk W", JSON.stringify(await trace(() => hold(["KeyW"], 2000))));
console.log("run  W", JSON.stringify(await trace(() => hold(["ShiftLeft", "KeyW"], 2000))));
await page.keyboard.down("ShiftLeft"); await page.keyboard.down("KeyA"); await sleep(600); await snap("run", body); await page.keyboard.up("KeyA"); await page.keyboard.up("ShiftLeft");
console.log("diag  ", JSON.stringify(await trace(() => hold(["KeyS", "KeyD"], 1500))));
await sleep(600); await snap("idle", body);
// ---- bumping into things
await keepDay();
await put(2, 8.5); console.log("into the well ", JSON.stringify(await trace(() => hold(["KeyW"], 2500)))); await snap("well");
await put(-18, 17); console.log("into the house", JSON.stringify(await trace(() => hold(["KeyW"], 3000)))); await snap("door"); console.log("door", JSON.stringify(await st()));
await put(-25.5, 3.5); console.log("into the fence", JSON.stringify(await trace(() => hold(["KeyD"], 2500)))); await snap("fence");
await put(-18, 6); await sleep(900); await snap("behind_house");
await put(-21, 10); await sleep(900); await snap("beside_house");
// ---- the door: supplies and a protection
await keepDay();
await put(-18, 13.3); await sleep(500);
await hold(["KeyE"], 1500); await sleep(400); await snap("supplies"); console.log("supplies", JSON.stringify((await st()).bag));
await hold(["KeyG"], 1500); await sleep(400); await snap("ward"); console.log("wards", JSON.stringify((await st()).wards));
// ---- panels
await keepDay();
await tap("Tab"); await sleep(500); await snap("bag"); await tap("Tab");
await tap("Escape"); await sleep(500); await snap("pause"); await tap("Escape");
// ---- Nong Kadyo
await keepDay();
await put(24, -19.2); await sleep(600); console.log("kadyo", JSON.stringify(await st()));
await hold(["KeyE"], 1300); await sleep(600); await snap("kadyo_talk"); await talkThrough(); await sleep(600); await snap("trade");
await page.evaluate(() => document.querySelector(".offers .perk:not([disabled])")?.click()); await sleep(300); await tap("Escape");
// ---- searching
await keepDay();
await put(6.5, 8.6); await sleep(500); await snap("sack_before"); await hold(["KeyE"], 2600); await sleep(500); await snap("sack_after"); console.log("searched", JSON.stringify((await st()).toasts));
// ---- dusk and night
await put(-17, 15);
await page.evaluate(() => { window.__aswang.live.clock = 34; });
for (let i = 0; i < 6; i++) { await sleep(5000); await snap(`dusk${i}`); }
console.log("night", JSON.stringify(await st()));
await tap("KeyF"); await sleep(700); await snap("lamp_shut"); await tap("KeyF");
await tap("KeyQ"); await sleep(400); await snap("salt_line");
for (let i = 0; i < 9; i++) { await sleep(5000); await snap(`watch${i}`); if (i % 3 === 2) console.log("watch", JSON.stringify(await st())); }
// walk a square round the yard at night
for (const k of ["KeyD", "KeyS", "KeyA", "KeyW"]) { await hold([k], 1800); }
await snap("yard_walk");
// ---- out in the dark, until it has him
await put(8, 24); await tap("KeyF");
for (let i = 0; i < 14; i++) { await sleep(4000); await snap(`dark${i}`); const s = await st(); if (i % 2 === 0) console.log("dark", JSON.stringify(s)); if (s.stage !== "night") break; }
await sleep(1500); await snap("after"); console.log("after", JSON.stringify(await st()));
if ((await st()).stage === "morning") { await tap("Enter"); await sleep(1500); await snap("day2"); await talkThrough(); await sleep(1000); await snap("day2_free"); }
// ---- other window sizes
for (const [w, h] of [[960, 540], [1920, 1080], [800, 900]]) { await page.setViewport({ width: w, height: h }); await sleep(1500); await snap(`size_${w}x${h}`); }
console.log(`\n${notes.length} notes`); for (const s of notes) console.log(" -", s);
await browser.close();
