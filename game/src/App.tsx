import { Suspense, useEffect, useRef } from "react";
import { advance, Canvas, useFrame, useThree } from "@react-three/fiber";
import { Frustum, Matrix4, Vector3 } from "three";
import { World } from "./game/World";
import { Player } from "./game/Player";
import { Aswang } from "./game/Aswang";
import { Manananggal } from "./game/Manananggal";
import { Tikbalang } from "./game/Tikbalang";
import { Sigbin } from "./game/Sigbin";
import { Director, Kapre, Pacing } from "./game/Cast";
import { Kadyo } from "./game/Kadyo";
import { Hilot } from "./game/Hilot";
import { Amalanhig } from "./game/Amalanhig";
import { Kin } from "./game/Kin";
import { Guise } from "./game/Guise";
import { TouchControls } from "./game/TouchControls";
import { Hud } from "./game/Hud";
import { Guide } from "./game/Guide";
import { useKeyboard } from "./game/input";
import { live, useGame } from "./game/state";
import { home } from "./game/layout";

const CAMERA_OFFSET = new Vector3(0, 8.6, 7.2);

/** Looks down on the player from behind and above, and follows him smoothly. */
function FollowCamera() {
  const target = useRef(new Vector3().copy(live.player));
  const want = useRef(new Vector3());
  const pull = useRef(1);
  const aim = useRef(new Vector3());
  const shakeT = useRef(0);
  useFrame(({ camera, clock }, dt) => {
    const game = useGame.getState();
    if (game.stage === "title") {
      // behind the title: a slow drift over the house he will guard
      const t = clock.elapsedTime * 0.05;
      target.current.set(home.x + Math.sin(t) * 5, 0, home.z + 4 + Math.cos(t * 0.7) * 3);
      camera.position.copy(target.current).addScaledVector(CAMERA_OFFSET, 1.5);
      camera.lookAt(target.current.x, 1, target.current.z);
      return;
    }
    // when the trail brings him back, the camera is moved with him so nothing is seen to change
    if (live.jump) { target.current.x += live.jump; live.jump = 0; }
    if (target.current.distanceTo(live.player) > 30) target.current.copy(live.player);
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 4);
    // while she is on the roof and he is nearby, the camera frames the house and him together
    const roof = game.stage === "night" && game.onRoof && Math.hypot(live.player.x - home.x, live.player.z - home.z) < 16;
    if (roof) aim.current.set((live.player.x + home.x) / 2, 0, (live.player.z + home.z) / 2 - 0.4); else aim.current.copy(live.player);
    target.current.lerp(aim.current, roof ? k * 0.5 : k);
    // when she is on the roof or coming down from the air, the camera draws back so she can be seen
    const far = game.stage === "night" && (game.onRoof || game.overhead) ? 1.4 : 1;
    pull.current += (far - pull.current) * (1 - Math.exp(-Math.min(dt, 0.1) * 1.8));
    want.current.copy(target.current).addScaledVector(CAMERA_OFFSET, pull.current);
    // the hit-stop clock and the shake both run in real time, so neither sticks while the game is slowed
    const real = Math.min(dt, 0.1);
    live.freeze = Math.max(0, live.freeze - real);
    live.timeScale = live.freeze > 0 ? 0.06 : 1;
    live.shake = Math.max(0, live.shake - real * 1.4);
    // trauma squared: light knocks barely move it, heavy ones punch; summed sines, not a per-frame buzz
    const s = live.shake * live.shake * game.settings.shake * 0.42;
    shakeT.current += real * 30;
    camera.position.set(want.current.x + s * Math.sin(shakeT.current * 1.7), want.current.y + s * 0.6 * Math.sin(shakeT.current * 2.3), want.current.z + s * 0.4 * Math.sin(shakeT.current * 1.1));
    camera.lookAt(target.current.x, target.current.y + 1, target.current.z);
  });
  return null;
}

/** Prepares everything in the scene for drawing while the title is still up, so nothing stutters the first time it comes into view. */
function Warmup() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    // Everything that will ever be drawn is prepared up front: textures uploaded and shaders compiled.
    // The renderer only prepares what is visible, and every creature is hidden until its night, so each
    // one used to stall the game the first time it appeared. Hidden things are shown for the moment of
    // the call (the compiling itself carries on in the background where the browser allows), and it is
    // run again a little later for whatever finished loading after the first pass.
    const prepare = () => {
      const hidden: { visible: boolean }[] = [];
      scene.traverse((o) => {
        if (!o.visible) { hidden.push(o); o.visible = true; }
        const m = (o as unknown as { material?: Record<string, unknown> }).material;
        if (!m) return;
        for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap", "alphaMap"]) { const t = m[k] as { isTexture?: boolean } | undefined; if (t?.isTexture) gl.initTexture(t as never); }
      });
      const t0 = performance.now();
      const done = gl.compileAsync(scene, camera);
      for (const o of hidden) o.visible = false;
      void done.then(() => console.debug(`materials prepared in ${Math.round(performance.now() - t0)} ms`)).catch(() => {});
    };
    const ids = [300, 3000, 9000].map((ms) => setTimeout(prepare, ms));
    return () => ids.forEach(clearTimeout);
  }, [gl, scene, camera]);
  return null;
}

