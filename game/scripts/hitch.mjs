// Finds hitches: plays the game in real time in the installed Edge (or Chrome), headless, from a chosen
// shot and place, and logs every frame slower than a threshold together with what changed at that moment
// (shaders compiled, textures and geometries created) and what the creatures were doing. A spike with a
// new shader is a first-use compile; one with none is script work or garbage collection.
//   node scripts/hitch.mjs night 8,24 30          shot "night", stand at x 8, z 24, watch 30 seconds
//   node scripts/hitch.mjs night5 -16,-18 20 60   ... and count frames over 60 ms (default 50)
// The dev server must be running (npm run dev).
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const [shot = "night", at = "8,24", seconds = "30", limit = "50"] = process.argv.slice(2);
const [x, z] = at.split(",").map(Number);
const executablePath = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find(existsSync);
const browser = await puppeteer.launch({
  executablePath, headless: true, defaultViewport: { width: 1280, height: 720 }, protocolTimeout: 600000,
  args: ["--window-size=1280,720", "--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--hide-scrollbars", "--mute-audio"],
});
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("page error:", String(e).slice(0, 200)));
await page.goto(`http://localhost:5173/#shot=${shot}`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => /ready/.test(document.title), { timeout: 180000 });
const r = await page.evaluate(async (x, z, seconds, limit) => {
  const a = window.__aswang, L = a.live, G = () => a.useGame.getState();
  L.player.set(x, 0, z);
  await new Promise((r) => setTimeout(r, 1500));
  const info = a.three().gl.info;
  const spikes = [];
  let last = performance.now(), frames = 0, worst = 0, prev = { p: info.programs?.length ?? 0, t: info.memory.textures, g: info.memory.geometries };
  const start = performance.now();
  await new Promise((done) => {
    const tick = (t) => {
      const dt = t - last; last = t; frames++; worst = Math.max(worst, dt);
      const now = { p: info.programs?.length ?? 0, t: info.memory.textures, g: info.memory.geometries };
      if (dt > limit) spikes.push({
        at: +((t - start) / 1000).toFixed(1), ms: Math.round(dt),
        newShaders: now.p - prev.p, newTextures: now.t - prev.t, newGeometries: now.g - prev.g,
        aswang: L.aswang.active ? `${L.aswang.near.toFixed(1)} m` : "-", kin: Object.values(L.kin).flat().map((k) => k.mode).join(","),
        stage: G().stage, clock: Math.round(L.clock),
      });
      prev = now;
      if (performance.now() - start < seconds * 1000) requestAnimationFrame(tick); else done();
    };
    requestAnimationFrame(tick);
  });
  return { frames, fps: Math.round(frames / seconds), worst: Math.round(worst), spikes, shaders: info.programs?.length };
}, x, z, +seconds, +limit);
console.log(`${shot} at ${at}, ${seconds} s: ${r.frames} frames, ${r.fps} fps, worst ${r.worst} ms, ${r.spikes.length} frames over ${limit} ms, ${r.shaders} shaders`);
for (const s of r.spikes) console.log("  ", JSON.stringify(s));
await browser.close();
