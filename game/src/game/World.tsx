import { useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import {
  BufferAttribute, BufferGeometry, Color, DirectionalLight, DoubleSide, FogExp2, Group,
  HemisphereLight, IcosahedronGeometry, InstancedMesh, Mesh, MeshLambertMaterial, Object3D, PointLight,
} from "three";
import { mergeVertices } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { Ground } from "./Ground";
import { Atmosphere } from "./Atmosphere";
import { useProp } from "./useProp";
import { live, useGame } from "./state";
import {
  balete, Blob, bushes, decor, FENCE_LENGTH, fences, firePit, home, houses, HUT, nodes, openings, palms, rocks, seeded,
  trail, tufts, well,
} from "./layout";

/** A clump of grass: a dozen bent blades of different heights, dark at the root and pale at the tip. */
function tuftGeometry() {
  const pos: number[] = [], col: number[] = [];
  const rnd = seeded(77);
  for (let b = 0; b < 9; b++) {
    const a = b * 2.4 + rnd(), out = 0.02 + rnd() * 0.1, h = 0.16 + rnd() * 0.24, lean = 0.05 + rnd() * 0.16, w = 0.022 + rnd() * 0.02;
    const cx = Math.cos(a), cz = Math.sin(a), bx = cx * out, bz = cz * out;
    const mx = bx + cx * lean * 0.4, mz = bz + cz * lean * 0.4, tx = bx + cx * lean, tz = bz + cz * lean;
    // two pieces to a blade, so it bends
    pos.push(bx - cz * w, 0, bz + cx * w, bx + cz * w, 0, bz - cx * w, mx + cz * w * 0.7, h * 0.55, mz - cx * w * 0.7);
    pos.push(bx - cz * w, 0, bz + cx * w, mx + cz * w * 0.7, h * 0.55, mz - cx * w * 0.7, mx - cz * w * 0.7, h * 0.55, mz + cx * w * 0.7);
    pos.push(mx - cz * w * 0.7, h * 0.55, mz + cx * w * 0.7, mx + cz * w * 0.7, h * 0.55, mz - cx * w * 0.7, tx, h, tz);
    const dry = rnd() < 0.2;
    const root = [0.07, 0.1, 0.04], mid = dry ? [0.3, 0.29, 0.12] : [0.17, 0.25, 0.09], tip = dry ? [0.48, 0.44, 0.2] : [0.3, 0.4, 0.14];
    col.push(...root, ...root, ...mid, ...root, ...mid, ...mid, ...mid, ...mid, ...tip);
  }
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("color", new BufferAttribute(new Float32Array(col), 3));
  g.computeVertexNormals();
  return g;
}

/** A stone: a lumpy ball, smooth-shaded, darker below and mossy on top. */
function rockGeometry() {
  const g = mergeVertices(new IcosahedronGeometry(1, 2).deleteAttribute("normal").deleteAttribute("uv"));
  const p = g.getAttribute("position"), col: number[] = [];
  const n = (x: number, y: number, z: number) => Math.sin(x * 2.1 + y * 1.3) * Math.cos(z * 2.4 - y * 0.7) * 0.5 + Math.sin(x * 4.7 - z * 3.9 + y * 5.1) * 0.22;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i), k = 1 + n(x, y, z) * 0.34;
    p.setXYZ(i, x * k, Math.max(-0.35, y * k), z * k);
    const light = 0.5 + 0.5 * Math.min(1, Math.max(0, y * 0.7 + 0.5)), moss = Math.max(0, y - 0.35) * (0.6 + n(z, x, y));
    col.push(0.5 * light * (1 - moss * 0.5), 0.48 * light * (1 + moss * 0.15), 0.44 * light * (1 - moss * 0.7));
  }
  g.setAttribute("color", new BufferAttribute(new Float32Array(col), 3));
  g.computeVertexNormals();
  return g;
}

/**
 * A clump of undergrowth: broad leaves on arching stems, the way gabi, wild ginger and young banana
 * grow at the edge of a clearing. Outer leaves droop, inner ones stand; dark at the stem, paler at the tip.
 */
