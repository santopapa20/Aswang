import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Vector3 } from "three";
import { crossesLine, live, pushOut, useGame } from "./state";
import { useCharacter } from "./useCharacter";

type Mode = "idle" | "wander" | "scream" | "chase" | "attack" | "repelled" | "flee" | "done";

const HOME = new Vector3(8, 0, -14);
const WALK_SPEED = 0.6;       // matches the slow zombie walk clip
const RUN_SPEED = 3.0;        // a little slower than the player's run, so he can get away
const REACH = 1.25;           // metres at which she strikes
const GIVE_UP = 22;           // metres at which she loses him
const GARLIC_RANGE = 2.6;     // metres at which garlic drives her back

export function Aswang() {
  const shadows = useGame((s) => s.shadows);
  const runId = useGame((s) => s.runId);
  const { group, model, api } = useCharacter("/models/aswang.glb", shadows);
  const blob = useRef<Group>(null);
  const pos = useRef(HOME.clone());
  const facing = useRef(0);
  const mode = useRef<Mode>("idle");
  const timer = useRef(0);
  const goal = useRef(HOME.clone());

  useEffect(() => {
    pos.current.copy(HOME);
    facing.current = 0;
    mode.current = "idle";
    timer.current = 3;
    api.reset();
    api.play("idle", { fade: 0 });
  }, [runId, api]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const g = group.current;
    if (!g) return;
    const game = useGame.getState();
    const p = pos.current;
    const toPlayer = new Vector3(live.player.x - p.x, 0, live.player.z - p.z);
    const dist = toPlayer.length();

    const turnTo = (dx: number, dz: number, rate: number) => {
      let diff = Math.atan2(dx, dz) - facing.current;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      facing.current += diff * Math.min(1, dt * rate);
    };
    /** Walks towards a point. Returns "there", "blocked" (a salt line is in the way) or "going". */
    const stepTo = (tx: number, tz: number, speed: number): "there" | "blocked" | "going" => {
      const dx = tx - p.x, dz = tz - p.z;
      const d = Math.hypot(dx, dz);
      if (d < 0.05) return "there";
      const nx = p.x + (dx / d) * speed * dt, nz = p.z + (dz / d) * speed * dt;
      // look a little further ahead than one step, so she stops short of the salt
      const lx = p.x + (dx / d) * 0.6, lz = p.z + (dz / d) * 0.6;
      if (game.lines.some((l) => crossesLine(p.x, p.z, lx, lz, l))) return "blocked";
      p.x = nx; p.z = nz;
      pushOut(p, 0.4);
      turnTo(dx, dz, 6);
      return d < 0.6 ? "there" : "going";
    };
    const repel = () => { mode.current = "repelled"; timer.current = api.duration("repelled") * 0.9; };
    const notice = () => { mode.current = "scream"; timer.current = api.duration("scream") * 0.85; game.setHunted(true); };

    timer.current -= dt;
    const noticed = game.phase === "playing" && dist < live.playerNoise;

    switch (mode.current) {
      case "idle":
        api.play("idle", { fade: 0.4 });
        if (noticed) notice();
        else if (timer.current <= 0) {
          goal.current.set(HOME.x + (Math.random() - 0.5) * 18, 0, HOME.z + (Math.random() - 0.5) * 18);
          mode.current = "wander"; timer.current = 14;
        }
        break;
      case "wander":
        api.play("walk", { fade: 0.4 });
        if (noticed) notice();
        else if (stepTo(goal.current.x, goal.current.z, WALK_SPEED) !== "going" || timer.current <= 0) { mode.current = "idle"; timer.current = 3 + Math.random() * 4; }
        break;
      case "scream":
        api.play("scream", { once: true, fade: 0.2 });
        turnTo(toPlayer.x, toPlayer.z, 5);
        if (timer.current <= 0) mode.current = "chase";
        break;
      case "chase": {
        api.play("run", { fade: 0.2 });
        if (game.phase !== "playing") { mode.current = "idle"; timer.current = 4; break; }
        if (dist < GARLIC_RANGE && game.useGarlic()) { repel(); break; }
        const step = stepTo(live.player.x, live.player.z, RUN_SPEED);
        if (step === "blocked") { repel(); break; }
        if (dist < REACH) { mode.current = "attack"; timer.current = 1.0; }
        else if (dist > GIVE_UP) { mode.current = "idle"; timer.current = 3; game.setHunted(false); }
        break;
      }
      case "attack":
        api.play("attack", { once: true, fade: 0.15, speed: 1.6 });
        turnTo(toPlayer.x, toPlayer.z, 10);
        if (timer.current <= 0) {
          if (dist < REACH * 1.6 && game.phase === "playing") { game.setPhase("caught"); mode.current = "done"; }
          else mode.current = "chase";       // he slipped away during the wind-up
        }
        break;
      case "repelled":
        // salt or garlic: she recoils, then backs away for a while
        api.play("repelled", { once: true, fade: 0.15 });
        if (timer.current <= 0) { mode.current = "flee"; timer.current = 6; }
        break;
      case "flee": {
        api.play("run", { fade: 0.25 });
        const away = dist > 0.01 ? toPlayer.clone().multiplyScalar(-1 / dist) : new Vector3(0, 0, -1);
        stepTo(p.x + away.x * 4, p.z + away.z * 4, RUN_SPEED * 0.8);
        if (timer.current <= 0 || dist > 16) { mode.current = "idle"; timer.current = 4; game.setHunted(false); }
        break;
      }
      case "done":
        if (api.time("attack") >= api.duration("attack") - 0.05) api.play("idle", { fade: 0.6 });
        break;
    }

    g.position.copy(p);
    g.rotation.y = facing.current;
    blob.current?.position.set(p.x, 0.02, p.z);
  });

  return (
    <>
      <group ref={group}>
        <primitive object={model} />
      </group>
      <group ref={blob}>
        <mesh rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.5, 20]} />
          <meshBasicMaterial color="#000" transparent opacity={0.35} depthWrite={false} />
        </mesh>
      </group>
    </>
  );
}
