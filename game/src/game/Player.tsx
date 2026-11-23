import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, PointLight, Vector3 } from "three";
import { live, LOWER_HALF, pushOut, useGame } from "./state";
import { actions, moveAxis, held, toggles } from "./input";
import { useCharacter } from "./useCharacter";
import { useProp } from "./useProp";

const SPEED = { sneak: 0.85, walk: 1.5, run: 3.4 };
// how far away each way of moving can be noticed by the aswang, in metres
const NOISE = { still: 5, sneak: 4, walk: 9, run: 15 };
const START = new Vector3(0, 0, 6);
const hand = new Vector3();

export function Player() {
  const shadows = useGame((s) => s.shadows);
  const runId = useGame((s) => s.runId);
  const { group, model, api } = useCharacter("/models/player.glb", shadows);
  const lantern = useProp("/models/lantern.glb", 0.34, "y", 1, false)[0];
  const lamp = useRef<Group>(null);
  const light = useRef<PointLight>(null);
  const fill = useRef<PointLight>(null);
  const blob = useRef<Group>(null);
  const facing = useRef(Math.PI);
  const stillFor = useRef(0);
  const caughtPlayed = useRef(false);

  useEffect(() => {
    live.player.copy(START);
    facing.current = Math.PI;
    caughtPlayed.current = false;
    stillFor.current = 0;
    api.reset();
    api.play("idle", { fade: 0 });
  }, [runId, api]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const g = group.current;
    if (!g) return;
    const game = useGame.getState();

    if (game.phase === "caught") {
      if (!caughtPlayed.current) { api.play("caught", { once: true, fade: 0.15 }); caughtPlayed.current = true; }
      live.playerNoise = 0;
    } else {
      const axis = moveAxis();
      const moving = axis.x !== 0 || axis.z !== 0;
      const running = moving && !toggles.sneak && (held.has("ShiftLeft") || held.has("ShiftRight"));
      const mode: keyof typeof NOISE = !moving ? "still" : toggles.sneak ? "sneak" : running ? "run" : "walk";
      if (mode !== "still") {
        const speed = SPEED[mode];
        live.player.x += axis.x * speed * dt;
        live.player.z += axis.z * speed * dt;
        pushOut(live.player, 0.35);
        // turn towards where he is heading, taking the short way round
        const want = Math.atan2(axis.x, axis.z);
        let diff = want - facing.current;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        facing.current += diff * Math.min(1, dt * 12);
        stillFor.current = 0;
        api.play(mode, { fade: 0.2 });
      } else {
        stillFor.current += dt;
        // after standing a while, or when hunted, he looks around nervously
        api.play(stillFor.current > 5 || game.hunted ? "look" : "idle", { fade: 0.4 });
      }
      live.playerNoise = NOISE[mode];

      // walk over a bowl of salt or a garlic braid to take it
      for (const item of game.pickups) {
        if (Math.hypot(item.x - live.player.x, item.z - live.player.z) < 0.9) game.collect(item.id);
      }
      // E pours a line of salt across the ground just ahead of him
      const nearHalf = Math.hypot(LOWER_HALF.x - live.player.x, LOWER_HALF.z - live.player.z) < 1.6;
      if (actions.pour && nearHalf && game.mana !== "ended") {
        game.saltLowerHalf();
      } else if (actions.pour) {
        const fx = Math.sin(facing.current), fz = Math.cos(facing.current);
        const cx = live.player.x + fx * 0.9, cz = live.player.z + fz * 0.9;
        const half = 1.4;
        game.pourSalt({ ax: cx - fz * half, az: cz + fx * half, bx: cx + fz * half, bz: cz - fx * half });
      }
    }
    actions.pour = false;

    g.position.copy(live.player);
    g.rotation.y = facing.current;
    blob.current?.position.set(live.player.x, 0.02, live.player.z);

    // the lantern hangs from his right hand and stays upright
    const bone = api.bone("RightHand");
    if (bone && lamp.current) {
      bone.getWorldPosition(hand);
      lamp.current.position.set(hand.x, hand.y - 0.12, hand.z);
    }
    if (light.current) {
      const t = state.clock.elapsedTime;
      const flicker = 0.9 + 0.06 * Math.sin(t * 11.3) + 0.04 * Math.sin(t * 23.7 + 1.3);
      light.current.intensity = (game.phase === "caught" ? 14 : 34) * flicker;
      if (fill.current) fill.current.intensity = light.current.intensity * 0.3;
    }
  });

  return (
    <>
      <group ref={group}>
        <primitive object={model} />
      </group>
      {/* soft dark patch under his feet, standing in for a shadow when shadows are off */}
      <group ref={blob}>
        <mesh rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.42, 20]} />
          <meshBasicMaterial color="#000" transparent opacity={0.35} depthWrite={false} />
        </mesh>
      </group>
      <group ref={lamp}>
        <primitive object={lantern} position={[0, -0.2, 0]} />
        {/* the flame: a small bright core so the lantern reads as lit from any distance */}
        <mesh position={[0, -0.06, 0]}>
          <sphereGeometry args={[0.035, 10, 8]} />
          <meshBasicMaterial color="#ffc26b" />
        </mesh>
        <pointLight
          ref={light}
          color="#ffae5c"
          intensity={34}
          distance={17}
          decay={1.6}
          castShadow={shadows}
          shadow-mapSize={[512, 512]}
          shadow-bias={-0.01}
          shadow-camera-near={0.15}
          shadow-camera-far={17}
        />
        {/* a weaker glow from higher up, so the lamp also lights him and not only the ground */}
        <pointLight ref={fill} position={[0, 1.4, 0.3]} color="#ffb877" intensity={10} distance={9} decay={1.8} />
      </group>
    </>
  );
}
