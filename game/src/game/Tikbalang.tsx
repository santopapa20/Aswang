import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Vector3 } from "three";
import { live, useGame, step } from "./state";
import { trail } from "./layout";
import { useCharacter } from "./useCharacter";
import { sound } from "./audio";

type Mode = "watch" | "thwarted" | "leave" | "gone";
const LOOP = trail.loopB - trail.loopA;       // 30 m: exactly two repeats of the trail's scenery
const STAND = new Vector3(trail.marker.x - 2, 0, -5.1);   // among the trees, across from the rag on the post

/**
 * The tikbalang owns the trail. It does not hunt and it does not kill: from the third night on, anyone
 * walking the trail after dark is brought back to where they were, again and again, while the lamp
 * burns down and the house stands unguarded. The trail's trees repeat exactly, so being moved back
 * cannot be seen; the only sign is passing the same rag on the same post twice. Turning his shirt
 * inside out (hold T, standing still) breaks it for the night.
 */
export function Tikbalang() {
  const shadows = useGame((s) => s.shadows);
  const runId = useGame((s) => s.runId);
  const { group, model, api } = useCharacter("/models/tikbalang.glb", shadows);
  const blob = useRef<Group>(null);
  const pos = useRef(STAND.clone());
  const facing = useRef(0);
  const mode = useRef<Mode>("watch");
  const timer = useRef(0);

  useEffect(() => {
    pos.current.copy(STAND);
    mode.current = "watch";
    api.reset();
    api.play("idle", { fade: 0 });
  }, [runId, api]);

  useFrame((_, rawDt) => {
    const dt = step(rawDt);
    const g = group.current;
    if (!g) return;
    const game = useGame.getState();
    if (game.panel || game.dialogue) return;      // the bag, the trade, a pause or someone speaking: the world waits
    const here = game.stage === "night" && game.night >= 3;
    if (!here) { g.visible = false; if (blob.current) blob.current.visible = false; return; }
    const p = pos.current;
    const px = live.player.x, onTrail = px > trail.loopA - 12 && px < trail.loopB + 12;
    timer.current -= dt;

    if (!game.shirt) {
      // the spell takes hold once he is well onto the trail, and then both ends lead back
      if (!game.lost && px > trail.loopA + 4 && px < trail.loopB - 4) game.set({ lost: true });
      if (game.lost) {
        const moved = px > trail.loopB ? -LOOP : px < trail.loopA ? LOOP : 0;
        if (moved) {
          live.player.x += moved; live.jump += moved; live.loops += 1;
          if (live.loops === 2) game.toast("That rag on that post. You have passed it before.");
          if (live.loops >= 3) game.hint("shirt", "You are being led. Stop walking. Hold T to turn your shirt inside out.");
        }
      }
    } else if (mode.current === "watch") {
      mode.current = "thwarted"; timer.current = api.duration("roar") * 0.6; sound.roar();
      game.toast("Something roars among the trees, and the trail is only a trail again.", "good");
    }

    switch (mode.current) {
      case "watch": {
        // it stands just outside the light, and turns to keep facing him
        api.play("idle", { fade: 0.5 });
        let diff = Math.atan2(live.player.x - p.x, live.player.z - p.z) - facing.current;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        facing.current += diff * Math.min(1, dt * 1.5);
        break;
      }
      case "thwarted":
        api.play("roar", { once: true, fade: 0.2 });
        if (timer.current <= 0) mode.current = "leave";
        break;
      case "leave":
        api.move("walk", 1.6, { fade: 0.4 });
        p.z -= dt * 1.6; facing.current += (Math.PI - facing.current) * Math.min(1, dt * 3);
        if (p.z < -14) mode.current = "gone";
        break;
      case "gone":
        break;
    }

    const visible = onTrail && mode.current !== "gone";
    g.visible = visible;
    g.position.copy(p);
    g.rotation.y = facing.current;
    if (blob.current) { blob.current.visible = visible; blob.current.position.set(p.x, 0.02, p.z); }
  });

  return (
    <>
      <group ref={group} visible={false}>
        <primitive object={model} />
      </group>
      <group ref={blob} visible={false}>
        <mesh rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.75, 22]} />
          <meshBasicMaterial color="#000" transparent opacity={0.35} depthWrite={false} />
        </mesh>
      </group>
    </>
  );
}
