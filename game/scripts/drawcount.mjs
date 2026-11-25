// What one frame draws (performance-optimization: find the biggest cost before changing anything). Loads a
// shot on the dev server, lets it run, and reports the renderer's draw calls and triangles for a frame
// (shadow passes included), how many lights cast shadows, and the visible meshes by triangles: which are
// skinned, which are exempt from frustum culling, which cast shadows, and whether each is on screen.
//   node scripts/drawcount.mjs [shot=night5] [x,z to stand at]
// The dev server must be running (npm run dev).
import puppeteer from "puppeteer-core";
import { existsSync } from "node:fs";

const shot = process.argv[2] ?? "night5";
const stand = process.argv[3]?.split(",").map(Number);
const executablePath = ["C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", "C:/Program Files/Google/Chrome/Application/chrome.exe"].find(existsSync);
const browser = await puppeteer.launch({
  executablePath, headless: true, defaultViewport: { width: 1280, height: 720 }, protocolTimeout: 120000,
  args: ["--window-size=1280,720", "--enable-gpu", "--ignore-gpu-blocklist", "--use-angle=d3d11", "--hide-scrollbars", "--mute-audio"],
});
const page = await browser.newPage();
page.on("pageerror", (e) => console.log("page error:", String(e).slice(0, 200)));
await page.goto(`http://localhost:5173/#shot=${shot}`, { waitUntil: "domcontentloaded" });
await page.waitForFunction(() => /ready/.test(document.title), { timeout: 180000 });
const out = await page.evaluate(async (stand) => {
  const a = window.__aswang, t = a.three(), gl = t.gl, scene = t.scene, camera = t.camera;
  if (stand) a.live.player.set(stand[0], 0, stand[1]);
  await new Promise((r) => setTimeout(r, 1500));
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  await frame();
  const calls = gl.info.render.calls, triangles = gl.info.render.triangles;
  // what is in view
  const THREE = a.THREE;
  const frustum = new THREE.Frustum().setFromProjectionMatrix(new THREE.Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse));
  const shown = (o) => { for (let p = o; p; p = p.parent) if (!p.visible) return false; return true; };
  const meshes = [], lights = [];
  scene.traverse((o) => {
    if (o.isLight && o.castShadow && shown(o) && o.intensity > 0) lights.push({ type: o.type, map: o.shadow.mapSize.x });
    if (!o.isMesh || !shown(o)) return;
    const idx = o.geometry.index, n = (idx ? idx.count : o.geometry.attributes.position.count) / 3 * (o.isInstancedMesh ? o.count : 1);
    let onScreen = true;
    try { onScreen = frustum.intersectsObject(o); } catch { /* */ }
    let name = o.name || o.parent?.name || "?";
    for (let p = o; p; p = p.parent) if (p.userData?.url) { name = p.userData.url; break; }
    meshes.push({ name, tris: Math.round(n), skinned: !!o.isSkinnedMesh, culled: o.frustumCulled, shadow: o.castShadow, onScreen, inst: o.isInstancedMesh ? o.count : 0 });
  });
  meshes.sort((x, y) => y.tris - x.tris);
  const sum = (f) => meshes.filter(f).reduce((s, m) => s + m.tris, 0);
  return { calls, triangles, lights, meshes: meshes.length, sceneTris: sum(() => true), onScreenTris: sum((m) => m.onScreen), skinnedTris: sum((m) => m.skinned), skinnedOff: sum((m) => m.skinned && !m.onScreen), top: meshes.slice(0, 22) };
}, stand);
console.log(`frame: ${out.calls} draw calls, ${out.triangles} triangles (shadow passes included)`);
console.log(`shadow-casting lights lit: ${JSON.stringify(out.lights)}`);
console.log(`visible meshes ${out.meshes}: ${out.sceneTris} triangles, ${out.onScreenTris} on screen; skinned ${out.skinnedTris} (${out.skinnedOff} of it off screen)`);
for (const m of out.top) console.log(`  ${String(m.tris).padStart(7)}  ${m.skinned ? "skinned" : "       "} ${m.culled ? "      " : "NOCULL"} ${m.shadow ? "shadow" : "      "} ${m.onScreen ? "on " : "off"} ${m.inst ? `x${m.inst}` : ""} ${m.name}`);
await browser.close();
