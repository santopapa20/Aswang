import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Quaternion, Vector3 } from "three";
import { catchPlayer, crossesLine, live, rnd, useGame } from "./state";
import { doorOf, house, pushOut } from "./layout";
import { useCharacter } from "./useCharacter";
import { sound } from "./audio";

type Mode = "kennel" | "seek" | "feed" | "lost" | "flee" | "sulk";

// how fast the ground passes under its paws in each clip at normal speed (set in tools/blender/rig_sigbin.py)
const WALK_CLIP = 0.97, RUN_CLIP = 2.4;
const RELEASE_AT = 40;        // seconds into the last night at which she lets it out
const STALK = 1.3;            // metres per second, tail first: slower than his walk, but it does not stop
const BOLT = 3.3;
const REACH = 1.7;            // metres from him at which it can get at his shadow
const DRAIN_SECONDS = 5;      // how long it must drink before he goes down
const WHIP_RANGE = 8;
const KENNEL = doorOf(house("pacing"));
const headAt = new Vector3(), headTurn = new Quaternion(), nose = new Vector3();

/**
 * Her hound, let out on the last night. It walks backwards, and it does not want him: it wants his
 * shadow, which only exists while his lamp is lit. Lit, it comes on tail first, and once it is at his
 * feet it drinks until he drops. Shutter the lamp (F) and it has nothing to follow; a salt line stops
 * it; the whip sends it off for a while. Where it is, and how much it has taken, is kept in
 * `live.sigbin`.
 */
