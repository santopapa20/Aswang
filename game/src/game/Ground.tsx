import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { CanvasTexture, CatmullRomCurve3, ClampToEdgeWrapping, LinearFilter, LinearMipmapLinearFilter, MeshLambertMaterial, RepeatWrapping, SRGBColorSpace, Vector3 } from "three";
import { live } from "./state";
import { balete, bushes, decor, fences, FENCE_LENGTH, firePit, houses, HUT, nodes, palms, patches, paths, seeded, well } from "./layout";

/**
 * The ground is one surface, painted once when the game starts. A picture of the whole map (drawn here,
 * no image files) says where the earth is worn bare, where it lies dark and damp under trees and
 * houses, and where shadows fall; the ground's material reads it and mixes grass and earth to suit.
 * Nothing is laid on top of anything else, so there are no seams where paths meet.
 */
const RECT = { x0: -46, z0: -42, w: 184, d: 86.25 };       // the part of the world the picture covers, in metres
const W = 1280, PX = W / RECT.w, H = Math.round(RECT.d * PX);      // about seven pixels to the metre: enough for a ragged edge, quick to paint
/** Which way shadows fall on the ground (the sun and the moon stand in the north-west). */
export const SHADOW_DIR = { x: 0.87, z: 0.5 };

const hash = (i: number, j: number) => { const h = Math.sin(i * 127.1 + j * 311.7) * 43758.5453; return h - Math.floor(h); };
/** Smooth noise that repeats every 30 m along X, so the trail's loop cannot be told from the ground. */
function noise(x: number, z: number, cell: number) {
  const wrap = Math.round(30 / cell);
  const gx = x / cell, gz = z / cell, x0 = Math.floor(gx), z0 = Math.floor(gz);
  let fx = gx - x0, fz = gz - z0;
  fx = fx * fx * (3 - 2 * fx); fz = fz * fz * (3 - 2 * fz);
  const at = (i: number, j: number) => hash(((i % wrap) + wrap) % wrap, j);
  const a = at(x0, z0), b = at(x0 + 1, z0), c = at(x0, z0 + 1), d = at(x0 + 1, z0 + 1);
  return a + (b - a) * fx + (c - a) * fz + (a - b - c + d) * fx * fz;
}

function layer(draw: (g: CanvasRenderingContext2D) => void, blur: number) {
  const sharp = document.createElement("canvas");
  sharp.width = W; sharp.height = H;
  const g = sharp.getContext("2d")!;
  g.fillStyle = "#000"; g.fillRect(0, 0, W, H);
  g.setTransform(PX, 0, 0, PX, -RECT.x0 * PX, -RECT.z0 * PX);      // from here on, draw in metres
  g.fillStyle = "#fff"; g.strokeStyle = "#fff"; g.lineCap = "round"; g.lineJoin = "round";
  draw(g);
  // soften the whole picture in one pass (softening each shape as it is drawn takes minutes)
  const soft = document.createElement("canvas");
  soft.width = W; soft.height = H;
  const s = soft.getContext("2d", { willReadFrequently: true })!;
  s.filter = `blur(${blur}px)`;
  s.drawImage(sharp, 0, 0);
  return s.getImageData(0, 0, W, H).data;
}
const dot = (g: CanvasRenderingContext2D, x: number, z: number, rx: number, rz = rx, turn = 0) => { g.beginPath(); g.ellipse(x, z, rx, rz, turn, 0, 7); g.fill(); };

