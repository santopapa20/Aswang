// Is the frame limited by pixels or by what is drawn? (performance-optimization: CPU- vs GPU-bound, then which
// part.) Stands behind Rosing's house by day, the slowest place measured, and reports frames per second as
// it is, at half resolution, and with the player, the huts, the grass, the ground or the point lights hidden,
// and with the ground drawn last and texture filtering eased. A big jump at half resolution means pixels.
//   node scripts/bound.mjs          (the dev server must be running)
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";
const executablePath = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find(existsSync);
const browser = await puppeteer.launch({ executablePath, headless: true, defaultViewport: { width: 1280, height: 720 }, protocolTimeout: 120000,
  args: ["--window-size=1280,720", "--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--hide-scrollbars", "--mute-audio"] });
const page = await browser.newPage();
await page.goto(`http://localhost:5173/#shot=yard`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => /ready/.test(document.title), { timeout: 180000 });
const r = await page.evaluate(async () => {
  const a = window.__aswang, t = a.three(), gl = t.gl;
  a.live.player.set(-18, 0, 6);
  const fps = () => new Promise((res) => { let n = 0; const s = performance.now(); const f = (x) => { n++; if (x - s < 3000) requestAnimationFrame(f); else res(Math.round(n / ((x - s) / 1000))); }; requestAnimationFrame(f); });
  await new Promise((r) => setTimeout(r, 2000));
  const out = {};
  out.normal = await fps();
  let ground; t.scene.traverse((o) => { if (o.isMesh && !o.isInstancedMesh && o.geometry?.parameters?.width > 100) ground = o; });
  const texs = [ground.material.map];
  ground.material.map.anisotropy = 1; ground.material.map.needsUpdate = true;
  await new Promise((r) => setTimeout(r, 800)); out.aniso1map = await fps();
  ground.renderOrder = 10; await new Promise((r) => setTimeout(r, 300)); out.groundLast = await fps();
  t.scene.traverse((o) => { if (o.material?.map && o !== ground && o.material.map.anisotropy > 1) { o.material.map.anisotropy = 1; o.material.map.needsUpdate = true; } });
  await new Promise((r) => setTimeout(r, 800)); out.allAniso1 = await fps();
  return out;
});
console.log(JSON.stringify(r));
await browser.close();