function bushGeometry() {
  const pos: number[] = [], col: number[] = [], nor: number[] = [];
  const rnd = seeded(31);
  const leaf = (a: number, reach: number, rise: number, droop: number, wide: number, shade: number) => {
    const cx = Math.cos(a), cz = Math.sin(a);
    // four stations along the leaf: its midrib arches up and over, its edges hang a little below the rib
    const st = [0, 0.3, 0.65, 1].map((t) => {
      const along = reach * (0.06 + 0.94 * t), up = 0.03 + rise * Math.sin(t * 2.1) - droop * t * t, w = wide * Math.pow(Math.sin(Math.PI * Math.min(1, t * 0.92 + 0.08)), 0.75);
      const tone = (0.45 + 0.75 * t) * shade;
      return {
        mid: [cx * along, up, cz * along], left: [cx * along - cz * w, up - w * 0.22, cz * along + cx * w], right: [cx * along + cz * w, up - w * 0.22, cz * along - cx * w],
        rib: [0.1 * tone, 0.2 * tone, 0.065 * tone], blade: [0.055 * tone, 0.135 * tone, 0.045 * tone],
        nl: [cx * 0.25 - cz * 0.4, 0.88, cz * 0.25 + cx * 0.4], nr: [cx * 0.25 + cz * 0.4, 0.88, cz * 0.25 - cx * 0.4], nm: [cx * 0.3, 0.95, cz * 0.3],
      };
    });
    for (let i = 0; i < 3; i++) {
      const p = st[i], q = st[i + 1];
      pos.push(...p.left, ...q.left, ...p.mid, ...p.mid, ...q.left, ...q.mid, ...p.mid, ...q.mid, ...p.right, ...p.right, ...q.mid, ...q.right);
      col.push(...p.blade, ...q.blade, ...p.rib, ...p.rib, ...q.blade, ...q.rib, ...p.rib, ...q.rib, ...p.blade, ...p.blade, ...q.rib, ...q.blade);
      nor.push(...p.nl, ...q.nl, ...p.nm, ...p.nm, ...q.nl, ...q.nm, ...p.nm, ...q.nm, ...p.nr, ...p.nr, ...q.nm, ...q.nr);
    }
  };
  for (let i = 0; i < 13; i++) leaf(i * 0.483 * 2 + rnd() * 0.4, 1.0 + rnd() * 0.6, 0.5 + rnd() * 0.3, 0.45 + rnd() * 0.3, 0.2 + rnd() * 0.1, 0.8 + rnd() * 0.45);      // the outer ring
  for (let i = 0; i < 7; i++) leaf(i * 0.9 + rnd(), 0.55 + rnd() * 0.3, 0.95 + rnd() * 0.4, 0.2, 0.15 + rnd() * 0.07, 0.95 + rnd() * 0.45);                           // young leaves, upright
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  g.setAttribute("color", new BufferAttribute(new Float32Array(col), 3));
  g.setAttribute("normal", new BufferAttribute(new Float32Array(nor), 3));
  return g;
}

/** Gives one copy of a model its own materials, drawn as a fine screen of dots when faded, so it can thin out without its twins. */
function seeThrough(o: Object3D) {
  if (o.userData.mats) return o.userData.mats as MeshLambertMaterial[];      // asked twice for the same copy: the same answer
  const mats: MeshLambertMaterial[] = [];
  o.userData.mats = mats;
  o.traverse((m) => {
    const mesh = m as Mesh;
    if (!mesh.isMesh) return;
    const mat = (mesh.material as MeshLambertMaterial).clone();
    mat.alphaHash = true;
    mesh.material = mat; mats.push(mat);
  });
  return mats;
}
let stone: BufferGeometry | null = null;
/** One shared stone, for the fire ring and the trail's marker. */
const stoneGeometry = () => (stone ??= rockGeometry());

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

/** Wind: the top of each blade drifts, the root stays put. One clock is shared by every patch of grass. */
const wind = { value: 0 };
const swaying = (amount: number) => (sh: { uniforms: Record<string, { value: unknown }>; vertexShader: string }) => {
  sh.uniforms.uWind = wind;
  sh.vertexShader = sh.vertexShader
    .replace("#include <common>", "#include <common>\nuniform float uWind;")
    .replace("#include <begin_vertex>", `#include <begin_vertex>
      #ifdef USE_INSTANCING
        vec3 root = instanceMatrix[3].xyz;
        float gust = sin(uWind * 1.3 + root.x * 0.35 + root.z * 0.27) + 0.5 * sin(uWind * 2.9 + root.x * 1.1 - root.z * 0.8);
        transformed.x += gust * ${amount.toFixed(3)} * position.y;
        transformed.z += gust * ${(amount * 0.55).toFixed(3)} * position.y;
      #endif`);
};

const grassWind = swaying(0.22), leafWind = swaying(0.05);