function paintGround() {
  // where the earth is bare: paths, the plaza, the swept ground before each house
  const bare = layer((g) => {
    for (const p of paths) {
      const pts = new CatmullRomCurve3(p.pts.map(([x, z]) => new Vector3(x, 0, z)), false, "catmullrom", 0.4).getSpacedPoints(Math.max(4, p.pts.length * 12));
      g.lineWidth = p.w * 0.95;
      g.beginPath(); pts.forEach((q, i) => (i ? g.lineTo(q.x, q.z) : g.moveTo(q.x, q.z))); g.stroke();
    }
    for (const p of patches) dot(g, p.x, p.z, p.r * 0.86);
    dot(g, firePit.x, firePit.z, 1.5);
  }, 4.5);
  // where it lies dark and damp: under trees, houses, fences and undergrowth
  const damp = layer((g) => {
    for (const t of palms) dot(g, t.x, t.z, 1.25);
    for (const b of bushes) dot(g, b.x, b.z, b.s * 1.05);
    for (const h of houses) g.fillRect(h.x - HUT.hx - 0.5, h.z - HUT.hz - 0.5, HUT.hx * 2 + 1, HUT.hz * 2 + 1);
    for (const f of fences) dot(g, f.x, f.z, FENCE_LENGTH * 0.55, 0.45, -f.rot);
    for (const d of decor) dot(g, d.x, d.z, 0.75 * d.s);
    for (const n of nodes) dot(g, n.x, n.z, 0.6);
    dot(g, balete.x, balete.z, balete.height * 0.72);
    dot(g, well.x, well.z, 1.5);
  }, 5.5);
  // where shadows fall: everything tall throws one to the south-east
  const shade = layer((g) => {
    const { x: sx, z: sz } = SHADOW_DIR;
    for (const t of palms) {
      const len = t.h * 0.62, cx = t.x + sx * len, cz = t.z + sz * len;
      g.lineWidth = 0.3; g.beginPath(); g.moveTo(t.x, t.z); g.lineTo(cx, cz); g.stroke();
      for (let k = 0; k < 7; k++) dot(g, cx + Math.cos(k * 0.9 + t.x) * 0.75, cz + Math.sin(k * 0.9 + t.x) * 0.75, t.h * 0.3, 0.3, k * 0.9 + t.x);     // the fronds
    }
    for (const h of houses) {
      const o = 2.6;
      g.beginPath();
      g.moveTo(h.x - HUT.hx, h.z + HUT.hz); g.lineTo(h.x - HUT.hx, h.z - HUT.hz); g.lineTo(h.x + HUT.hx, h.z - HUT.hz);
      g.lineTo(h.x + HUT.hx + sx * o, h.z - HUT.hz + sz * o); g.lineTo(h.x + HUT.hx + sx * o, h.z + HUT.hz + sz * o); g.lineTo(h.x - HUT.hx + sx * o, h.z + HUT.hz + sz * o);
      g.closePath(); g.fill();
    }
    for (const f of fences) dot(g, f.x + sx * 0.5, f.z + sz * 0.5, FENCE_LENGTH * 0.5, 0.32, -f.rot);
    for (const b of bushes) dot(g, b.x + sx * 0.7 * b.s, b.z + sz * 0.7 * b.s, b.s * 0.9);
    for (const d of decor) dot(g, d.x + sx * 0.4, d.z + sz * 0.4, 0.6 * d.s);
    for (const n of nodes) dot(g, n.x + sx * 0.25, n.z + sz * 0.25, 0.5);
    for (let k = 0; k < 9; k++) dot(g, balete.x + sx * 3.4 + Math.cos(k * 0.7) * 2.2, balete.z + sz * 3.4 + Math.sin(k * 0.7) * 2.2, balete.height * 0.36, balete.height * 0.2, k * 0.7);
    dot(g, well.x + sx * 1.1, well.z + sz * 1.1, 1.3);
  }, 2.5);

  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const g = c.getContext("2d")!;
  const img = g.createImageData(W, H), out = img.data;
  const step = (lo: number, hi: number, v: number) => { const t = Math.max(0, Math.min(1, (v - lo) / (hi - lo))); return t * t * (3 - 2 * t); };
  for (let y = 0, i = 0; y < H; y++) {
    const z = RECT.z0 + y / PX;
    for (let x = 0; x < W; x++, i += 4) {
      const wx = RECT.x0 + x / PX;
      const big = noise(wx, z, 2.5), small = noise(wx + 7, z + 3, 0.6);
      const n = big * 0.65 + small * 0.35;
      // a ragged edge: the noise decides exactly where grass gives way to earth
      const earth = step(0.34, 0.66, bare[i] / 255 + (n - 0.5) * 0.55) * (0.84 + 0.16 * small);
      out[i] = earth * 255;
      out[i + 1] = Math.min(255, damp[i] * (0.75 + 0.5 * big));
      out[i + 2] = shade[i];
      out[i + 3] = 255;
    }
  }
  g.putImageData(img, 0, 0);
  const tex = new CanvasTexture(c);
  tex.flipY = false;
  tex.wrapS = tex.wrapT = ClampToEdgeWrapping;
  tex.minFilter = LinearMipmapLinearFilter; tex.magFilter = LinearFilter;
  tex.anisotropy = 2;
  return tex;
}

