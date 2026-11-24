import { Suspense, useEffect, useRef } from "react";
import { advance, Canvas, useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { World } from "./game/World";
import { Player } from "./game/Player";
import { Aswang } from "./game/Aswang";
import { Manananggal } from "./game/Manananggal";
import { Tikbalang } from "./game/Tikbalang";
import { Sigbin } from "./game/Sigbin";
import { Director, Kapre, Pacing } from "./game/Cast";
import { Kadyo } from "./game/Kadyo";
import { Hilot } from "./game/Hilot";
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
    const s = live.shake * 0.16;
    camera.position.set(want.current.x + (Math.random() - 0.5) * s, want.current.y + (Math.random() - 0.5) * s, want.current.z);
    camera.lookAt(target.current.x, target.current.y + 1, target.current.z);
  });
  return null;
}

/** Prepares everything in the scene for drawing while the title is still up, so nothing stutters the first time it comes into view. */
function Warmup() {
  const { gl, scene, camera } = useThree();
  useEffect(() => {
    const id = setTimeout(() => {
      scene.traverse((o) => {
        const m = (o as unknown as { material?: Record<string, unknown> }).material;
        if (!m) return;
        for (const k of ["map", "normalMap", "roughnessMap", "metalnessMap", "emissiveMap", "aoMap", "alphaMap"]) { const t = m[k] as { isTexture?: boolean } | undefined; if (t?.isTexture) gl.initTexture(t as never); }
      });
      const t0 = performance.now();
      gl.compile(scene, camera);
      console.debug(`materials prepared in ${Math.round(performance.now() - t0)} ms`);
    }, 300);
    return () => clearTimeout(id);
  }, [gl, scene, camera]);
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
    Object.assign((window as unknown as { __aswang: object }).__aswang, { three: get, advance, run, key, show });
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
        dpr={[1, 1.25]}
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
          <Guide />
          <Director />
          <Warmup />
        </Suspense>
        <FollowCamera />
        <DevHook />
      </Canvas>
      <Hud />
    </>
  );
}
