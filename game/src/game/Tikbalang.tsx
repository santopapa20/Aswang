import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Vector3 } from "three";
import { live, NIGHT_SECONDS, pushOut, useGame } from "./state";
import { useCharacter } from "./useCharacter";

type Mode = "absent" | "stalk" | "roar" | "charge" | "attack" | "thwarted" | "leave" | "gone" | "done";

const LAIR = new Vector3(25, 0, 7);   // it comes in from the east edge of the barrio
const ARRIVES_AFTER = 60;     // seconds into the night before it shows itself
const STALK_SPEED = 1.15;     // slower than the player's walk: you can keep ahead if your feet obey
const CHARGE_SPEED = 2.9;     // faster than a walk, slower than a run
const SPELL = 11;             // metres at which it leads you astray
const LOSES = 20;             // metres at which it loses you and the spell lifts
const REACH = 1.7;            // metres at which it strikes (long arms)

/**
 * The tikbalang: a tall horse-headed spirit that leads travellers astray. It walks after the player
 * all night. Once it is close his feet stop obeying him (the controls are reversed) and it charges.
 * Salt and garlic mean nothing to it. The counter is the old one: turn your shirt inside out
 * (hold T, standing still). The spell breaks and it leaves for the night.
 */
export function Tikbalang() {
  const shadows = useGame((s) => s.shadows);
  const runId = useGame((s) => s.runId);
  const { group, model, api } = useCharacter("/models/tikbalang.glb", shadows);
  const blob = useRef<Group>(null);
  const pos = useRef(LAIR.clone());
  const facing = useRef(-Math.PI / 2);
  const mode = useRef<Mode>("absent");
  const timer = useRef(0);

  useEffect(() => {
    pos.current.copy(LAIR);
    facing.current = -Math.PI / 2;
    mode.current = "absent";
    timer.current = 0;
    api.reset();
    api.play("idle", { fade: 0 });
  }, [runId, api]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const g = group.current;
    if (!g) return;
    const game = useGame.getState();
    const p = pos.current;
    const dx = live.player.x - p.x, dz = live.player.z - p.z;
    const dist = Math.hypot(dx, dz);
    timer.current -= dt;

    const turnTo = (x: number, z: number, rate: number) => {
      let diff = Math.atan2(x, z) - facing.current;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      facing.current += diff * Math.min(1, dt * rate);
    };
    /** Walks towards a point; true once it is there. */
    const stepTo = (tx: number, tz: number, speed: number) => {
      const ex = tx - p.x, ez = tz - p.z;
      const d = Math.hypot(ex, ez);
      if (d < 0.3) return true;
      p.x += (ex / d) * speed * dt; p.z += (ez / d) * speed * dt;
      pushOut(p, 0.6);
      turnTo(ex, ez, 5);
      return false;
    };

    const active = mode.current !== "absent" && mode.current !== "gone";
    // his shirt is inside out: the trick has failed, and it knows
    if (game.shirt && active && mode.current !== "thwarted" && mode.current !== "leave") {
      mode.current = "thwarted"; timer.current = api.duration("roar") * 0.6;
    }
    // the night is over (caught by something else, or sunrise): stand down
    if (game.phase !== "playing" && active && mode.current !== "done" && mode.current !== "attack") {
      mode.current = "done";
    }

    switch (mode.current) {
      case "absent":
        if (game.phase === "playing" && live.timeLeft < NIGHT_SECONDS - ARRIVES_AFTER && game.tik === "absent") {
          game.setTik("stalking");
          mode.current = "stalk";
        }
        break;
      case "stalk":
        api.play("walk", { fade: 0.4, speed: 0.8 });
        stepTo(live.player.x, live.player.z, STALK_SPEED);
        if (dist < SPELL) { game.setLost(true); mode.current = "roar"; timer.current = api.duration("roar") * 0.7; }
        break;
      case "roar":
        api.play("roar", { once: true, fade: 0.25 });
        turnTo(dx, dz, 4);
        if (timer.current <= 0) mode.current = "charge";
        break;
      case "charge":
        api.play("run", { fade: 0.25 });
        stepTo(live.player.x, live.player.z, CHARGE_SPEED);
        if (dist < REACH) { mode.current = "attack"; timer.current = 0.8; }
        else if (dist > LOSES) { game.setLost(false); mode.current = "stalk"; }
        break;
      case "attack":
        api.play("attack", { once: true, fade: 0.15, speed: 1.5 });
        turnTo(dx, dz, 8);
        if (timer.current <= 0) {
          if (dist < REACH * 1.5 && game.phase === "playing") { game.setPhase("caught"); mode.current = "done"; }
          else mode.current = game.phase === "playing" ? "charge" : "done";
        }
        break;
      case "thwarted":
        api.play("roar", { once: true, fade: 0.2 });
        turnTo(dx, dz, 4);
        if (timer.current <= 0) mode.current = "leave";
        break;
      case "leave":
        api.play("walk", { fade: 0.4 });
        if (stepTo(LAIR.x, LAIR.z, STALK_SPEED * 1.4)) mode.current = "gone";
        break;
      case "done":
        if (api.clip !== "attack" || api.time("attack") >= api.duration("attack") - 0.05) api.play("idle", { fade: 0.6 });
        break;
      case "gone":
        break;
    }

    const visible = mode.current !== "absent" && mode.current !== "gone";
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
