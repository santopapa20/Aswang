import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Group, MeshBasicMaterial, ShaderMaterial, SpriteMaterial } from "three";
import { live } from "./state";
import { balete, BARRIO, houses, HUT, palms, seeded, SITIO, trail } from "./layout";

/**
 * What the night is made of besides darkness: fireflies in the trees, mist lying in the low ground,
 * and the glow that a lit window throws onto the yard. None of it is solid and none of it changes how
 * the game plays; all of it fades out by day.
 */
function softDisc() {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d")!;
  const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  grad.addColorStop(0, "rgba(255,255,255,1)"); grad.addColorStop(0.35, "rgba(255,255,255,0.42)"); grad.addColorStop(0.7, "rgba(255,255,255,0.1)"); grad.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
  return new CanvasTexture(c);
}
let disc: CanvasTexture | null = null;
const glowTexture = () => (disc ??= softDisc());

// ---- fireflies -------------------------------------------------------------------------------
function fireflySpots() {
  const rnd = seeded(404);
  const at: number[] = [], phase: number[] = [];
  const add = (x: number, y: number, z: number, p = rnd()) => { at.push(x, y, z); phase.push(p); };
  for (let i = 0; i < 46; i++) {                              // thick about the balete
    const a = rnd() * 6.283, d = 2.5 + rnd() * 7.5;
    add(balete.x + Math.cos(a) * d, 0.4 + rnd() * 3.4, balete.z + Math.sin(a) * d);
  }
  palms.forEach((t, i) => { if (i % 3 === 0 && Math.abs(t.z) > 8 && (t.x < 34 || t.x > 92)) add(t.x + (rnd() - 0.5) * 3, 0.5 + rnd() * 2.4, t.z + (rnd() - 0.5) * 3); });
  for (const area of [BARRIO, SITIO]) for (let i = 0; i < 26; i++) add(area.x0 + rnd() * (area.x1 - area.x0), 0.4 + rnd() * 1.6, area.z0 + rnd() * (area.z1 - area.z0));
  // the trail's repeat every 15 m like its trees, each with the same timing, so its loop stays hidden
  const pattern = Array.from({ length: 7 }, () => [rnd() * trail.period, 0.5 + rnd() * 2, (rnd() < 0.5 ? -1 : 1) * (3.6 + rnd() * 4), rnd()]);
  for (let p = 0; p < 4; p++) for (const [dx, y, z, ph] of pattern) add(37 + p * trail.period + dx, y, z, ph);
  return { at: new Float32Array(at), phase: new Float32Array(phase) };
}

function Fireflies() {
  const { geometry, material } = useMemo(() => {
    const spots = fireflySpots();
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new BufferAttribute(spots.at, 3));
    geometry.setAttribute("aPhase", new BufferAttribute(spots.phase, 1));
    const material = new ShaderMaterial({
      uniforms: { uTime: { value: 0 }, uNight: { value: 0 }, uTall: { value: 720 } },
      transparent: true, depthWrite: false, blending: AdditiveBlending,
      vertexShader: `
        attribute float aPhase; uniform float uTime; uniform float uNight; uniform float uTall; varying float vGlow;
        void main() {
          vec3 p = position;
          p.x += sin(uTime * 0.37 + aPhase * 6.0) * 0.9 + sin(uTime * 0.83 + aPhase * 17.0) * 0.3;
          p.y += sin(uTime * 0.61 + aPhase * 11.0) * 0.4;
          p.z += cos(uTime * 0.31 + aPhase * 8.0) * 0.9 + cos(uTime * 0.77 + aPhase * 23.0) * 0.3;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_Position = projectionMatrix * mv;
          float blink = smoothstep(0.35, 1.0, sin(uTime * 1.6 + aPhase * 40.0) * 0.5 + 0.5);
          vGlow = blink * uNight * smoothstep(34.0, 20.0, -mv.z);
          gl_PointSize = (0.2 + 0.12 * blink) * uTall / -mv.z;
        }`,
      fragmentShader: `
        varying float vGlow;
        void main() {
          float d = length(gl_PointCoord - 0.5) * 2.0;
          float a = pow(max(0.0, 1.0 - d), 2.2);
          gl_FragColor = vec4(vec3(0.72, 1.0, 0.34) * (0.6 + a), a * vGlow);
        }`,
    });
    return { geometry, material };
  }, []);
  useFrame(({ clock, size }) => {
    material.uniforms.uTime.value = clock.elapsedTime;
    material.uniforms.uNight.value = Math.max(0, 1 - live.daylight * 2.2);
    material.uniforms.uTall.value = size.height;
  });
  return <points geometry={geometry} material={material} frustumCulled={false} />;
}