function Scatter({ items, geometry, colour, squash, vary, flat, sway, tinted, leaves }: {
  items: Blob[]; geometry: BufferGeometry; colour: string; squash: [number, number, number]; vary: number; flat?: boolean; sway?: boolean; tinted?: boolean; leaves?: boolean;
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
    <instancedMesh ref={ref} args={[geometry, undefined, items.length]} receiveShadow={!sway && !leaves}>
      <meshLambertMaterial vertexColors={!!sway || !!tinted || !!leaves} side={sway || leaves ? DoubleSide : undefined} flatShading={flat} onBeforeCompile={sway ? grassWind : leaves ? leafWind : undefined} />
    </instancedMesh>
  );
}

// ---- light and sky by time of day ------------------------------------------------------------
const SKY = { night: new Color("#070c1c"), dusk: new Color("#5a3a3c"), day: new Color("#b9c4c9") };
const HEMI_SKY = { night: new Color("#34488e"), dusk: new Color("#d49a78"), day: new Color("#fff3da") };
const HEMI_GROUND = { night: new Color("#14121c"), dusk: new Color("#3a2c2a"), day: new Color("#6d6247") };
const SUN = { night: new Color("#8fa9ff"), dusk: new Color("#ff9d5c"), day: new Color("#ffeccb") };
const three = (out: Color, set: { night: Color; dusk: Color; day: Color }, t: number) =>
  t < 0.5 ? out.lerpColors(set.night, set.dusk, t * 2) : out.lerpColors(set.dusk, set.day, t * 2 - 2 + 1);

