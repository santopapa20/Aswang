import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { useGLTF } from "@react-three/drei";
import { Box3, CanvasTexture, Color, DirectionalLight, FogExp2, HemisphereLight, Mesh, Object3D, RepeatWrapping, SRGBColorSpace, Vector3 } from "three";
import { live, NIGHT_SECONDS, obstacles, useGame } from "./state";

// ---- a fixed layout, so the map is the same every time ------------------------------------
function seeded(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Hut = { x: number; z: number; rot: number };
type Tree = { x: number; z: number; h: number; lean: number };
type FencePiece = { x: number; z: number; rot: number };

const HUT_HEIGHT = 4.4;       // metres, floor to roof ridge
const FENCE_LENGTH = 2.3;     // metres per fence section

const huts: Hut[] = [
  { x: -9, z: -6, rot: 0.5 },
  { x: 10, z: -10, rot: -0.6 },
  { x: 5, z: 14, rot: 2.6 },
];
const well = { x: -3, z: 2 };

/** Fence runs: start point, direction in radians, number of sections. */
const fenceRuns: [number, number, number, number][] = [
  [-15, -1.5, 0, 5],
  [-15, -1.5, -Math.PI / 2, 4],
  [5.5, -4.5, 0, 4],
  [16, -4.5, -Math.PI / 2, 4],
  [-1, 9.5, 0, 3],
  [10.5, 10, Math.PI / 2, 3],
];
const fence: FencePiece[] = [];
for (const [sx, sz, dir, n] of fenceRuns) {
  for (let i = 0; i < n; i++) {
    const d = (i + 0.5) * FENCE_LENGTH;
    fence.push({ x: sx + Math.cos(dir) * d, z: sz - Math.sin(dir) * d, rot: dir });
  }
}

const trees: Tree[] = [];
{
  const rnd = seeded(1950);
  while (trees.length < 34) {
    const x = (rnd() - 0.5) * 64, z = (rnd() - 0.5) * 64;
    const clear = Math.hypot(x, z - 6) > 5
      && huts.every((h) => Math.hypot(x - h.x, z - h.z) > 5.5)
      && fence.every((f) => Math.hypot(x - f.x, z - f.z) > 2)
      && Math.hypot(x - well.x, z - well.z) > 3;
    if (clear) trees.push({ x, z, h: 4.5 + rnd() * 3.5, lean: (rnd() - 0.5) * 0.25 });
  }
  obstacles.length = 0;
  for (const h of huts) obstacles.push({ x: h.x, z: h.z, r: 2.6 });
  for (const t of trees) obstacles.push({ x: t.x, z: t.z, r: 0.45 });
  for (const f of fence) {
    for (const k of [-0.75, 0, 0.75]) obstacles.push({ x: f.x + Math.cos(f.rot) * k, z: f.z - Math.sin(f.rot) * k, r: 0.45 });
  }
  obstacles.push({ x: well.x, z: well.z, r: 1.0 });
}

function useGroundTexture() {
  return useMemo(() => {
    const size = 256;
    const c = document.createElement("canvas");
    c.width = c.height = size;
    const g = c.getContext("2d")!;
    const rnd = seeded(7);
    g.fillStyle = "#3a2f24";
    g.fillRect(0, 0, size, size);
    for (let i = 0; i < 9000; i++) {
      const v = 30 + rnd() * 50;
      g.fillStyle = `rgba(${v + 18}, ${v + 6}, ${v - 6}, ${0.15 + rnd() * 0.3})`;
      const s = 1 + rnd() * 3;
      g.fillRect(rnd() * size, rnd() * size, s, s);
    }
    const tex = new CanvasTexture(c);
    tex.wrapS = tex.wrapT = RepeatWrapping;
    tex.repeat.set(28, 28);
    tex.colorSpace = SRGBColorSpace;
    return tex;
  }, []);
}

/**
 * Loads a prop and returns copies of it, resized so that `size` metres fits along `axis`,
 * centred on X and Z and standing on the ground.
 */
function useProp(url: string, size: number, axis: "x" | "y", count: number, shadows: boolean) {
  const gltf = useGLTF(url);
  return useMemo(() => {
    const box = new Box3().setFromObject(gltf.scene);
    const dim = box.getSize(new Vector3());
    const centre = box.getCenter(new Vector3());
    const scale = size / (axis === "x" ? dim.x : dim.y);
    return Array.from({ length: count }, () => {
      const copy = gltf.scene.clone(true);
      copy.traverse((o) => { if ((o as Mesh).isMesh) { o.castShadow = shadows; o.receiveShadow = shadows; } });
      copy.position.set(-centre.x * scale, -box.min.y * scale, -centre.z * scale);
      copy.scale.setScalar(scale);
      const holder = new Object3D();
      holder.add(copy);
      return holder;
    });
  }, [gltf.scene, size, axis, count, shadows]);
}

const NIGHT = { sky: new Color("#0a1024"), hemiSky: new Color("#3a4f96"), hemiGround: new Color("#14121c"), moon: new Color("#7f9bff") };
const DAWN = { sky: new Color("#3b3040"), hemiSky: new Color("#c9987a"), hemiGround: new Color("#3a2c2a"), moon: new Color("#ffc890") };

export function World() {
  const { scene } = useThree();
  const shadows = useGame((s) => s.shadows);
  const runId = useGame((s) => s.runId);
  const ground = useGroundTexture();
  const hutModels = useProp("/models/hut.glb", HUT_HEIGHT, "y", huts.length, shadows);
  const fenceModels = useProp("/models/fence.glb", FENCE_LENGTH, "x", fence.length, shadows);
  const hemi = useRef<HemisphereLight>(null);
  const moon = useRef<DirectionalLight>(null);
  const fog = useMemo(() => new FogExp2(NIGHT.sky.getHex(), 0.03), []);
  const sky = useMemo(() => NIGHT.sky.clone(), []);

  useEffect(() => { scene.fog = fog; scene.background = sky; return () => { scene.fog = null; }; }, [scene, fog, sky]);
  useEffect(() => { live.timeLeft = NIGHT_SECONDS; }, [runId]);

  const acc = useRef({ t: 0, n: 0 });
  useFrame((_, dt) => {
    // frames per second, averaged over half a second
    acc.current.t += dt; acc.current.n += 1;
    if (acc.current.t >= 0.5) { live.fps = acc.current.n / acc.current.t; acc.current.t = 0; acc.current.n = 0; }

    const game = useGame.getState();
    if (game.phase === "playing") {
      live.timeLeft = Math.max(0, live.timeLeft - Math.min(dt, 0.1));
      if (live.timeLeft === 0) game.setPhase("survived");
    }
    // the last 30 seconds of the night slowly turn to dawn
    const k = Math.min(1, Math.max(0, 1 - live.timeLeft / 30));
    sky.lerpColors(NIGHT.sky, DAWN.sky, k);
    fog.color.copy(sky);
    fog.density = 0.03 - 0.012 * k;
    if (hemi.current) {
      hemi.current.color.lerpColors(NIGHT.hemiSky, DAWN.hemiSky, k);
      hemi.current.groundColor.lerpColors(NIGHT.hemiGround, DAWN.hemiGround, k);
      hemi.current.intensity = 1.5 + 0.9 * k;
    }
    if (moon.current) { moon.current.color.lerpColors(NIGHT.moon, DAWN.moon, k); moon.current.intensity = 1.7 + 0.6 * k; }
  });

  return (
    <>
      <hemisphereLight ref={hemi} args={["#27356b", "#0b0a10", 1.5]} />
      <directionalLight ref={moon} position={[-14, 22, -8]} color="#7f9bff" intensity={1.7} />

      <mesh rotation-x={-Math.PI / 2} receiveShadow>
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial map={ground} roughness={1} metalness={0} />
      </mesh>

      {huts.map((h, i) => (
        <primitive key={`hut${i}`} object={hutModels[i]} position={[h.x, 0, h.z]} rotation-y={h.rot} />
      ))}
      {fence.map((f, i) => (
        <primitive key={`fence${i}`} object={fenceModels[i]} position={[f.x, 0, f.z]} rotation-y={f.rot} />
      ))}

      {/* Still placeholders: plain shapes standing in for palms and the well. */}
      {trees.map((t, i) => (
        <group key={i} position={[t.x, 0, t.z]} rotation-z={t.lean}>
          <mesh position={[0, t.h / 2, 0]} castShadow={shadows}>
            <cylinderGeometry args={[0.16, 0.26, t.h, 7]} />
            <meshStandardMaterial color="#3a3026" roughness={1} />
          </mesh>
          <mesh position={[0, t.h + 0.5, 0]} castShadow={shadows}>
            <coneGeometry args={[2.3, 1.6, 7]} />
            <meshStandardMaterial color="#1c2b1c" roughness={1} />
          </mesh>
        </group>
      ))}
      <mesh position={[well.x, 0.45, well.z]} castShadow={shadows} receiveShadow>
        <cylinderGeometry args={[0.85, 0.9, 0.9, 12]} />
        <meshStandardMaterial color="#56534e" roughness={0.95} />
      </mesh>
    </>
  );
}

useGLTF.preload("/models/hut.glb");
useGLTF.preload("/models/fence.glb");
