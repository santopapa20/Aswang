// Measures how smoothly the game runs at chosen places, in real time, in the installed Edge (or Chrome).
// For each place it stands the player there for a few seconds and reports frames per second, the longest
// single frame (a freeze shows up here), and how much the renderer is drawing.
//   node scripts/frames.mjs                 the standard list of places, by day and by night
//   node scripts/frames.mjs -18,14.5,d ...   your own: x,z,d|n (or x,z,<shot name> to start from that shot)
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const executablePath = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find(existsSync);
const browser = await puppeteer.launch({
  executablePath, headless: true, defaultViewport: { width: 1280, height: 720 }, protocolTimeout: 60000,
  args: ["--window-size=1280,720", "--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--hide-scrollbars", "--mute-audio"],
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const places = process.argv.length > 2 ? process.argv.slice(2).map((a) => a.split(",")) : [
  [2, 9, "d"], [-18, 14.5, "d"], [-18, 6, "d"], [20, 24, "d"], [64, 0, "d"], [104, -6.5, "d"], [-24, -16, "d"],
  [-18, 14.5, "n"], [2, 9, "n"], [-24, -16, "n"], [64, 0, "n"], [110, 2, "n"],
];
let page, when = "";
const open = async (w) => {
  if (page) await page.close();
  page = await browser.newPage();
  page.on("pageerror", (e) => console.log("page error:", String(e).slice(0, 200)));
  await page.goto(`http://localhost:5173/#shot=${w === "n" ? "night" : w === "d" ? "day" : w}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => /ready/.test(document.title), { timeout: 120000 });
  await sleep(2500);
  when = w;
};
for (const [x, z, w] of places) {
  if (w !== when) await open(w);
  const r = await Promise.race([
    page.evaluate(async (x, z) => {
      const a = window.__aswang;
      a.live.player.set(x, 0, z);
      await new Promise((r) => setTimeout(r, 1200));
      const gaps = [];
      let last = performance.now();
      await new Promise((done) => { const tick = (t) => { gaps.push(t - last); last = t; if (gaps.length < 400 && performance.now() - start < 4000) requestAnimationFrame(tick); else done(); }; const start = performance.now(); requestAnimationFrame(tick); });
      gaps.shift();
      const info = a.three().gl.info;
      const sum = gaps.reduce((s, g) => s + g, 0);
      return { fps: Math.round((gaps.length / sum) * 1000), worst: Math.round(Math.max(...gaps)), frames: gaps.length, calls: info.render.calls, tris: info.render.triangles, programs: info.programs?.length, textures: info.memory.textures, geometries: info.memory.geometries };
    }, +x, +z),
    sleep(30000).then(() => "FROZEN for 30 s"),
  ]);
  console.log(`${String(x).padStart(6)},${String(z).padStart(6)} ${w}`, JSON.stringify(r));
  if (typeof r === "string") when = "";      // open a fresh page after a freeze
}
await browser.close();
process.exit(0);
