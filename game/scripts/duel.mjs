// Plays out a fight with an amalanhig in the installed Edge (or Chrome), headless, with a few scripted ways
// of fighting, and reports how each went: whether it was laid down, how long it took, how much health he
// lost, how many grabs landed, and whether he went down. Used to tune the numbers in src/game/data.ts
// (WHIP, AMALANHIG, EAT). The game is stepped a tenth of a second at a time, like the self-test.
//   node scripts/duel.mjs                       every way of fighting, three times each
//   node scripts/duel.mjs 'speed=2.2,turn=1' 'cooldown=4'    the same with numbers changed for the run
// The dev server must be running (npm run dev).
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const executablePath = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find(existsSync);
const browser = await puppeteer.launch({ executablePath, headless: true, defaultViewport: { width: 640, height: 360 }, protocolTimeout: 600000, args: ["--mute-audio"] });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("page error:", String(e).slice(0, 200)));
await page.goto("http://localhost:5173/#shot=title", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => /ready/.test(document.title), { timeout: 180000 });

const STYLES = ["stand", "kite", "sidestep", "flee"];
const setups = process.argv.length > 2 ? process.argv.slice(2) : [""];
for (const setup of setups) {
  const rows = await page.evaluate(async (setup, styles) => {
    const data = window.__aswang.tune;
    const base = { whip: { ...data.WHIP }, a: { ...data.AMALANHIG } };
    for (const kv of setup.split(",").filter(Boolean)) {
      const [k, v] = kv.split("=");
      if (k in data.WHIP) data.WHIP[k] = Number(v); else if (k in data.AMALANHIG) data.AMALANHIG[k] = Number(v); else return [{ error: `unknown number ${k}` }];
    }
    const w = window.__aswang, L = w.live, G = () => w.useGame.getState();
    const keys = new Set();
    const press = (want) => {
      for (const k of ["KeyW", "KeyA", "KeyS", "KeyD", "ShiftLeft"]) {
        const on = want.includes(k);
        if (on && !keys.has(k)) { window.dispatchEvent(new KeyboardEvent("keydown", { code: k })); keys.add(k); }
        if (!on && keys.has(k)) { window.dispatchEvent(new KeyboardEvent("keyup", { code: k })); keys.delete(k); }
      }
    };
    const dirKeys = (x, z) => [x > 0.35 ? "KeyD" : x < -0.35 ? "KeyA" : null, z > 0.35 ? "KeyS" : z < -0.35 ? "KeyW" : null].filter(Boolean);
    const crack = () => { window.dispatchEvent(new KeyboardEvent("keydown", { code: "KeyR" })); window.dispatchEvent(new KeyboardEvent("keyup", { code: "KeyR" })); };
    const out = [];
    for (const style of styles) for (let trial = 0; trial < 3; trial++) {
      G().toTitle(); await new Promise((r) => setTimeout(r, 50));
      G().newGame(); await new Promise((r) => setTimeout(r, 150));
      G().set({ dialogue: null, banner: null, night: 3, rationTaken: true, hasWhip: style !== "flee" }); G().startNight(); await new Promise((r) => setTimeout(r, 150)); G().set({ banner: null, dialogue: null });
      const ang = [Math.PI, Math.PI * 0.8, Math.PI * 1.2][trial];        // 6.5 m from its grave, from the west, south-west and north-west
      L.elapsed = 60; L.player.set(106.4 + Math.cos(ang) * 6.5, 0, 10.3 + Math.sin(ang) * 6.5); w.run(0.2);
      const a = L.amalanhig[0];
      for (let k = 0; k < 60 && a.mode !== "hunt"; k++) w.run(0.1);
      let t = 0, grabs = 0, last = L.health, side = trial % 2 ? 1 : -1, lowest = L.health;
      while (t < 60) {
        const dx = a.x - L.player.x, dz = a.z - L.player.z, d = Math.hypot(dx, dz);
        const ready = L.whipWait <= 0 && L.stamina > 0.2 && G().hasWhip;
        const away = [-dx / d, -dz / d];
        let want = [];
        if (ready && d < data.WHIP.range - 0.3) crack();
        else if (style === "kite" && !ready && d < 4) want = [...dirKeys(...away), ...(d < 2.8 && L.stamina > 0.35 ? ["ShiftLeft"] : [])];
        else if (style === "sidestep" && !ready && d < 2.6) want = [...dirKeys(-dz / d * side, dx / d * side), ...(L.stamina > 0.3 ? ["ShiftLeft"] : [])];
        else if (style === "flee") want = [...dirKeys(...away), ...(L.stamina > 0.35 ? ["ShiftLeft"] : [])];
        press(want);
        w.run(0.1); t += 0.1;
        if (L.health < last - 1) grabs++;
        last = L.health; lowest = Math.min(lowest, L.health);
        if (a.mode === "down" || a.mode === "return" || a.mode === "sink" || a.mode === "grave" || L.caught > 0 || G().stage !== "night") break;
      }
      press([]);
      out.push({ style, trial, result: L.caught > 0 || G().stage !== "night" ? "HE WENT DOWN" : a.mode === "down" ? "laid it down" : a.mode === "hunt" ? "still fighting" : "it gave up", seconds: +t.toFixed(1), health: Math.round(L.health), grabs });
    }
    Object.assign(data.WHIP, base.whip); Object.assign(data.AMALANHIG, base.a);
    return out;
  }, setup, STYLES);
  console.log(`\n== ${setup || "as it is"}`);
  for (const r of rows) console.log(r.error ?? `${r.style.padEnd(9)} #${r.trial}  ${r.result.padEnd(15)} ${String(r.seconds).padStart(5)} s  health ${String(r.health).padStart(3)}  grabs ${r.grabs}`);
}
await browser.close();
