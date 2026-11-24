// A soak run (after the soak-test method: look for GROWTH against this run's own start, not for absolute
// numbers). Plays a night in real time for a few minutes in the installed Edge (or Chrome), headless, while
// the player wanders between the house, the fields and the kin's haunts, and at each checkpoint records
// the JS heap, the renderer's live geometries, textures and shaders, and the frame rate.
//   node scripts/soak.mjs [minutes=8] [shot=night5]
// A run shorter than a few minutes cannot show a slow leak: it reports NOT ASSESSED rather than a pass.
// Node reads each checkpoint from outside the page with a short timeout, so a page that stops drawing or
// locks up is reported as STALLED instead of hanging the run.
// The dev server must be running (npm run dev).
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const minutes = Number(process.argv[2] ?? 8), shot = process.argv[3] ?? "night5";
const every = 30000;
const executablePath = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find(existsSync);
const browser = await puppeteer.launch({
  executablePath, headless: true, defaultViewport: { width: 1280, height: 720 }, protocolTimeout: 60000,
  args: ["--window-size=1280,720", "--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--hide-scrollbars", "--mute-audio", "--enable-precise-memory-info"],
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const errors = [];
let rows = [], stalled = "";
try {
  const page = await browser.newPage();
  page.on("pageerror", (e) => errors.push(String(e).slice(0, 200)));
  await page.goto(`http://localhost:5173/#shot=${shot}`, { waitUntil: "domcontentloaded" });
  await page.waitForFunction(() => /ready/.test(document.title), { timeout: 180000 });
  // the driver lives in the page: keeps the night going and the player and Rosing alive, moves him every 20 s
  await page.evaluate(() => {
    const a = window.__aswang, L = a.live;
    const spots = [[-17, 15], [-22, -10], [6, -24], [24, 5], [2, 9], [-30, -2], [-16, -18]];
    const s = (window.__soak = { frames: 0, worst: 0, start: performance.now(), last: performance.now() });
    const tick = (t) => {
      s.frames++; s.worst = Math.max(s.worst, t - s.last); s.last = t;
      L.clock = Math.max(L.clock, 120); L.health = Math.max(L.health, 60); L.caught = 0;
      if (a.useGame.getState().rosing < 3) a.useGame.setState({ rosing: 3 });   // he is away from the house, so breaches would end the run
      const spot = Math.max(0, Math.floor((t - s.start) / 20000));   // the first frame stamp can precede start
      if (spot !== s.spot) { s.spot = spot; const [x, z] = spots[spot % spots.length]; L.player.set(x, 0, z); }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
  const read = () => page.evaluate(() => {
    const a = window.__aswang, info = a.three().gl.info, s = window.__soak, mem = performance.memory;
    const out = { t: performance.now(), frames: s.frames, worst: s.worst, heapMB: mem ? +(mem.usedJSHeapSize / 1048576).toFixed(1) : null,
      geometries: info.memory.geometries, textures: info.memory.textures, shaders: info.programs?.length ?? null, stage: a.useGame.getState().stage };
    s.worst = 0;
    return out;
  });
  let prev = await read();
  const t0 = prev.t;
  for (let i = 1; i <= Math.ceil((minutes * 60000) / every); i++) {
    await sleep(every);
    let r;
    try { r = await read(); } catch (e) { stalled = `page did not answer at checkpoint ${i} (${String(e).slice(0, 120)})`; break; }
    if (r.frames === prev.frames) { stalled = `no frame drawn in the 30 s before checkpoint ${i}`; break; }
    const row = { min: +((r.t - t0) / 60000).toFixed(1), heapMB: r.heapMB, geometries: r.geometries, textures: r.textures, shaders: r.shaders,
      fps: Math.round(((r.frames - prev.frames) / (r.t - prev.t)) * 1000), worstMs: Math.round(r.worst), stage: r.stage };
    rows.push(row);
    console.log(" ", JSON.stringify(row));
    prev = r;
  }
} catch (e) {
  stalled = `run failed: ${String(e).slice(0, 160)}`;
}
console.log(`soak: ${shot}, ${minutes} min real time, ${rows.length} checkpoints`);
let verdict;
if (stalled) verdict = `STALLED (${stalled})`;
else if (rows.length < 2) verdict = "NOT ASSESSED (no checkpoints)";
else {
  const first = rows.find((r) => r.min >= 1) ?? rows[0], lastRow = rows[rows.length - 1];
  const grow = (k) => (first[k] ? ((lastRow[k] - first[k]) / first[k]) * 100 : 0);
  console.log(`growth from minute ${first.min} to the end: heap ${grow("heapMB").toFixed(0)}%, geometries ${lastRow.geometries - first.geometries}, textures ${lastRow.textures - first.textures}, shaders ${lastRow.shaders - first.shaders}; fps ${first.fps} -> ${lastRow.fps}`);
  const left = rows.find((r) => r.stage !== rows[0].stage);
  verdict = left ? `NOT ASSESSED (the game left "${rows[0].stage}" for "${left.stage}" at minute ${left.min})`
    : minutes < 5 ? "NOT ASSESSED (too short to show a slow leak)"
    : errors.length || grow("heapMB") > 20 || lastRow.geometries - first.geometries > 20 || lastRow.textures - first.textures > 5 || lastRow.fps < first.fps * 0.75 ? "CONCERNS" : "PASS";
}
console.log(`verdict: ${verdict}${errors.length ? ` (page errors: ${errors.join(" | ")})` : ""}`);
await browser.close().catch(() => {});
process.exit(0);