/**
 * The game is limited by pixels on a laptop's graphics (the ground, the grass and the huts fill the screen;
 * half the resolution ran 51 -> 77 fps where full ran slowest), so it draws at the screen's own pixels and,
 * while the frame rate is short, at fewer. Every change resizes the canvas, which costs a slow frame of its own,
 * so it changes only on a clear reading: down a tenth (to 0.7) after two 2-second readings in a row under
 * 50 fps, up a tenth after five in a row (10 s) at 58 or more, and never in the 4 s after a change. Settings:
 * Resolution auto / full. (It used to step every 2 s on one reading, and flipped back and forth: a hitch
 * every 2 s; found with scripts/hitch.mjs.)
 */
function AdaptiveResolution() {
  const setDpr = useThree((s) => s.setDpr);
  const auto = useGame((s) => s.settings.resolution === "auto");
  const acc = useRef({ start: 0, frames: 0, dpr: 1, slow: 0, quick: 0, settle: 0 });
  useEffect(() => { acc.current = { start: 0, frames: 0, dpr: 1, slow: 0, quick: 0, settle: 0 }; setDpr(1); }, [auto, setDpr]);
  useFrame(() => {
    if (!auto) return;
    const a = acc.current, now = performance.now();
    if (!a.start) { a.start = now; a.frames = 0; return; }
    a.frames++;
    if (now - a.start < 2000) return;
    const fps = (a.frames * 1000) / (now - a.start);
    a.start = now; a.frames = 0;
    if (now < a.settle) return;
    a.slow = fps < 50 ? a.slow + 1 : 0;
    a.quick = fps >= 58 ? a.quick + 1 : 0;
    let next = a.dpr;
    if (a.slow >= 2) next = Math.max(0.7, a.dpr - 0.1);
    else if (a.quick >= 5) next = Math.min(1, a.dpr + 0.1);
    if (Math.abs(next - a.dpr) > 0.001) { a.dpr = Math.round(next * 100) / 100; setDpr(a.dpr); live.dpr = a.dpr; a.slow = 0; a.quick = 0; a.settle = now + 4000; }
  });
  return null;
}

/** While developing: lets a test step the game frame by frame (window.__aswang.three / .advance). */
function DevHook() {
  const get = useThree((s) => s.get);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    // run(seconds) plays the game forward at once, even in a hidden tab; key(code, down) presses a key
    const run = (seconds: number, fps = 10) => {
      const st = get();
      if (st.frameloop !== "never") st.setFrameloop("never");
      let t = st.clock.elapsedTime;
      for (let i = 0; i < seconds * fps; i++) { t += 1 / fps; advance(t); }
    };
    const key = (code: string, down = true) => window.dispatchEvent(new KeyboardEvent(down ? "keydown" : "keyup", { code }));
    const show = () => get().setFrameloop("always");
    Object.assign((window as unknown as { __aswang: object }).__aswang, { three: get, advance, run, key, show, THREE: { Frustum, Matrix4 } });
  }, [get]);
  return null;
}

export default function App() {
  useKeyboard();
  const shadows = useGame((s) => s.shadows);
  return (
    <>
      <Canvas
        shadows={shadows}
        dpr={1}
        camera={{ fov: 38, near: 0.5, far: 110, position: [0, 10.5, 14.5] }}
        gl={{ antialias: true, powerPreference: "high-performance", toneMappingExposure: 1.25 }}
      >
        <Suspense fallback={null}>
          <World />
          <Player />
          <Aswang />
          <Manananggal />
          <Tikbalang />
          <Sigbin />
          <Kapre />
          <Pacing />
          <Kadyo />
          <Hilot />
          <Amalanhig index={0} />
          <Amalanhig index={1} />
          <Kin kind="dog" index={0} />
          <Kin kind="dog" index={1} />
          <Kin kind="crawler" index={0} />
          <Guise look="farmer" />
          <Guise look="priest" />
          <Guise look="nurse" />
          <Guide />
          <Director />
          <Warmup />
        </Suspense>
        <FollowCamera />
        <AdaptiveResolution />
        <DevHook />
      </Canvas>
      <Hud />
      <TouchControls />
    </>
  );
}
