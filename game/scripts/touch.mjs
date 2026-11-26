// Plays the touch controls on an emulated phone (game-ui-ux: test on the target device class). A landscape
// phone, 740 x 360 with touch, in the installed Edge (or Chrome), headless: night 3 with the farmer on the
// path; it holds the garlic button with a real touch, walks and runs with the stick, and saves pictures of the
// play screen, the title and the phone held upright (which asks to be turned) to shots/touch-*.png.
//   node scripts/touch.mjs          (the dev server must be running)
import puppeteer from "puppeteer-core";
import { existsSync, mkdirSync } from "node:fs";

const executablePath = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find(existsSync);
const browser = await puppeteer.launch({ executablePath, headless: true, protocolTimeout: 120000, args: ["--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--hide-scrollbars", "--mute-audio"] });
mkdirSync("shots", { recursive: true });
const page = await browser.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
const phone = (w, h) => page.setViewport({ width: w, height: h, deviceScaleFactor: 2, isMobile: true, hasTouch: true, isLandscape: w > h });
await phone(740, 360);
const cdp = await page.createCDPSession();
const touch = (type, x, y, id = 1) => cdp.send("Input.dispatchTouchEvent", { type, touchPoints: type === "touchEnd" ? [] : [{ x, y, id }] });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = [];
const check = (name, ok, note) => { results.push(ok); console.log(`${ok ? "ok  " : "FAIL"} ${name}${note ? `  ${JSON.stringify(note)}` : ""}`); };

await page.goto("http://localhost:5173/#shot=guise", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => /ready/.test(document.title), { timeout: 180000 });
await page.evaluate(() => window.__aswang.show());
await sleep(600);
check("the touch controls are up on a phone", await page.evaluate(() => !!document.querySelector(".tactions") && document.body.classList.contains("touching")));
await page.screenshot({ path: "shots/touch-play.png" });

// sharp: on a phone with 2 real pixels per point, the 3D view is drawn at them (not stretched from 1)
// (with Resolution set to full, so this checks the ceiling, not how far "auto" has had to come down on this laptop)
const sharp = await page.evaluate(async () => {
  const g = window.__aswang.useGame.getState(); g.setSetting("resolution", "full");
  await new Promise((r) => setTimeout(r, 400));
  const c = document.querySelector("canvas"), ratio = +(c.width / c.clientWidth).toFixed(2);
  g.setSetting("resolution", "auto");
  return ratio;
});
check("the 3D view is drawn at the phone's own pixels (here 2 per point), not stretched", sharp >= 1.9, { pixelsPerPoint: sharp });

// the stick appears under the thumb
await touch("touchStart", 150, 270, 3); await sleep(150);
await page.screenshot({ path: "shots/touch-stick.png" });   // (not pushed: pushing walks him away from the farmer, whom the next check needs)
const knob = await page.evaluate(() => { const r = document.querySelector(".stick i")?.getBoundingClientRect(); return r ? { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) } : null; });
await touch("touchEnd", 150, 270, 3); await sleep(150);
check("the stick appears right under the thumb", !!knob && Math.abs(knob.x - 150) <= 3 && Math.abs(knob.y - 270) <= 3, knob);

// hold the garlic button
const g = await page.evaluate(() => {
  const b = [...document.querySelectorAll(".tbtn")].find((x) => /garlic/i.test(x.getAttribute("aria-label") ?? ""));
  if (!b) return null;
  const r = b.getBoundingClientRect();
  return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
});
check("a garlic button is offered beside the farmer", !!g);
if (g) { await touch("touchStart", g.x, g.y); await sleep(100); await touch("touchEnd", g.x, g.y); await sleep(900); }   // a tap, not a hold
const w = await page.evaluate(() => { const k = window.__aswang.live.kin.guise[0]; return { mode: k.mode, shown: k.shown, garlic: window.__aswang.useGame.getState().bag.garlic }; });
check("a tap on Garlic (no holding) shows the farmer up, and keeps the garlic", w.shown && w.mode === "recoil" && w.garlic === 2, w);

// the stick: a little push walks, a full push runs
const speed = async (dx) => {
  const start = await page.evaluate(() => ({ x: window.__aswang.live.player.x, z: window.__aswang.live.player.z }));
  await touch("touchStart", 120, 250, 2); await sleep(60);
  await touch("touchMove", 120 + dx, 250, 2); await sleep(150);
  const a = await page.evaluate(() => ({ x: window.__aswang.live.player.x, z: window.__aswang.live.player.z, t: performance.now() }));
  await sleep(1000);
  const b = await page.evaluate(() => ({ x: window.__aswang.live.player.x, z: window.__aswang.live.player.z, t: performance.now() }));
  await touch("touchEnd", 120 + dx, 250, 2); await sleep(200);
  return { start, perSec: +((Math.hypot(b.x - a.x, b.z - a.z) * 1000) / (b.t - a.t)).toFixed(2) };
};
// somewhere quiet, with his breath back (the farmer, shown up, comes for him; a blow or being winded stops a run)
await page.evaluate(() => { const L = window.__aswang.live; L.health = 100; L.stamina = 1; L.player.set(56, 0, 0);   /* the trail east: straight and open */ L.kin.guise.forEach((k) => (k.unmask = false)); });
await sleep(300);
const nothing = await page.evaluate(() => ![...document.querySelectorAll(".tbtn")].some((b) => b.getAttribute("aria-label") === "Use"));
check("with nothing near, there is no Use button", nothing);
const walk = await speed(30), run = await speed(60);
check("a small push on the stick walks (1.7 m/s), a full one runs (3.6)", walk.perSec > 1.2 && walk.perSec < 2.3 && run.perSec > 3 && run.perSec < 4.4, { walk: walk.perSec, run: run.perSec });
const still = await page.evaluate(async () => { const x = window.__aswang.live.player.x; await new Promise((r) => setTimeout(r, 300)); return Math.abs(window.__aswang.live.player.x - x) < 0.02; });
check("let go, he stops", still);

// the title on a phone, and the phone held upright
await page.goto("http://localhost:5173/", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /Begin/.test(b.textContent ?? "")), { timeout: 180000 });
await sleep(500);
const begin = await page.evaluate(() => { const b = [...document.querySelectorAll("button")].find((x) => /Begin/.test(x.textContent ?? "")); const r = b.getBoundingClientRect(); return { top: Math.round(r.top), bottom: Math.round(r.bottom), h: innerHeight }; });
check("the title's Begin button is on the screen", begin.bottom <= begin.h && begin.top >= 0, begin);
await page.screenshot({ path: "shots/touch-title.png" });
await phone(360, 740); await sleep(500);
check("held upright, it asks to be turned", await page.evaluate(() => getComputedStyle(document.querySelector(".turn-phone")).display !== "none"));
await page.screenshot({ path: "shots/touch-upright.png" });

if (errors.length) console.log("page errors:", errors);
console.log(`TOUCH ${results.filter(Boolean).length}/${results.length} passed`);
await browser.close();
