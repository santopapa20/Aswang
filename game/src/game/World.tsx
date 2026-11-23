import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  BufferAttribute, BufferGeometry, CanvasTexture, CatmullRomCurve3, Color, DirectionalLight, DoubleSide, FogExp2, Group,
  HemisphereLight, IcosahedronGeometry, InstancedMesh, Mesh, MeshStandardMaterial, Object3D, PointLight,
  RepeatWrapping, SRGBColorSpace, Vector2, Vector3,
} from "three";
import { useProp } from "./useProp";
import { live, useGame } from "./state";
import {
  balete, Blob, bushes, decor, FENCE_LENGTH, fences, firePit, home, houses, HUT, nodes, openings, palms, patches, paths, rocks, seeded,
  trail, tufts, well,
} from "./layout";

// ---- painted textures (made once, no image files) --------------------------------------------
function canvasTexture(size: number, paint: (g: CanvasRenderingContext2D, size: number) => void, colour = true) {
  const c = document.createElement("canvas");
  c.width = c.height = size;
  paint(c.getContext("2d")!, size);
  const tex = new CanvasTexture(c);
  tex.wrapS = tex.wrapT = RepeatWrapping;
  if (colour) tex.colorSpace = SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}
const grassTexture = () => canvasTexture(512, (g, s) => {
  const rnd = seeded(11);
  g.fillStyle = "#363a22"; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 260; i++) {                           // broad mottling: damp and dry ground
    g.fillStyle = `rgba(${rnd() < 0.5 ? "30,34,18" : "86,78,44"},${0.05 + rnd() * 0.07})`;
    const x = rnd() * s, y = rnd() * s, r = 14 + rnd() * 46;
    for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) { g.beginPath(); g.arc(x + ox, y + oy, r, 0, 7); g.fill(); }
  }
  for (let i = 0; i < 9000; i++) {                          // blades
    const x = rnd() * s, y = rnd() * s, l = 3 + rnd() * 6, a = -Math.PI / 2 + (rnd() - 0.5) * 1.4;
    const v = rnd();
    g.strokeStyle = `rgba(${52 + v * 44},${66 + v * 46},${28 + v * 22},${0.14 + rnd() * 0.2})`;
    g.lineWidth = 0.7 + rnd() * 0.8;
    g.beginPath(); g.moveTo(x, y); g.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); g.stroke();
  }
});
const dirtTexture = () => canvasTexture(256, (g, s) => {
  const rnd = seeded(23);
  g.fillStyle = "#77593a"; g.fillRect(0, 0, s, s);
  for (let i = 0; i < 5200; i++) {
    const v = rnd();
    g.fillStyle = `rgba(${70 + v * 90},${50 + v * 70},${28 + v * 50},${0.12 + rnd() * 0.25})`;
    const d = 1 + rnd() * 2.6;
    g.fillRect(rnd() * s, rnd() * s, d, d);
  }
  for (let i = 0; i < 60; i++) {                            // pebbles
    g.fillStyle = `rgba(${150 + rnd() * 50},${140 + rnd() * 40},${120 + rnd() * 40},0.5)`;
    g.beginPath(); g.ellipse(rnd() * s, rnd() * s, 1 + rnd() * 2, 0.8 + rnd() * 1.4, rnd() * 3, 0, 7); g.fill();
  }
});
/** White where the path is solid, fading raggedly to black at both edges (U runs across the path). */
const pathEdge = () => canvasTexture(128, (g, s) => {
  const rnd = seeded(5);
  g.fillStyle = "#000"; g.fillRect(0, 0, s, s);
  void rnd;
  for (let y = 0; y < s; y++) {
    const a = (y / s) * Math.PI * 2;
    const l = 0.27 + 0.035 * Math.sin(a) + 0.02 * Math.sin(a * 3 + 1), r = 0.73 + 0.035 * Math.sin(a + 2) + 0.02 * Math.sin(a * 2 + 4);
    const grad = g.createLinearGradient(0, 0, s, 0);
    grad.addColorStop(Math.max(0, l - 0.22), "#000"); grad.addColorStop(l - 0.08, "#777"); grad.addColorStop(l, "#fff");
    grad.addColorStop(r, "#fff"); grad.addColorStop(r + 0.08, "#777"); grad.addColorStop(Math.min(1, r + 0.22), "#000");
    g.fillStyle = grad; g.fillRect(0, y, s, 1);
  }
}, false);
const patchEdge = () => canvasTexture(128, (g, s) => {
  const grad = g.createRadialGradient(s / 2, s / 2, s * 0.22, s / 2, s / 2, s * 0.5);
  grad.addColorStop(0, "#fff"); grad.addColorStop(0.7, "#888"); grad.addColorStop(1, "#000");
  g.fillStyle = grad; g.fillRect(0, 0, s, s);
}, false);