function tile(size: number, paint: (g: CanvasRenderingContext2D, size: number) => void) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  paint(c.getContext("2d")!, size);
  const tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 2;                 // 4 cost this laptop's graphics ~2 fps over the whole screen
  return tex;
}
const around = (g: CanvasRenderingContext2D, s: number, x: number, y: number, fn: (x: number, y: number) => void) => { for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) fn(x + ox, y + oy); void g; };
const grassTile = () => tile(512, (g, s) => {
  const rnd = seeded(11);
  g.fillStyle = "#39401f"; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 300; i++) {                           // broad mottling: damp, dry and mossy ground
    const k = rnd();
    g.fillStyle = `rgba(${k < 0.4 ? "28,36,16" : k < 0.75 ? "92,86,44" : "50,66,26"},${0.05 + rnd() * 0.08})`;
    const x = rnd() * s, y = rnd() * s, r = 14 + rnd() * 50;
    around(g, s, x, y, (px, py) => { g.beginPath(); g.arc(px, py, r, 0, 7); g.fill(); });
  }
  for (let i = 0; i < 14000; i++) {                         // blades, combed mostly one way
    const x = rnd() * s, y = rnd() * s, l = 3 + rnd() * 7, a = -Math.PI / 2 + (rnd() - 0.5) * 1.5;
    const v = rnd();
    g.strokeStyle = `rgba(${48 + v * 60},${68 + v * 58},${24 + v * 26},${0.16 + rnd() * 0.24})`;
    g.lineWidth = 0.7 + rnd() * 0.9;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
  for (let i = 0; i < 500; i++) {                           // fallen leaves and bits
    g.fillStyle = `rgba(${110 + rnd() * 50},${84 + rnd() * 40},${38 + rnd() * 24},${0.25 + rnd() * 0.3})`;
    g.beginPath(); g.ellipse(rnd() * s, rnd() * s, 1.2 + rnd() * 1.6, 0.6 + rnd() * 0.8, rnd() * 3, 0, 7); g.fill();
  }
});
const earthTile = () => tile(512, (g, s) => {
  const rnd = seeded(23);
  g.fillStyle = "#755637"; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 160; i++) {                           // lighter where it is trodden hard, darker where damp
    g.fillStyle = `rgba(${rnd() < 0.5 ? "58,40,24" : "150,118,78"},${0.05 + rnd() * 0.07})`;
    const x = rnd() * s, y = rnd() * s, r = 18 + rnd() * 60;
    around(g, s, x, y, (px, py) => { g.beginPath(); g.arc(px, py, r, 0, 7); g.fill(); });
  }
  for (let i = 0; i < 16000; i++) {                         // grit
    const v = rnd();
    g.fillStyle = `rgba(${66 + v * 96},${46 + v * 76},${26 + v * 54},${0.1 + rnd() * 0.25})`;
    const d = 1 + rnd() * 2.4;
    g.fillRect(rnd() * s, rnd() * s, d, d);
  }
  for (let i = 0; i < 26; i++) {                            // cracks and scuffs
    g.strokeStyle = `rgba(48,32,18,${0.18 + rnd() * 0.2})`; g.lineWidth = 0.8 + rnd();
    let x = rnd() * s, y = rnd() * s;
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < 6; k++) { x += (rnd() - 0.5) * 34; y += (rnd() - 0.5) * 34; g.lineTo(x, y); }
    g.stroke();
  }
  for (let i = 0; i < 150; i++) {                           // pebbles, each with a dark side
    const x = rnd() * s, y = rnd() * s, r = 1.2 + rnd() * 2.6, v = rnd();
    g.fillStyle = "rgba(30,20,12,0.45)"; g.beginPath(); g.ellipse(x + 0.8, y + 0.9, r, r * 0.8, 0, 0, 7); g.fill();
    g.fillStyle = `rgb(${128 + v * 60},${118 + v * 52},${100 + v * 46})`; g.beginPath(); g.ellipse(x, y, r, r * 0.8, rnd() * 3, 0, 7); g.fill();
  }
});

let made: { grass: CanvasTexture; earth: CanvasTexture; paint: CanvasTexture } | null = null;
/** Painted once and kept: the scene can be set up more than once while its models are still arriving. */
function painted() {
  if (!made) {
    const grass = grassTile(); grass.repeat.set(420 / 6, 240 / 6);       // 6 m a repeat: the trail's 30 m loop is five of them
    const t0 = performance.now();
    made = { grass, earth: earthTile(), paint: paintGround() };
    console.debug(`ground painted in ${Math.round(performance.now() - t0)} ms`);
  }
  return made;
}

export function Ground() {
  const tex = painted();
  const shade = useRef({ value: 0.3 });
  const material = useMemo(() => {
    const m = new MeshLambertMaterial({ map: tex.grass });
    m.onBeforeCompile = (sh) => {
      sh.uniforms.uPaint = { value: tex.paint };
      sh.uniforms.uEarth = { value: tex.earth };
      sh.uniforms.uShade = shade.current;
      sh.vertexShader = sh.vertexShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vGround;")
        .replace("#include <begin_vertex>", "#include <begin_vertex>\nvGround = (modelMatrix * vec4(position, 1.0)).xyz;");
      sh.fragmentShader = sh.fragmentShader
        .replace("#include <common>", "#include <common>\nvarying vec3 vGround;\nuniform sampler2D uPaint;\nuniform sampler2D uEarth;\nuniform float uShade;")
        .replace("#include <map_fragment>", `#include <map_fragment>
          vec3 paint = texture2D(uPaint, (vGround.xz - vec2(${RECT.x0.toFixed(2)}, ${RECT.z0.toFixed(2)})) / vec2(${RECT.w.toFixed(2)}, ${RECT.d.toFixed(2)})).rgb;
          vec3 earth = texture2D(uEarth, vGround.xz / 3.0).rgb;
          diffuseColor.rgb = mix(diffuseColor.rgb, earth, paint.r);
          diffuseColor.rgb *= (1.0 - 0.5 * paint.g) * (1.0 - uShade * paint.b);`);
    };
    return m;
  }, [tex]);
  useEffect(() => () => material.dispose(), [material]);
  // shadows are firm by day and faint under the moon
  useFrame(() => { shade.current.value = 0.2 + 0.36 * live.daylight; });
  return (
    <mesh rotation-x={-Math.PI / 2} position={[46, 0, 0]} receiveShadow material={material}>
      <planeGeometry args={[420, 240]} />
    </mesh>
  );
}