// ---- mist ------------------------------------------------------------------------------------
const mistSpots: [number, number, number][] = [
  [-27, -20, 15], [-33, 6, 12], [-20, 28, 13], [10, 29, 12], [29, 22, 12], [12, -28, 13], [-12, -27, 12], [30, -18, 11], [-2, 4, 9],
  [97, -16, 12], [112, 18, 13], [126, -14, 12], [125, 8, 11], [108, -2, 9],
];
function Mist() {
  const group = useRef<Group>(null);
  const material = useMemo(() => new MeshBasicMaterial({ map: glowTexture(), color: "#93a4cf", transparent: true, depthWrite: false, opacity: 0 }), []);
  useFrame(({ clock }) => {
    const t = clock.elapsedTime;
    material.opacity = 0.2 * Math.max(0, 1 - live.daylight * 1.6);
    group.current?.children.forEach((c, i) => {
      const [x, z] = mistSpots[i];
      c.position.set(x + Math.sin(t * 0.05 + i * 1.7) * 2.2, 0.5 + (i % 3) * 0.12, z + Math.cos(t * 0.04 + i * 2.3) * 1.8);
      c.visible = material.opacity > 0.01;
    });
  });
  return (
    <group ref={group}>
      {mistSpots.map(([x, z, s], i) => (
        <mesh key={i} position={[x, 0.5, z]} rotation-x={-Math.PI / 2} rotation-z={i * 0.9} scale={[s, s * 0.7, 1]} material={material} renderOrder={3}>
          <planeGeometry args={[1, 1]} />
        </mesh>
      ))}
    </group>
  );
}

// ---- light from lit windows ------------------------------------------------------------------
function WindowLight() {
  const lit = houses.filter((h) => h.lit);
  const pool = useMemo(() => new MeshBasicMaterial({ map: glowTexture(), color: "#ff9a48", transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 }), []);
  const halo = useMemo(() => new SpriteMaterial({ map: glowTexture(), color: "#ffb469", transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 }), []);
  useFrame(({ clock }) => {
    const dark = Math.max(0, 1 - live.daylight * 1.5), t = clock.elapsedTime;
    const flicker = 0.9 + 0.07 * Math.sin(t * 6.1) + 0.03 * Math.sin(t * 17.3);
    pool.opacity = 0.34 * dark * flicker;
    halo.opacity = 0.55 * dark * flicker;
  });
  return (
    <>
      {lit.map((h) => (
        <group key={h.id} position={[h.x, 0, h.z]}>
          {/* spilled on the ground before the window, and a soft halo about the window itself */}
          <mesh position={[0.7, 0.04, HUT.hz + 2.3]} rotation-x={-Math.PI / 2} scale={[6.4, 5.4, 1]} material={pool} renderOrder={3}><planeGeometry args={[1, 1]} /></mesh>
          <sprite position={[0.95, 2.2, HUT.hz + 0.25]} scale={[2.3, 2.3, 1]} material={halo} />
        </group>
      ))}
    </>
  );
}

export function Atmosphere() {
  return (
    <>
      <Fireflies />
      <Mist />
      <WindowLight />
    </>
  );
}