/** One strip of ground along each path, wide enough for its soft edges. */
function pathGeometry() {
  const pos: number[] = [], uv: number[] = [], idx: number[] = [];
  for (const p of paths) {
    const curve = new CatmullRomCurve3(p.pts.map(([x, z]) => new Vector3(x, 0, z)), false, "catmullrom", 0.4);
    const n = Math.max(2, Math.ceil(curve.getLength() / 0.9));
    const pts = curve.getSpacedPoints(n);
    const half = p.w * 1.1, base = pos.length / 3;
    let along = 0;
    for (let i = 0; i <= n; i++) {
      const a = pts[Math.max(0, i - 1)], b = pts[Math.min(n, i + 1)];
      const t = new Vector2(b.x - a.x, b.z - a.z).normalize();
      if (i > 0) along += pts[i].distanceTo(pts[i - 1]);
      pos.push(pts[i].x - t.y * half, 0, pts[i].z + t.x * half, pts[i].x + t.y * half, 0, pts[i].z - t.x * half);
      uv.push(0, along / 3, 1, along / 3);        // 3 m per repeat: the trail's 30 m loop is a whole number of them
      if (i < n) { const k = base + i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("uv", new BufferAttribute(new Float32Array(uv), 2));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

/** Three bent blades of grass. */
function tuftGeometry() {
  const pos: number[] = [], col: number[] = [];
  for (let b = 0; b < 5; b++) {
    const a = b * 1.26, lean = 0.1 + (b % 3) * 0.06, h = 0.2 + (b % 3) * 0.08, w = 0.05;
    const cx = Math.cos(a), cz = Math.sin(a);
    pos.push(-cz * w, 0, cx * w, cz * w, 0, -cx * w, cx * lean, h, cz * lean);
    col.push(0.08, 0.11, 0.045, 0.08, 0.11, 0.045, 0.24, 0.31, 0.12);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("color", new BufferAttribute(new Float32Array(col), 3));
  g.computeVertexNormals();
  return g;
}

/** A clump of undergrowth: a few lumpy, overlapping mounds, shaded dark underneath and lighter on top. */
function bushGeometry() {
  const pos: number[] = [], nor: number[] = [], col: number[] = [];
  const lumps: [number, number, number, number][] = [[0, 0.55, 0, 1], [0.62, 0.42, 0.18, 0.72], [-0.55, 0.46, -0.3, 0.78], [0.12, 0.36, 0.62, 0.62], [-0.2, 0.4, -0.7, 0.6]];
  const hash = (x: number, y: number, z: number) => { const h = Math.sin(x * 12.9898 + y * 78.233 + z * 37.719) * 43758.5453; return h - Math.floor(h); };
  for (const [cx, cy, cz, r] of lumps) {
    const p = new IcosahedronGeometry(r, 1).getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i), z = p.getZ(i), len = Math.hypot(x, y, z) || 1;
      const k = 1 + (hash(x + cx, y, z + cz) - 0.5) * 0.42;            // the same point always moves the same way, so no cracks
      const py = Math.max(0, cy + y * k);
      pos.push(cx + x * k, py, cz + z * k);
      nor.push(x / len, y / len, z / len);
      const light = 0.42 + 0.58 * Math.min(1, py / 1.3) * (0.8 + 0.4 * hash(z, x, y));
      col.push(0.62 * light, 0.9 * light, 0.5 * light);
    }
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("normal", new BufferAttribute(new Float32Array(nor), 3));
  g.setAttribute("color", new BufferAttribute(new Float32Array(col), 3));
  return g;
}

/** Splits scattered things into squares of ground, so each square can be skipped when it is off screen. */
function inSquares(items: Blob[], size: number) {
  const squares = new Map<string, Blob[]>();
  for (const it of items) {
    const key = `${Math.floor(it.x / size)},${Math.floor(it.z / size)}`;
    if (!squares.has(key)) squares.set(key, []);
    squares.get(key)!.push(it);
  }
  return [...squares.values()];
}

function Scatter({ items, geometry, colour, squash, vary, flat, sway, tinted }: {
  items: Blob[]; geometry: BufferGeometry; colour: string; squash: [number, number, number]; vary: number; flat?: boolean; sway?: boolean; tinted?: boolean;
}) {
  const ref = useRef<InstancedMesh>(null);
  useLayoutEffect(() => {
    const m = ref.current!;
    const o = new Object3D(), c = new Color(), rnd = seeded(items.length);
    items.forEach((it, i) => {
      o.position.set(it.x, 0, it.z); o.rotation.set(0, it.r, 0);
      o.scale.set(it.s * squash[0], it.s * squash[1], it.s * squash[2]);
      o.updateMatrix(); m.setMatrixAt(i, o.matrix);
      const v = 1 - vary / 2 + rnd() * vary;
      m.setColorAt(i, c.set(colour).multiplyScalar(v));
    });
    m.instanceMatrix.needsUpdate = true;
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
    m.computeBoundingSphere();
  }, [items, colour, squash, vary]);
  return (
    <instancedMesh ref={ref} args={[geometry, undefined, items.length]} receiveShadow={!sway}>
      <meshLambertMaterial vertexColors={!!sway || !!tinted} side={sway ? DoubleSide : undefined} flatShading={flat} />
    </instancedMesh>
  );
}

// ---- light and sky by time of day ------------------------------------------------------------
const SKY = { night: new Color("#0a1024"), dusk: new Color("#5a3a3c"), day: new Color("#b9c4c9") };
const HEMI_SKY = { night: new Color("#3a4f96"), dusk: new Color("#d49a78"), day: new Color("#fff3da") };
const HEMI_GROUND = { night: new Color("#14121c"), dusk: new Color("#3a2c2a"), day: new Color("#6d6247") };
const SUN = { night: new Color("#7f9bff"), dusk: new Color("#ff9d5c"), day: new Color("#fff1d2") };
const three = (out: Color, set: { night: Color; dusk: Color; day: Color }, t: number) =>
  t < 0.5 ? out.lerpColors(set.night, set.dusk, t * 2) : out.lerpColors(set.dusk, set.day, t * 2 - 2 + 1);

export function World() {
  const { scene } = useThree();
  const shadows = useGame((s) => s.shadows);
  const tex = useMemo(() => {
    const grass = grassTexture(); grass.repeat.set(70, 40);
    const dirt = dirtTexture();
    const dirtPatch = dirtTexture(); dirtPatch.repeat.set(3, 3);
    return { grass, dirt, dirtPatch, edge: pathEdge(), round: patchEdge() };
  }, []);
  const geo = useMemo(() => ({
    path: pathGeometry(), tuft: tuftGeometry(), bush: bushGeometry(), rock: new IcosahedronGeometry(1, 0),
  }), []);

  const squares = useMemo(() => ({ tufts: inSquares(tufts, 24), bushes: inSquares(bushes, 24) }), []);
  const hutModels = useProp("/models/hut.glb", HUT.height, "y", houses.length, shadows);
  const fenceModels = useProp("/models/fence.glb", FENCE_LENGTH, "x", fences.length, shadows);
  const palmModels = useProp("/models/palm.glb", 1, "y", palms.length, shadows);     // 1 m tall, scaled per tree below
  const wellModels = useProp("/models/well.glb", 2.5, "y", 1, shadows);
  const baleteModels = useProp("/models/balete.glb", balete.height, "y", 1, shadows);

  const hemi = useRef<HemisphereLight>(null);
  const sun = useRef<DirectionalLight>(null);
  const fog = useMemo(() => new FogExp2(SKY.night.getHex(), 0.03), []);
  const sky = useMemo(() => SKY.night.clone(), []);
  useEffect(() => { scene.fog = fog; scene.background = sky; return () => { scene.fog = null; }; }, [scene, fog, sky]);

  const acc = useRef({ t: 0, n: 0 });
  useFrame((_, dt) => {
    acc.current.t += dt; acc.current.n += 1;
    if (acc.current.t >= 0.5) { live.fps = acc.current.n / acc.current.t; acc.current.t = 0; acc.current.n = 0; }

    // anything tall standing between the camera and the player would cover him, so hide those
    const px = live.player.x, pz = live.player.z;
    for (let i = 0; i < palms.length; i++) {
      const dx = palms[i].x - px, dz = palms[i].z - pz;
      palmModels[i].visible = !(dz > 0.8 && dz < 1.6 + palms[i].h && Math.abs(dx) < 2.6);
    }
    for (let i = 0; i < houses.length; i++) {
      const dx = houses[i].x - px, dz = houses[i].z - pz;
      hutModels[i].visible = !(dz > HUT.hz + 0.3 && dz < 7.5 && Math.abs(dx) < HUT.hx + 1.2);
    }
    {
      const dx = balete.x - px, dz = balete.z - pz;
      baleteModels[0].visible = !(dz > 1.2 && dz < 6 + balete.height * 0.6 && Math.abs(dx) < balete.height * 0.6);
    }

    const t = live.daylight;
    three(sky, SKY, t);
    fog.color.copy(sky);
    fog.density = 0.03 - 0.021 * t;
    if (hemi.current) {
      three(hemi.current.color, HEMI_SKY, t); three(hemi.current.groundColor, HEMI_GROUND, t);
      hemi.current.intensity = 1.5 + 1.3 * t;
    }
    if (sun.current) { three(sun.current.color, SUN, t); sun.current.intensity = 1.7 + 1.5 * t; }
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={["#27356b", "#0b0a10", 1.5]} />
      <directionalLight ref={sun} position={[-14, 22, -8]} color="#7f9bff" intensity={1.7} />

      {/* the ground: grass everywhere, worn earth where people walk and sweep */}
      <mesh rotation-x={-Math.PI / 2} position={[46, 0, 0]} receiveShadow>
        <planeGeometry args={[420, 240]} />
        <meshStandardMaterial map={tex.grass} roughness={1} metalness={0} />
      </mesh>
      {patches.map((p, i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} position={[p.x, 0.012, p.z]} renderOrder={1} receiveShadow>
          <circleGeometry args={[p.r, 28]} />
          <meshStandardMaterial map={tex.dirtPatch} alphaMap={tex.round} transparent depthWrite={false} roughness={1} />
        </mesh>
      ))}
      <mesh geometry={geo.path} position={[0, 0.02, 0]} renderOrder={2} receiveShadow>
        <meshStandardMaterial map={tex.dirt} alphaMap={tex.edge} transparent depthWrite={false} roughness={1} />
      </mesh>

      {squares.tufts.map((part, i) => <Scatter key={`t${i}`} items={part} geometry={geo.tuft} colour="#ffffff" squash={[1, 1, 1]} vary={0.5} sway />)}
      {squares.bushes.map((part, i) => <Scatter key={`b${i}`} items={part} geometry={geo.bush} colour="#3a5230" squash={[0.72, 0.62, 0.72]} vary={0.35} tinted />)}
      <Scatter items={rocks} geometry={geo.rock} colour="#6f6a62" squash={[1, 0.55, 0.8]} vary={0.3} flat />

      {houses.map((h, i) => (
        <group key={h.id} position={[h.x, 0, h.z]}>
          <primitive object={hutModels[i]} />
          <HouseFront lit={h.lit} beacon={h.id === "home"} />
        </group>
      ))}
      {fences.map((f, i) => (
        <primitive key={`fence${i}`} object={fenceModels[i]} position={[f.x, 0, f.z]} rotation-y={f.rot} />
      ))}
      {palms.map((t, i) => (
        <primitive key={`palm${i}`} object={palmModels[i]} position={[t.x, 0, t.z]} rotation-y={i * 2.4} rotation-z={t.lean * 0.4} scale={[t.h * 0.82, t.h, t.h * 0.82]} />
      ))}
      <primitive object={wellModels[0]} position={[well.x, 0, well.z]} rotation-y={0.6} />
      <primitive object={baleteModels[0]} position={[balete.x, 0, balete.z]} rotation-y={0.9} />

      <HomeYard />
      <Dressing />
      <LootNodes />
      <SaltLines />
      <TrailMarker />
    </>
  );
}

/** What the hut model lacks: a doorway, a ladder up to it, and a window that glows after dark. */
function HouseFront({ lit, beacon }: { lit: boolean; beacon: boolean }) {
  const pane = useRef<MeshStandardMaterial>(null);
  const glow = useRef<PointLight>(null);
  useFrame(({ clock }) => {
    const dark = 1 - live.daylight;
    const f = 0.9 + 0.1 * Math.sin(clock.elapsedTime * 7.3 + (beacon ? 0 : 2));
    if (pane.current) pane.current.emissiveIntensity = lit ? 2.6 * dark * f : 0;
    if (glow.current) glow.current.intensity = 9 * dark * f;
  });
  const z = HUT.hz + 0.02, floor = 1.12;
  return (
    <group>
      <mesh position={[-0.55, floor + 0.8, z]}>
        <planeGeometry args={[0.85, 1.6]} />
        <meshStandardMaterial color="#2b1c10" roughness={1} />
      </mesh>
      {[-1.0, -0.1].map((x) => (
        <mesh key={x} position={[x, floor + 0.8, z + 0.02]}><boxGeometry args={[0.07, 1.7, 0.05]} /><meshStandardMaterial color="#8a6a3a" roughness={0.9} /></mesh>
      ))}
      <mesh position={[-0.55, floor + 1.66, z + 0.02]}><boxGeometry args={[1.0, 0.07, 0.05]} /><meshStandardMaterial color="#8a6a3a" roughness={0.9} /></mesh>
      <mesh position={[0.95, floor + 1.05, z]}>
        <planeGeometry args={[0.72, 0.62]} />
        <meshStandardMaterial ref={pane} color={lit ? "#4a371f" : "#241a10"} emissive="#ffb055" emissiveIntensity={0} roughness={1} />
      </mesh>
      {/* bamboo ladder */}
      <group position={[-0.55, 0, HUT.hz + 0.05]} rotation-x={0.62}>
        {[-0.3, 0.3].map((x) => (
          <mesh key={x} position={[x, 0.72, 0]}><cylinderGeometry args={[0.035, 0.04, 1.5, 6]} /><meshStandardMaterial color="#8a6a3a" roughness={0.9} /></mesh>
        ))}
        {[0.25, 0.6, 0.95, 1.3].map((y) => (
          <mesh key={y} position={[0, y, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.028, 0.028, 0.66, 6]} /><meshStandardMaterial color="#9a7a46" roughness={0.9} /></mesh>
        ))}
      </group>
      {beacon && <pointLight ref={glow} position={[0.95, 2.2, HUT.hz + 0.9]} color="#ffae5c" intensity={0} distance={8} decay={1.7} />}
    </group>
  );
}

/** The house you guard: a peg at each opening for its protection, and the smudge fire. */
function HomeYard() {
  const wards = useGame((s) => s.wards);
  const garlic = useProp("/models/garlic.glb", 0.5, "y", 3, false);
  const flame = useRef<Group>(null);
  const fire = useRef<PointLight>(null);
  const smoke = useRef<Group>(null);
  useFrame(({ clock }) => {
    const on = live.smoke > 0;
    const t = clock.elapsedTime;
    if (flame.current) { flame.current.visible = on; flame.current.scale.y = 0.8 + 0.25 * Math.sin(t * 13) + 0.1 * Math.sin(t * 29); }
    if (fire.current) fire.current.intensity = on ? 7 + 2.5 * Math.sin(t * 11) : 0;
    if (smoke.current) {
      smoke.current.visible = on;
      smoke.current.children.forEach((c, i) => {
        const k = (t * 0.32 + i / smoke.current!.children.length) % 1;
        c.position.set(Math.sin(i * 2.3 + t * 0.6) * 0.3 * k - k * 2.6, 0.4 + k * 4.2, -k * 2.2);
        c.scale.setScalar(0.25 + k * 0.9);
        ((c as Mesh).material as MeshStandardMaterial).opacity = 0.3 * (1 - k);
      });
    }
  });
  return (
    <>
      {openings.map((o, i) => {
        const side = o.id === "door" ? 0 : o.id === "west" ? -1 : 1;
        return (
          <group key={o.id} position={[o.x, 0, o.z]}>
            <mesh position={[side * 0.55 || 0.75, 0.55, side ? 0.5 : 0.1]}>
              <cylinderGeometry args={[0.035, 0.045, 1.1, 6]} />
              <meshStandardMaterial color="#8a6a3a" roughness={0.9} />
            </mesh>
            {wards[o.id] === "garlic" && <primitive object={garlic[i]} position={[side * 0.55 || 0.75, 0.55, side ? 0.62 : 0.22]} />}
            {wards[o.id] === "salt" && (
              <mesh position={[0, 0.03, side ? 0 : -0.25]} rotation-y={side ? Math.PI / 2 : 0}>
                <boxGeometry args={[1.5, 0.03, 0.16]} />
                <meshStandardMaterial color="#f6f4ee" emissive="#dfe6ff" emissiveIntensity={0.7} roughness={1} />
              </mesh>
            )}
          </group>
        );
      })}
      <group position={[firePit.x, 0, firePit.z]}>
        {Array.from({ length: 9 }, (_, i) => (
          <mesh key={i} position={[Math.cos(i * 0.7) * 0.42, 0.07, Math.sin(i * 0.7) * 0.42]} rotation-y={i} scale={[1, 0.6, 0.8]}>
            <icosahedronGeometry args={[0.12, 0]} />
            <meshStandardMaterial color="#5f5a53" roughness={1} flatShading />
          </mesh>
        ))}
        <mesh rotation-x={-Math.PI / 2} position={[0, 0.02, 0]}><circleGeometry args={[0.36, 14]} /><meshStandardMaterial color="#1a1614" roughness={1} /></mesh>
        <group ref={flame} position={[0, 0.08, 0]} visible={false}>
          {[0, Math.PI / 2].map((r) => (
            <mesh key={r} position={[0, 0.22, 0]} rotation-y={r}><coneGeometry args={[0.16, 0.5, 5, 1, true]} /><meshBasicMaterial color="#ff9a3c" transparent opacity={0.85} side={DoubleSide} /></mesh>
          ))}
        </group>
        <group ref={smoke} visible={false}>
          {Array.from({ length: 7 }, (_, i) => (
            <mesh key={i}><icosahedronGeometry args={[0.5, 1]} /><meshStandardMaterial color="#9a958c" transparent opacity={0.2} depthWrite={false} roughness={1} /></mesh>
          ))}
        </group>
        <pointLight ref={fire} position={[0, 0.5, 0]} color="#ff8a3a" intensity={0} distance={6} decay={1.8} />
      </group>
    </>
  );
}

/** Shrubs, ferns and rock piles from the gallery models. */
function Dressing() {
  const shadows = useGame((s) => s.shadows);
  const of = (kind: string) => decor.filter((d) => d.kind === kind);
  const shrubs = useProp("/models/shrub.glb", 1.5, "y", of("shrub").length, shadows);
  const ferns = useProp("/models/fern.glb", 1.0, "y", of("fern").length, shadows);
  const piles = useProp("/models/rocks.glb", 1.3, "x", of("rocks").length, shadows);
  const sets: [string, Object3D[]][] = [["shrub", shrubs], ["fern", ferns], ["rocks", piles]];
  return (
    <>
      {sets.map(([kind, models]) => of(kind).map((d, i) => (
        <primitive key={kind + i} object={models[i]} position={[d.x, 0, d.z]} rotation-y={d.r} scale={d.s} />
      )))}
    </>
  );
}

/** Chests, jars, sacks, fronds and herbs. A searched one looks searched. */
function LootNodes() {
  const searched = useGame((s) => s.searched);
  const count = (kind: string) => nodes.filter((n) => n.kind === kind).length;
  const model: Record<string, Object3D[]> = {
    baul: useProp("/models/chest.glb", 0.95, "x", count("baul"), false),
    banga: useProp("/models/pot.glb", 0.62, "y", count("banga"), false),
    sako: useProp("/models/sack.glb", 0.78, "y", count("sako"), false),
    kindling: useProp("/models/logs.glb", 0.95, "x", count("kindling"), false),
    herbs: useProp("/models/fern.glb", 0.55, "y", count("herbs"), false),
  };
  const nth: Record<string, number> = {};
  return (
    <>
      {nodes.map((n) => {
        const done = searched.includes(n.id);
        const i = (nth[n.kind] = (nth[n.kind] ?? -1) + 1);
        // searched: firewood and herbs are taken; a pot or sack lies on its side; a chest is left askew
        const gone = done && (n.kind === "kindling" || n.kind === "herbs");
        const tip = !done ? 0 : n.kind === "banga" ? 1.4 : n.kind === "sako" ? 1.45 : 0;
        return (
          <group key={n.id} position={[n.x, 0, n.z]} rotation-y={n.rot} visible={!gone}>
            <group rotation-z={tip} position-y={tip ? 0.28 : 0} rotation-x={done && n.kind === "baul" ? -0.22 : 0}>
              <primitive object={model[n.kind][i]} />
            </group>
          </group>
        );
      })}
    </>
  );
}

function SaltLines() {
  const lines = useGame((s) => s.lines);
  return (
    <>
      {lines.map((l, i) => {
        const dx = l.bx - l.ax, dz = l.bz - l.az;
        return (
          <mesh key={i} position={[(l.ax + l.bx) / 2, 0.035, (l.az + l.bz) / 2]} rotation-y={-Math.atan2(dz, dx)}>
            <boxGeometry args={[Math.hypot(dx, dz), 0.03, 0.16]} />
            <meshStandardMaterial color="#f6f4ee" emissive="#dfe6ff" emissiveIntensity={0.7} roughness={1} />
          </mesh>
        );
      })}
    </>
  );
}

/** A post with a red rag, halfway along the trail. You should only ever pass it once. */
function TrailMarker() {
  return (
    <group position={[trail.marker.x, 0, trail.marker.z]}>
      <mesh position={[0, 0.8, 0]} rotation-z={0.08}><cylinderGeometry args={[0.05, 0.07, 1.6, 6]} /><meshStandardMaterial color="#6d5535" roughness={1} /></mesh>
      <mesh position={[0.2, 1.4, 0.05]} rotation-z={-0.5}><boxGeometry args={[0.42, 0.26, 0.02]} /><meshStandardMaterial color="#a32a22" emissive="#5a0f0a" emissiveIntensity={0.5} roughness={1} side={DoubleSide} /></mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} position={[0.3 + i * 0.16, 0.08, 0.3 - i * 0.1]} scale={[1, 0.6, 0.8]}><icosahedronGeometry args={[0.13 - i * 0.02, 0]} /><meshStandardMaterial color="#77726a" flatShading roughness={1} /></mesh>
      ))}
    </group>
  );
}

useGLTF.preload("/models/hut.glb");
useGLTF.preload("/models/fence.glb");
useGLTF.preload("/models/palm.glb");
useGLTF.preload("/models/well.glb");
useGLTF.preload("/models/balete.glb");
