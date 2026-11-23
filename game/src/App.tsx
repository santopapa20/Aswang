import { Suspense, useRef } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Vector3 } from "three";
import { World } from "./game/World";
import { Player } from "./game/Player";
import { Aswang } from "./game/Aswang";
import { Manananggal } from "./game/Manananggal";
import { Tikbalang } from "./game/Tikbalang";
import { Hud } from "./game/Hud";
import { Items } from "./game/Items";
import { useKeyboard } from "./game/input";
import { live, useGame } from "./game/state";

const CAMERA_OFFSET = new Vector3(0, 8, 6.8);

/** Looks down on the player from behind and above, and follows him smoothly. */
function FollowCamera() {
  const target = useRef(new Vector3().copy(live.player));
  const want = useRef(new Vector3());
  const pull = useRef(1);
  useFrame(({ camera }, dt) => {
    const k = 1 - Math.exp(-Math.min(dt, 0.1) * 4);
    target.current.lerp(live.player, k);
    // while the tikbalang has him, the camera draws back so the thing coming for him can be seen
    const game = useGame.getState();
    const far = game.lost && game.phase === "playing" ? 1.4 : 1;
    pull.current += (far - pull.current) * (1 - Math.exp(-Math.min(dt, 0.1) * 1.5));
    want.current.copy(target.current).addScaledVector(CAMERA_OFFSET, pull.current);
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
          <Manananggal />
          <Tikbalang />
          <Items />
        </Suspense>
        <FollowCamera />
      </Canvas>
      <Hud />
    </>
  );
}
