// Plays out fights in the installed Edge (or Chrome), headless, with a few scripted ways of fighting, and
// reports how each went: whether the foe was laid down, how long it took, how much health he lost, how many
// times he was hurt, and whether he went down. Used to tune the numbers in src/game/data.ts (WHIP,
// AMALANHIG, KIN, EAT). The game is stepped a tenth of a second at a time, like the self-test.
//   node scripts/duel.mjs                          the amalanhig, every way of fighting, three times each
//   node scripts/duel.mjs --foe=dog                the pair of dead dogs on night 2 (or --foe=crawler, night 3)
//   node scripts/duel.mjs "speed=2.2" "cooldown=4"  the same with numbers changed for the run; for the kin
//                                                  name the kind: "dog.speed=2.8,dog.harm=10"
// Ways of fighting: stand (crack whenever ready, never move), kite (back off while the whip is not ready),
// sidestep (run across its path while the whip is not ready), flee (no whip: run), and for the crawler
// dark (stand and crack with the lamp shuttered).
// The dev server must be running (npm run dev).
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const args = process.argv.slice(2);
const foe = (args.find((a) => a.startsWith("--foe=")) ?? "--foe=amalanhig").slice(6);
const setups = args.filter((a) => !a.startsWith("--"));
if (!setups.length) setups.push("");
const STYLES = ["stand", "kite", "sidestep", "flee", ...(foe === "crawler" ? ["dark"] : [])];

const executablePath = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find(existsSync);
const browser = await puppeteer.launch({ executablePath, headless: true, defaultViewport: { width: 640, height: 360 }, protocolTimeout: 900000, args: ["--mute-audio"] });
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("page error:", String(e).slice(0, 200)));
await page.goto("http://localhost:5173/#shot=title", { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => /ready/.test(document.title), { timeout: 180000 });

for (const setup of setups) {
  const rows = await page.evaluate(async (setup, styles, foe) => {
    const data = window.__aswang.tune;
    const base = JSON.stringify({ WHIP: data.WHIP, AMALANHIG: data.AMALANHIG, KIN: data.KIN });
    for (const kv of setup.split(",").filter(Boolean)) {
      const [k, v] = kv.split("=");
      const [kind, key] = k.includes(".") ? k.split(".") : [null, k];
      if (kind && data.KIN[kind] && key in data.KIN[kind]) data.KIN[kind][key] = Number(v);
      else if (!kind && key in data.WHIP) data.WHIP[key] = Number(v);
      else if (!kind && key in data.AMALANHIG) data.AMALANHIG[key] = Number(v);
      else return [{ error: `unknown number ${k}` }];
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
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    const kin = foe === "dog" || foe === "crawler";
    const foes = () => (kin ? L.kin[foe] : [L.amalanhig[0]]);
    const alive = (f) => (kin ? !["away", "dead", "dying"].includes(f.mode) : !["down", "grave", "return", "sink"].includes(f.mode));
    const out = [];
    for (const style of styles) for (let trial = 0; trial < 3; trial++) {
      G().toTitle(); await sleep(50);
      G().newGame(); await sleep(150);
      G().set({ dialogue: null, banner: null, night: foe === "dog" ? 2 : 3, rationTaken: true, hasWhip: style !== "flee", bag: { ...G().bag, oil: 9 } });
      G().startNight(); await sleep(150); G().set({ banner: null, dialogue: null, lampOn: style !== "dark" });
      const ang = [Math.PI, Math.PI * 0.8, Math.PI * 1.2][trial];
      if (kin) {
        // wait for them to come out, then walk up to within 6 m of the first
        L.elapsed = 30; L.player.set(foe === "dog" ? -20 : 5, 0, foe === "dog" ? -8 : -5);
        for (let k = 0; k < 300 && foes().filter(alive).length < foes().length; k++) w.run(0.1);
        const f = foes()[0];
        L.player.set(f.x + Math.cos(ang) * 6, 0, f.z + Math.sin(ang) * 6); w.run(0.1);
      } else {
        L.elapsed = 60; L.player.set(106.4 + Math.cos(ang) * 6.5, 0, 10.3 + Math.sin(ang) * 6.5); w.run(0.2);
        for (let k = 0; k < 60 && L.amalanhig[0].mode !== "hunt"; k++) w.run(0.1);
      }
      const total = foes().filter(alive).length;
      let t = 0, hurts = 0, last = L.health, engaged = false;
      const side = trial % 2 ? 1 : -1;
      while (t < 60) {
        const up = foes().filter(alive);
        if (!up.length) break;
        const f = up.reduce((a, b) => (Math.hypot(a.x - L.player.x, a.z - L.player.z) < Math.hypot(b.x - L.player.x, b.z - L.player.z) ? a : b));
        const dx = f.x - L.player.x, dz = f.z - L.player.z, d = Math.max(0.01, Math.hypot(dx, dz));
        const ready = L.whipWait <= 0 && L.stamina > 0.2 && G().hasWhip;
        const away = [-dx / d, -dz / d];
        let want = [];
        engaged = engaged || up.some((x) => x.mode === "hunt" || x.mode === "bite" || x.mode === "grab");
        if (!engaged) want = dirKeys(dx / d, dz / d);          // walk up to it until it notices him
        else if (ready && d < data.WHIP.range - 0.3) crack();
        else if (style === "kite" && !ready && d < 4) want = [...dirKeys(...away), ...(d < 2.8 && L.stamina > 0.35 ? ["ShiftLeft"] : [])];
        else if (style === "sidestep" && !ready && d < 2.6) want = [...dirKeys((-dz / d) * side, (dx / d) * side), ...(L.stamina > 0.3 ? ["ShiftLeft"] : [])];
        else if (style === "flee") want = [...dirKeys(...away), ...(L.stamina > 0.35 ? ["ShiftLeft"] : [])];
        press(want);
        w.run(0.1); t += 0.1;
        if (L.health < last - 1) hurts++;
        last = L.health;
        if (L.caught > 0 || G().stage !== "night") break;
        if (engaged && style === "flee" && up.every((x) => x.mode === "prowl" || x.mode === "return" || x.mode === "sink")) break;      // they have lost him
      }
      press([]);
      const left = foes().filter(alive);
      const result = L.caught > 0 || G().stage !== "night" ? "HE WENT DOWN" : !left.length ? "laid down" : left.every((x) => x.mode === "prowl" || x.mode === "return" || x.mode === "sink") ? "got away" : `${total - left.length} of ${total} down`;
      out.push({ style, trial, result, seconds: +t.toFixed(1), health: Math.round(L.health), hurts });
    }
    const b = JSON.parse(base);
    Object.assign(data.WHIP, b.WHIP); Object.assign(data.AMALANHIG, b.AMALANHIG);
    for (const k of Object.keys(b.KIN)) Object.assign(data.KIN[k], b.KIN[k]);
    return out;
  }, setup, STYLES, foe);
  console.log(`\n== ${foe}: ${setup || "as it is"}`);
  for (const r of rows) console.log(r.error ?? `${r.style.padEnd(9)} #${r.trial}  ${r.result.padEnd(15)} ${String(r.seconds).padStart(5)} s  health ${String(r.health).padStart(3)}  hurt ${r.hurts}x`);
}
await browser.close();
