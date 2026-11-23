import { Suspense, useEffect, useRef } from "react";
import { advance, Canvas, useFrame, useThree } from "@react-three/fiber";
import { Vector3 } from "three";
import { World } from "./game/World";
import { Player } from "./game/Player";
import { Aswang } from "./game/Aswang";
import { Manananggal } from "./game/Manananggal";
import { Tikbalang } from "./game/Tikbalang";
import { Director, Kapre, Pacing } from "./game/Cast";
import { Hud } from "./game/Hud";
import { useKeyboard } from "./game/input";
import { live, useGame } from "./game/state";
import { home } from "./game/layout";

const CAMERA_OFFSET = new Vector3(0, 8.6, 7.2);

/** Looks down on the player from behind and above, and follows him smoothly. */
function FollowCamera() {
  const target = useRef(new Vector3().copy(live.player));
  const want = useRef(new Vector3());
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
    target.current.lerp(live.player, k);
    want.current.copy(target.current).add(CAMERA_OFFSET);
    const s = live.shake * 0.16;
    camera.position.set(want.current.x + (Math.random() - 0.5) * s, want.current.y + (Math.random() - 0.5) * s, want.current.z);
    camera.lookAt(target.current.x, target.current.y + 1, target.current.z);
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
          <Kapre />
          <Pacing />
          <Director />
        </Suspense>
        <FollowCamera />
        <DevHook />
      </Canvas>
      <Hud />
    </>
  );
}
