import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import { World } from "./game/World";
import { Player } from "./game/Player";
import { Aswang } from "./game/Aswang";
import { Hud } from "./game/Hud";
import { useKeyboard } from "./game/input";
import { live, useGame } from "./game/state";

const CAMERA_OFFSET = new Vector3(0, 8, 6.8);

/** Looks down on the player from behind and above, and follows him smoothly. */
function FollowCamera() {
  const target = useRef(new Vector3().copy(live.player));
  const want = useRef(new Vector3());
  useFrame(({ camera }, dt) => {
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 4);
    target.current.lerp(live.player, k);
    want.current.copy(target.current).add(CAMERA_OFFSET);
    camera.position.copy(want.current);
    camera.lookAt(target.current.x, target.current.y + 1, target.current.z);
  });
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
        camera={{ fov: 38, near: 0.5, far: 90, position: [0, 10.5, 14.5] }}
        gl={{ antialias: true, powerPreference: "high-performance", toneMappingExposure: 1.25 }}
      >
        <Suspense fallback={null}>
          <World />
          <Player />
          <Aswang />
        </Suspense>
        <FollowCamera />
      </Canvas>
      <Hud />
    </>
  );
}
