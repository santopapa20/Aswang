import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Vector3 } from "three";
import { catchPlayer, crossesLine, live, rnd, useGame } from "./state";
import { home, lurkPoints, Opening, openings, P2, pushOut } from "./layout";
import { ROSING_SAYS } from "./story";
import { useCharacter } from "./useCharacter";
import { sound } from "./audio";

type Mode = "away" | "lurk" | "prowl" | "approach" | "test" | "recoil" | "withdraw" | "scream" | "chase" | "attack" | "repelled" | "flee";

const WALK = 0.9, STALK = 2.1;
const REACH = 1.25;           // metres at which she strikes
const GARLIC_RANGE = 2.6;     // metres at which carried garlic drives her back
const LIGHT = 3.3;            // she will not work at the house with a lit lamp this close (less than door to window)

/**
 * The aswang on foot. She is not hunting him; she wants the house. She waits outside the lamplight,
 * tries one opening at a time, and draws off when he comes to where she is working. A protection turns
 * her back once. If he is far from the house, in the dark, or noisy near her, she goes for him instead.
 */
export function Aswang() {
  const shadows = useGame((s) => s.shadows);
  const runId = useGame((s) => s.runId);
  const { group, model, api } = useCharacter("/models/aswang.glb", shadows);
  const blob = useRef<Group>(null);
  const pos = useRef(new Vector3());
  const facing = useRef(0);
  const mode = useRef<Mode>("away");
  const timer = useRef(0);
  const goal = useRef<P2>({ x: 0, z: 0 });
  const target = useRef<Opening>(openings[0]);
  const stage2 = useRef(false);       // on the way to an opening: past the approach point
  const chaseFor = useRef(0);
  const sated = useRef(false);        // she has just been inside: she keeps away for a good while, however far he is

  useEffect(() => {
    mode.current = "away";
    live.aswang.active = false; live.breach = 0; live.breachAt = null;
    api.reset();
    api.play("idle", { fade: 0 });
  }, [runId, api]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const g = group.current;
    if (!g) return;
    const game = useGame.getState();
    const night = game.night;
    const present = game.stage === "night" && game.form === "foot" && !(night === 3 && game.trusted) && live.caught <= 0;
    if (!present) {
      if (mode.current !== "away" && game.stage === "night" && live.caught > 0) { api.play("idle", { fade: 0.6 }); return; }
      // (only clear what is hers: on other nights the manananggal uses the same breach meter)
      if (mode.current !== "away") { live.breach = 0; live.breachAt = null; live.aswang.active = false; }
      if (game.stage !== "night" || game.form === "foot") live.aswang.active = false;
      mode.current = "away"; g.visible = false; if (blob.current) blob.current.visible = false;
      return;
    }
    const p = pos.current;
    if (mode.current === "away") {
      // she comes out of the dark at the lurk point furthest from him
      const far = [...lurkPoints].sort((a, b) => Math.hypot(b.x - live.player.x, b.z - live.player.z) - Math.hypot(a.x - live.player.x, a.z - live.player.z))[0];
      p.set(far.x, 0, far.z);
      mode.current = "lurk"; timer.current = night === 1 ? 34 : 22;
      game.set({ mana: "absent" });
    }
    const dx = live.player.x - p.x, dz = live.player.z - p.z;
    const dist = Math.hypot(dx, dz);
    const lit = game.lampOn && live.lampBlown <= 0 && game.bag.oil > 0;
    const fromHome = Math.hypot(live.player.x - home.x, live.player.z - home.z);
    const guarding = lit && fromHome < 9;

    const turnTo = (x: number, z: number, rate: number) => {
      let diff = Math.atan2(x, z) - facing.current;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      facing.current += diff * Math.min(1, dt * rate);
    };
    /** Walks towards a point. Returns "there", "blocked" (a salt line is in the way) or "going". */
    const stepTo = (tx: number, tz: number, speed: number, near = 0.5): "there" | "blocked" | "going" => {
      const ex = tx - p.x, ez = tz - p.z;
      const d = Math.hypot(ex, ez);
      if (d < near) return "there";
      const lx = p.x + (ex / d) * 0.6, lz = p.z + (ez / d) * 0.6;
      if (game.lines.some((l) => crossesLine(p.x, p.z, lx, lz, l))) return "blocked";
      p.x += (ex / d) * speed * dt; p.z += (ez / d) * speed * dt;
      pushOut(p, 0.4);
      turnTo(ex, ez, 6);
      return "going";
    };
    const lurkAway = (wait: number) => {
      const spots = lurkPoints.filter((s) => Math.hypot(s.x - live.player.x, s.z - live.player.z) > 7);
      goal.current = spots[Math.floor(rnd() * spots.length)] ?? lurkPoints[0];
      live.breach = 0; live.breachAt = null;
      timer.current = wait;
    };
    const hunt = () => { mode.current = "scream"; timer.current = api.duration("scream") * 0.7; game.set({ hunted: true }); live.breach = 0; live.breachAt = null; sound.shriek(); };
    const repel = () => { mode.current = "repelled"; timer.current = api.duration("repelled") * 0.9; sound.held(); };

    timer.current -= dt;
    const quiet = mode.current === "lurk" || mode.current === "prowl" || mode.current === "approach" || mode.current === "withdraw" || mode.current === "test";
    // he is fair game when he is away from the house, or near her with no light
    if (quiet && dist < live.playerNoise * 0.85 && (!guarding || (!lit && dist < 6))) hunt();

    switch (mode.current) {
      case "lurk":
        api.play("idle", { fade: 0.5 });
        turnTo(home.x - p.x, home.z - p.z, 2);
        if (timer.current <= 0) {
          // pick an opening, preferring the one furthest from him
          const ranked = [...openings].sort((a, b) => Math.hypot(b.x - live.player.x, b.z - live.player.z) - Math.hypot(a.x - live.player.x, a.z - live.player.z));
          target.current = ranked[rnd() < 0.7 ? 0 : 1];
          stage2.current = false; mode.current = "approach";
        } else if (rnd() < dt * 0.09) { lurkAway(timer.current); mode.current = "prowl"; }
        break;
      case "prowl":
        api.play("walk", { fade: 0.4, speed: 1.3 });
        if (stepTo(goal.current.x, goal.current.z, WALK) !== "going") mode.current = "lurk";
        if (timer.current <= 0) mode.current = "lurk";
        break;
      case "approach": {
        api.play("run", { fade: 0.3, speed: 0.75 });
        const t = target.current;
        const to = stage2.current ? t : t.approach;
        const s = stepTo(to.x, to.z, STALK, stage2.current ? 0.55 : 1.2);
        if (s === "blocked") { repel(); break; }
        if (lit && dist < LIGHT) { lurkAway(10 + rnd() * 6); mode.current = "withdraw"; break; }
        if (s === "there") {
          if (!stage2.current) stage2.current = true;
          else if (game.testWard(t.id) === "held") {
            game.say("Rosing", ROSING_SAYS.held(t.name)); sound.held();
            mode.current = "recoil"; timer.current = api.duration("repelled") * 0.9;
          } else {
            mode.current = "test"; live.breach = 0; live.breachAt = t.id;
            game.say("Rosing", ROSING_SAYS.trying(t.name)); sound.knock();
          }
        }
        break;
      }
      case "test":
        // working at an unprotected opening: the scratching you hear
        api.play("attack", { fade: 0.3, speed: 0.6 });
        turnTo(home.x - p.x, home.z - p.z, 6);
        live.breach += dt / (night === 1 ? 10 : 7.5);
        if (lit && dist < LIGHT) { lurkAway((night === 1 ? 18 : 12) + rnd() * 8); mode.current = "withdraw"; game.gainXp(8); break; }
        if (live.breach >= 1) {
          sound.breach();
          game.breach(`It got in through ${target.current.name}.`);
          lurkAway(60); mode.current = "withdraw"; sated.current = true;
        }
        break;
      case "recoil":
        api.play("repelled", { once: true, fade: 0.15 });
        if (timer.current <= 0) { lurkAway(26 + rnd() * 10); mode.current = "withdraw"; }
        break;
      case "withdraw": {
        api.play("run", { fade: 0.3, speed: 0.8 });
        const wait = timer.current;
        if (stepTo(goal.current.x, goal.current.z, STALK * 1.15) !== "going") {
          // with nobody at the house she comes back sooner, unless she has just fed
          mode.current = "lurk"; timer.current = Math.max(4, wait) * (guarding || sated.current ? 1 : 0.6); sated.current = false;
        }
        break;
      }
      case "scream":
        api.play("scream", { once: true, fade: 0.2 });
        turnTo(dx, dz, 5);
        if (timer.current <= 0) { mode.current = "chase"; chaseFor.current = 13; }
        break;
      case "chase": {
        api.play("run", { fade: 0.2 });
        chaseFor.current -= dt;
        if (dist < GARLIC_RANGE && game.useGarlic()) { game.toast("The garlic at your belt turns her.", "good"); repel(); break; }
        if (live.whipCrack && dist < 3.8) { repel(); break; }
        const s = stepTo(live.player.x, live.player.z, night === 1 ? 3.0 : 3.25);
        if (s === "blocked") { repel(); break; }
        if (dist < REACH) { mode.current = "attack"; timer.current = 0.9; }
        else if (dist > 22 || chaseFor.current <= 0) { lurkAway(8); mode.current = "withdraw"; game.set({ hunted: false }); }
        break;
      }
      case "attack":
        api.play("attack", { once: true, fade: 0.15, speed: 1.6 });
        turnTo(dx, dz, 10);
        if (timer.current <= 0) {
          if (dist < REACH * 1.6) { catchPlayer(); game.set({ hunted: false }); lurkAway(20); mode.current = "withdraw"; }
          else mode.current = "chase";
        }
        break;
      case "repelled":
        api.play("repelled", { once: true, fade: 0.15 });
        if (timer.current <= 0) { mode.current = "flee"; timer.current = 5; }
        break;
      case "flee": {
        api.play("run", { fade: 0.25 });
        const away = dist > 0.01 ? { x: -dx / dist, z: -dz / dist } : { x: 0, z: -1 };
        stepTo(p.x + away.x * 4, p.z + away.z * 4, 2.6);
        if (timer.current <= 0 || dist > 16) { lurkAway(14); mode.current = "withdraw"; game.set({ hunted: false }); }
        break;
      }
    }

    live.aswang.x = p.x; live.aswang.z = p.z; live.aswang.near = dist; live.aswang.active = true;
    g.visible = true;
    g.position.copy(p);
    g.rotation.y = facing.current;
    if (blob.current) { blob.current.visible = true; blob.current.position.set(p.x, 0.02, p.z); }
  });

  return (
    <>
      <group ref={group} visible={false}>
        <primitive object={model} />
      </group>
      <group ref={blob} visible={false}>
        <mesh rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.5, 20]} />
          <meshBasicMaterial color="#000" transparent opacity={0.35} depthWrite={false} />
        </mesh>
      </group>
    </>
  );
}