export function World() {
  const { scene } = useThree();
  const shadows = useGame((s) => s.shadows);
  const geo = useMemo(() => ({ tuft: tuftGeometry(), bush: bushGeometry(), rock: rockGeometry() }), []);

  const squares = useMemo(() => ({ tufts: inSquares(tufts, 24), bushes: inSquares(bushes, 24) }), []);
  const hutModels = useProp("/models/hut.glb", HUT.height, "y", houses.length, shadows);
  const fenceModels = useProp("/models/fence.glb", FENCE_LENGTH, "x", fences.length, shadows);
  const palmModels = useProp("/models/palm.glb", 1, "y", palms.length, shadows);     // 1 m tall, scaled per tree below
  const wellModels = useProp("/models/well.glb", 2.5, "y", 1, shadows);
  const baleteModels = useProp("/models/balete.glb", balete.height, "y", 1, shadows);

  const see = useMemo(() => {
    const huts = hutModels.map(seeThrough);
    // houses nobody lives in have gone grey with weather
    houses.forEach((h, i) => { if (!h.lit) for (const m of huts[i]) m.color.setRGB(0.56, 0.58, 0.55); });
    return { palms: palmModels.map(seeThrough), huts, balete: seeThrough(baleteModels[0]) };
  }, [palmModels, hutModels, baleteModels]);

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
    const k = Math.min(1, dt * 7);
    const thin = (mats: MeshLambertMaterial[], hides: boolean, to = 0.16) => { for (const m of mats) m.opacity += ((hides ? to : 1) - m.opacity) * k; };
    for (let i = 0; i < palms.length; i++) {
      const dx = palms[i].x - px, dz = palms[i].z - pz;
      if (Math.abs(dx) > 12 || Math.abs(dz) > 14) continue;
      thin(see.palms[i], dz > 0.8 && dz < 1.6 + palms[i].h && Math.abs(dx) < 2.6);
    }
    for (let i = 0; i < houses.length; i++) {
      const dx = houses[i].x - px, dz = houses[i].z - pz;
      thin(see.huts[i], dz > HUT.hz + 0.3 && dz < 7.5 && Math.abs(dx) < HUT.hx + 1.2, 0.22);
    }
    {
      const dx = balete.x - px, dz = balete.z - pz;
      thin(see.balete, dz > 1.2 && dz < 6 + balete.height * 0.6 && Math.abs(dx) < balete.height * 0.6, 0.22);
    }

    wind.value += Math.min(dt, 0.1);
    const t = live.daylight;
    three(sky, SKY, t);
    fog.color.copy(sky);
    fog.density = 0.03 - 0.021 * t;
    if (hemi.current) {
      three(hemi.current.color, HEMI_SKY, t); three(hemi.current.groundColor, HEMI_GROUND, t);
      hemi.current.intensity = 1.15 + 1.5 * t;
    }
    if (sun.current) { three(sun.current.color, SUN, t); sun.current.intensity = 2.1 + 1.3 * t; }
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={["#27356b", "#0b0a10", 1.5]} />
      <directionalLight ref={sun} position={[-14, 22, -8]} color="#7f9bff" intensity={1.7} />

      <Ground />
      <Atmosphere />

      {squares.tufts.map((part, i) => <Scatter key={`t${i}`} items={part} geometry={geo.tuft} colour="#ffffff" squash={[1, 1, 1]} vary={0.5} sway />)}
      {squares.bushes.map((part, i) => <Scatter key={`b${i}`} items={part} geometry={geo.bush} colour="#a4bd90" squash={[1, 1, 1]} vary={0.4} leaves />)}
      <Scatter items={rocks} geometry={geo.rock} colour="#b9b2a6" squash={[1, 0.6, 0.8]} vary={0.3} tinted />

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
  const pane = useRef<MeshLambertMaterial>(null);
  const glow = useRef<PointLight>(null);
  useFrame(({ clock }) => {
    const dark = 1 - live.daylight;
    const f = 0.9 + 0.1 * Math.sin(clock.elapsedTime * 7.3 + (beacon ? 0 : 2));
    if (pane.current) pane.current.emissiveIntensity = lit ? 0.75 * dark * f : 0;
    if (glow.current) glow.current.intensity = 9 * dark * f;
  });
  const z = HUT.hz + 0.02, floor = 1.12;
  return (
    <group>
      <mesh position={[-0.55, floor + 0.8, z]}>
        <planeGeometry args={[0.85, 1.6]} />
        <meshLambertMaterial color="#2b1c10" />
      </mesh>
      {[-1.0, -0.1].map((x) => (
        <mesh key={x} position={[x, floor + 0.8, z + 0.02]}><boxGeometry args={[0.07, 1.7, 0.05]} /><meshLambertMaterial color="#8a6a3a" /></mesh>
      ))}
      <mesh position={[-0.55, floor + 1.66, z + 0.02]}><boxGeometry args={[1.0, 0.07, 0.05]} /><meshLambertMaterial color="#8a6a3a" /></mesh>
      <mesh position={[0.95, floor + 1.05, z]}>
        <planeGeometry args={[0.72, 0.62]} />
        <meshLambertMaterial ref={pane} color={lit ? "#4a371f" : "#241a10"} emissive="#ff9a3d" emissiveIntensity={0} />
      </mesh>
      {/* bamboo ladder */}
      <group position={[-0.55, 0, HUT.hz + 0.05]} rotation-x={0.62}>
        {[-0.3, 0.3].map((x) => (
          <mesh key={x} position={[x, 0.72, 0]}><cylinderGeometry args={[0.035, 0.04, 1.5, 6]} /><meshLambertMaterial color="#8a6a3a" /></mesh>
        ))}
        {[0.25, 0.6, 0.95, 1.3].map((y) => (
          <mesh key={y} position={[0, y, 0]} rotation-z={Math.PI / 2}><cylinderGeometry args={[0.028, 0.028, 0.66, 6]} /><meshLambertMaterial color="#9a7a46" /></mesh>
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
  const pit = useProp("/models/campfire.glb", 1.35, "x", 1, false)[0];
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
        ((c as Mesh).material as MeshLambertMaterial).opacity = 0.3 * (1 - k);
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
              <meshLambertMaterial color="#8a6a3a" />
            </mesh>
            {wards[o.id] === "garlic" && <primitive object={garlic[i]} position={[side * 0.55 || 0.75, 0.55, side ? 0.62 : 0.22]} />}
            {wards[o.id] === "salt" && (
              <mesh position={[0, 0.03, side ? 0 : -0.25]} rotation-y={side ? Math.PI / 2 : 0}>
                <boxGeometry args={[1.5, 0.03, 0.16]} />
                <meshLambertMaterial color="#f6f4ee" emissive="#dfe6ff" emissiveIntensity={0.7} />
              </mesh>
            )}
          </group>
        );
      })}
      <group position={[firePit.x, 0, firePit.z]}>
        <primitive object={pit} rotation-y={0.6} />
        <group ref={flame} position={[0, 0.3, 0]} visible={false}>
          {[0, Math.PI / 2].map((r) => (
            <mesh key={r} position={[0, 0.22, 0]} rotation-y={r}><coneGeometry args={[0.16, 0.5, 5, 1, true]} /><meshBasicMaterial color="#ff9a3c" transparent opacity={0.85} side={DoubleSide} /></mesh>
          ))}
        </group>
        <group ref={smoke} visible={false}>
          {Array.from({ length: 7 }, (_, i) => (
            <mesh key={i}><icosahedronGeometry args={[0.5, 1]} /><meshLambertMaterial color="#9a958c" transparent opacity={0.2} depthWrite={false} /></mesh>
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
  const stacks = useProp("/models/logs.glb", 1.05, "x", of("logs").length, shadows);
  const jars = useProp("/models/pot.glb", 0.66, "y", of("pot").length, shadows);
  const bare = useProp("/models/deadtree.glb", 4.8, "y", of("deadtree").length, shadows);
  const stumps = useProp("/models/stump.glb", 2.7, "x", of("stump").length, shadows);
  const fallen = useProp("/models/mossylog.glb", 2.6, "x", of("mossylog").length, shadows);
  const boulders = useProp("/models/boulder.glb", 1.9, "x", of("boulder").length, shadows);
  const fires = useProp("/models/campfire.glb", 1.3, "x", of("campfire").length, shadows);
  const seats = useProp("/models/bench.glb", 0.62, "y", of("bench").length, shadows);
  const baskets = useProp("/models/basket.glb", 0.56, "x", of("basket").length, shadows);
  const beds = useProp("/models/garden.glb", 1.9, "x", of("garden").length, shadows);
  const graves = useProp("/models/cross.glb", 1.55, "y", of("cross").length, shadows);
  // a bare tree between the camera and him thins out, like the palms
  const thin = useMemo(() => bare.map(seeThrough), [bare]);
  useFrame((_, dt) => {
    const k = Math.min(1, dt * 7);
    of("deadtree").forEach((d, i) => {
      const dx = d.x - live.player.x, dz = d.z - live.player.z;
      const hides = dz > 0.8 && dz < 6.5 && Math.abs(dx) < 2.4;
      for (const m of thin[i]) m.opacity += ((hides ? 0.2 : 1) - m.opacity) * k;
    });
  });
  // the gallery models are lit for a studio: taken down so they sit in this light and do not glare by day
  useMemo(() => {
    const tone = (o: Object3D, k: number) => o.traverse((m) => { const mat = (m as Mesh).material as MeshLambertMaterial | undefined; if (mat?.color) mat.color.setScalar(k); });
    if (piles[0]) tone(piles[0], 0.36);
    if (shrubs[0]) shrubs[0].traverse((m) => { const mat = (m as Mesh).material as MeshLambertMaterial | undefined; if (mat?.color) mat.color.setRGB(0.3, 0.36, 0.24); });      // it came lime green
    if (ferns[0]) tone(ferns[0], 0.8);
    bare.forEach((t) => tone(t, 0.66));          // each bare tree has its own materials (it can thin out), so each is toned
    if (seats[0]) tone(seats[0], 0.72);
    if (stumps[0]) tone(stumps[0], 0.82);
    if (beds[0]) tone(beds[0], 0.85);
    if (boulders[0]) tone(boulders[0], 0.8);
    if (graves[0]) tone(graves[0], 0.8);
  }, [piles, shrubs, ferns, bare, seats, stumps, beds, boulders, graves]);
  const sets: [string, Object3D[]][] = [
    ["shrub", shrubs], ["fern", ferns], ["rocks", piles], ["logs", stacks], ["pot", jars], ["deadtree", bare], ["stump", stumps], ["mossylog", fallen],
    ["boulder", boulders], ["campfire", fires], ["bench", seats], ["basket", baskets], ["garden", beds], ["cross", graves],
  ];
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
            <meshLambertMaterial color="#f6f4ee" emissive="#dfe6ff" emissiveIntensity={0.7} />
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
      <mesh position={[0, 0.8, 0]} rotation-z={0.08}><cylinderGeometry args={[0.05, 0.07, 1.6, 6]} /><meshLambertMaterial color="#6d5535" /></mesh>
      <mesh position={[0.2, 1.4, 0.05]} rotation-z={-0.5}><boxGeometry args={[0.42, 0.26, 0.02]} /><meshLambertMaterial color="#a32a22" emissive="#5a0f0a" emissiveIntensity={0.5} side={DoubleSide} /></mesh>
      {[0, 1, 2].map((i) => (
        <mesh key={i} geometry={stoneGeometry()} position={[0.3 + i * 0.16, 0.06, 0.3 - i * 0.1]} rotation-y={i * 2.2} scale={[0.15 - i * 0.02, 0.1, 0.12]}><meshLambertMaterial color="#a39c90" vertexColors /></mesh>
      ))}
    </group>
  );
}

useGLTF.preload("/models/hut.glb");
useGLTF.preload("/models/fence.glb");
useGLTF.preload("/models/palm.glb");
useGLTF.preload("/models/well.glb");
useGLTF.preload("/models/balete.glb");