export function Sigbin() {
  const shadows = useGame((s) => s.shadows);
  const runId = useGame((s) => s.runId);
  const { group, model, api } = useCharacter("/models/sigbin.glb", shadows);
  const blob = useRef<Group>(null);
  const eyes = useRef<Group>(null);
  const facing = useRef(0);
  const mode = useRef<Mode>("kennel");
  const timer = useRef(0);
  const roam = useRef({ x: 0, z: 0, wait: 0 });

  useEffect(() => {
    mode.current = "kennel"; timer.current = 0;
    Object.assign(live.sigbin, { x: KENNEL.x, z: KENNEL.z + 1, near: 99, out: false, feeding: false, drain: 0 });
    api.reset();
    api.play("idle", { fade: 0 });
  }, [runId, api]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const g = group.current;
    if (!g) return;
    const game = useGame.getState();
    const s = live.sigbin;
    const hide = () => { g.visible = false; if (blob.current) blob.current.visible = false; if (eyes.current) eyes.current.visible = false; };
    if (!(game.stage === "night" && game.night === 5)) { mode.current = "kennel"; s.out = false; s.feeding = false; s.drain = 0; hide(); return; }

    const lit = game.lampOn && live.lampBlown <= 0 && game.bag.oil > 0;
    const dx = live.player.x - s.x, dz = live.player.z - s.z, dist = Math.hypot(dx, dz);
    s.near = dist;
    timer.current -= dt;
    let feeding = false;
    let turnTo = facing.current;

    /** Takes one step towards (or away from) a point. Salt on the ground stops it. Returns false if it could not move. */
    const stepTo = (tx: number, tz: number, speed: number) => {
      const len = Math.hypot(tx - s.x, tz - s.z);
      if (len < 0.05) return false;
      const nx = s.x + ((tx - s.x) / len) * speed * dt, nz = s.z + ((tz - s.z) / len) * speed * dt;
      if (game.lines.some((l) => crossesLine(s.x, s.z, nx, nz, l))) return false;
      s.x = nx; s.z = nz; pushOut(s, 0.45);
      return true;
    };
    const away = Math.atan2(-dx, -dz), towards = Math.atan2(dx, dz);
    const barred = game.lines.some((l) => crossesLine(s.x, s.z, live.player.x, live.player.z, l));     // salt lies between them

    if (mode.current !== "kennel" && live.caught > 0) { mode.current = "sulk"; timer.current = 30; }
    if (live.whipCrack && dist < WHIP_RANGE && mode.current !== "kennel" && mode.current !== "flee") {
      mode.current = "flee"; timer.current = 4; game.gainXp(8); sound.yelp();
      game.toast("The sigbin yelps and bolts into the dark.", "good");
    }

    switch (mode.current) {
      case "kennel":
        if (live.elapsed > RELEASE_AT) {
          s.x = KENNEL.x; s.z = KENNEL.z + 1; s.out = true; facing.current = Math.PI;
          mode.current = "lost"; timer.current = 2.5; sound.growl();
          game.toast("Across the plaza a door opens. Something low comes out of it, tail first.", "bad");
        }
        break;
      case "seek":
        if (!lit) { mode.current = "lost"; timer.current = 1.5; roam.current = { x: s.x, z: s.z, wait: 3 }; break; }
        if (dist < REACH && !barred) { mode.current = "feed"; sound.growl(); break; }
        // tail first: it backs towards him, looking the other way
        turnTo = away;
        if (stepTo(live.player.x, live.player.z, STALK)) api.play("walk", { speed: -STALK / WALK_CLIP, fade: 0.3 });
        else api.play("idle", { fade: 0.4 });
        break;
      case "feed":
        if (!lit) { mode.current = "lost"; timer.current = 1.5; roam.current = { x: s.x, z: s.z, wait: 3 }; break; }
        if (dist > REACH + 0.8 || barred) { mode.current = "seek"; break; }
        feeding = true; turnTo = towards;
        api.play("feed", { fade: 0.35 });
        game.hint("sigbin", "It is not at you. It is at your shadow. Press F to shutter the lamp: no light, no shadow.");
        break;
      case "lost": {
        // nothing to follow: it casts about near where the shadow was
        if (lit && timer.current <= 0) { mode.current = "seek"; break; }
        const r = roam.current;
        r.wait -= dt;
        if (lit || r.wait > 0) { api.play("idle", { fade: 0.5 }); break; }
        if (Math.hypot(r.x - s.x, r.z - s.z) < 0.3 || !stepTo(r.x, r.z, 0.6)) {
          r.x = s.x + (rnd() - 0.5) * 7; r.z = s.z + (rnd() - 0.5) * 7; r.wait = 2 + rnd() * 3;
          api.play("idle", { fade: 0.5 });
          break;
        }
        turnTo = Math.atan2(s.x - r.x, s.z - r.z);
        api.play("walk", { speed: -0.6 / WALK_CLIP, fade: 0.4 });
        break;
      }
      case "flee":
        turnTo = away;
        stepTo(s.x - dx, s.z - dz, BOLT);
        api.play("run", { speed: BOLT / RUN_CLIP, fade: 0.15 });
        if (timer.current <= 0) { mode.current = "sulk"; timer.current = 26; }
        break;
      case "sulk":
        api.play("idle", { fade: 0.5 });
        if (timer.current <= 0) { mode.current = "lost"; timer.current = 0; roam.current = { x: s.x, z: s.z, wait: 2 }; }
        break;
    }

    // what it takes: his breath first, and then him
    s.feeding = feeding;
    s.drain = Math.max(0, Math.min(1, s.drain + (feeding ? dt / DRAIN_SECONDS : -dt / 10)));
    if (feeding) {
      live.stamina = Math.max(0, live.stamina - dt * 0.35);
      if (s.drain >= 1) { s.drain = 0; s.feeding = false; catchPlayer(); game.toast("Your shadow is gone, and your legs with it.", "bad"); }
    }

    let diff = turnTo - facing.current;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    facing.current += diff * Math.min(1, dt * 5);
    const shown = mode.current !== "kennel";
    g.visible = shown;
    g.position.set(s.x, 0, s.z);
    g.rotation.y = facing.current;
    if (blob.current) { blob.current.visible = shown; blob.current.position.set(s.x, 0.02, s.z); }

    // two points of red where its eyes are, so it can be found in the dark it leaves him in
    const head = api.bone("Head");
    if (head && eyes.current) {
      g.updateMatrixWorld(true);
      head.getWorldPosition(headAt); head.getWorldQuaternion(headTurn);
      nose.set(0, 1, 0).applyQuaternion(headTurn);
      eyes.current.visible = shown;
      eyes.current.position.set(headAt.x + nose.x * 0.11, headAt.y + nose.y * 0.11 + 0.035, headAt.z + nose.z * 0.11);
      eyes.current.rotation.y = facing.current;
    }
  });

  return (
    <>
      <group ref={group} visible={false}>
        <primitive object={model} />
      </group>
      <group ref={eyes} visible={false}>
        {[-0.065, 0.065].map((x) => (
          <mesh key={x} position={[x, 0, 0]}>
            <sphereGeometry args={[0.022, 8, 6]} />
            <meshBasicMaterial color="#ff3a1c" fog={false} toneMapped={false} />
          </mesh>
        ))}
      </group>
      <group ref={blob} visible={false}>
        <mesh rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.6, 20]} />
          <meshBasicMaterial color="#000" transparent opacity={0.35} depthWrite={false} />
        </mesh>
      </group>
    </>
  );
}
