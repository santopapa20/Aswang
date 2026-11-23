import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, PointLight, Vector3 } from "three";
import { live, mods, SHIRT_SECONDS, useGame } from "./state";
import { pushOut } from "./layout";
import { actions, moveAxis, held, toggles } from "./input";
import { interactables, Interactable } from "./interact";
import { useCharacter } from "./useCharacter";
import { useProp } from "./useProp";
import { sound } from "./audio";

const SPEED = { sneak: 0.9, walk: 1.7, run: 3.6 };
// how far away each way of moving can be noticed, in metres
const NOISE = { still: 4.5, sneak: 4, walk: 9, run: 15 };
const RUN_SECONDS = 7;        // how long he can run on a full breath
const OIL_SECONDS = 34;       // how long one unit of oil burns
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
  const stillFor = useRef(0);
  const winded = useRef(false);
  const holding = useRef({ key: "", t: 0 });
  const step = useRef(0);

  useEffect(() => {
    stillFor.current = 0;
    live.shirtTurn = 0; live.caught = 0; live.stamina = 1; live.prompt = null;
    holding.current = { key: "", t: 0 };
    api.reset();
    api.play("idle", { fade: 0 });
  }, [runId, api]);

  useFrame((state, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const g = group.current;
    if (!g) return;
    const game = useGame.getState();
    const m = mods(game);
    const night = game.stage === "night";
    const free = (game.stage === "day" || night) && !game.dialogue && !game.panel && live.caught <= 0;
    let mode: keyof typeof NOISE = "still";

    if (live.caught > 0) {
      api.play("caught", { once: true, fade: 0.15 });
      live.playerNoise = 0; live.prompt = null;
    } else if (!free) {
      api.play("idle", { fade: 0.4 });
      live.playerNoise = NOISE.still; live.prompt = null;
      holding.current.t = 0;
    } else {
      // ---- what is within reach (E and G)
      let near: Record<"E" | "G", Interactable | null> = { E: null, G: null };
      let best = { E: 9, G: 9 };
      for (const it of interactables(game)) {
        const d = Math.hypot(it.x - live.player.x, it.z - live.player.z);
        if (d < it.r && d < best[it.button]) { best[it.button] = d; near[it.button] = it; }
      }
      const button = held.has("KeyE") && near.E?.act ? "E" : held.has("KeyG") && near.G?.act ? "G" : null;
      const using = button ? near[button]! : null;
      // turning his shirt inside out breaks the tikbalang's hold; he must stand still for it
      const turningShirt = game.lost && held.has("KeyT");
      if (turningShirt) {
        live.shirtTurn += dt;
        if (live.shirtTurn >= SHIRT_SECONDS) { game.set({ shirt: true, lost: false }); live.shirtTurn = 0; game.gainXp(25); }
      } else live.shirtTurn = 0;

      // ---- moving
      const want = using || turningShirt ? { x: 0, z: 0 } : moveAxis();
      const moving = want.x !== 0 || want.z !== 0;
      if (live.stamina <= 0) winded.current = true;
      if (live.stamina > 0.3) winded.current = false;
      const running = moving && !toggles.sneak && !winded.current && (held.has("ShiftLeft") || held.has("ShiftRight"));
      mode = !moving ? "still" : toggles.sneak ? "sneak" : running ? "run" : "walk";
      live.stamina = Math.max(0, Math.min(1, live.stamina + (running ? -dt / (RUN_SECONDS * m.stamina) : dt / 8)));
      if (moving) {
        const speed = SPEED[mode] * m.speed * (game.carrying === "water" ? 0.85 : 1);
        live.player.x += want.x * speed * dt;
        live.player.z += want.z * speed * dt;
        pushOut(live.player, 0.35);
        let diff = Math.atan2(want.x, want.z) - live.facing;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        live.facing += diff * Math.min(1, dt * 12);
        stillFor.current = 0;
        api.play(mode, { fade: 0.2 });
        step.current -= dt * (mode === "run" ? 3.1 : mode === "walk" ? 1.9 : 1.2);
        if (step.current <= 0) { step.current = 1; sound.step(mode === "sneak" ? 0.25 : mode === "run" ? 1 : 0.55); }
      } else {
        stillFor.current += dt;
        api.play(stillFor.current > 5 || game.hunted || game.lost || using ? "look" : "idle", { fade: 0.4 });
      }

      // ---- holding E or G on something
      if (using) {
        if (holding.current.key !== using.key) holding.current = { key: using.key, t: 0 };
        holding.current.t += dt;
        if (holding.current.t >= using.hold) { holding.current.t = 0; held.delete(button === "E" ? "KeyE" : "KeyG"); using.act!(); sound.blip(); }
      } else holding.current.t = 0;
      const shown = using ?? near.E ?? near.G;
      live.prompt = shown ? { key: shown.button, label: shown.label + (near.E && near.G && !using ? `   ·   G: ${near.G.label}` : ""), progress: using ? holding.current.t / Math.max(0.01, using.hold) : shown.act ? 0 : -1 } : null;

      // ---- Q pours a line of salt across the ground just ahead of him
      if (actions.pour) {
        const fx = Math.sin(live.facing), fz = Math.cos(live.facing);
        const cx = live.player.x + fx * 0.9, cz = live.player.z + fz * 0.9, half = 1.4;
        if (!game.pourSalt({ ax: cx - fz * half, az: cz + fx * half, bx: cx + fz * half, bz: cz - fx * half })) game.toast("You have no salt.", "bad");
      }
      // ---- R cracks the whip: she falls back if she is close (Aswang.tsx listens for `whipWait`)
      if (actions.whip && game.hasWhip && live.whipWait <= 0 && live.stamina > 0.2) { live.whipWait = 8 * m.whip; live.stamina -= 0.2; sound.whip(); }
    }
    actions.pour = false; actions.whip = false;
    live.whipWait = Math.max(0, live.whipWait - dt);
    live.lampBlown = Math.max(0, live.lampBlown - dt);

    // ---- the lamp: it burns oil at night, can be shuttered, and can be blown out
    const lit = game.lampOn && live.lampBlown <= 0;
    if (night && lit && free) {
      live.oilBurn += dt * m.oil;
      if (live.oilBurn >= OIL_SECONDS) { live.oilBurn = 0; if (!game.spend("oil", 1)) game.hint("dry", "The lamp is out of oil. It gives almost no light."); }
    }
    const dry = night && game.bag.oil <= 0;
    live.playerNoise = (NOISE[mode] + (night && lit && !dry ? 2.5 : 0)) * m.noise * (live.caught > 0 ? 0 : 1);

    g.position.copy(live.player);
    g.rotation.y = live.facing;
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
      const dark = 1 - live.daylight;
      const strength = !lit ? 0 : dry ? 5 : live.caught > 0 ? 12 : 36;
      const want = strength * flicker * (0.15 + 0.85 * dark);
      light.current.intensity += (want - light.current.intensity) * Math.min(1, dt * 6);
      light.current.distance = 17 * m.lamp;
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
        <pointLight
          ref={light}
          color="#ffae5c"
          intensity={0}
          distance={17}
          decay={1.6}
          castShadow={shadows}
          shadow-mapSize={[512, 512]}
          shadow-bias={-0.01}
          shadow-camera-near={0.15}
          shadow-camera-far={17}
        />
        {/* a weaker glow from higher up, so the lamp also lights him and not only the ground */}
        <pointLight ref={fill} position={[0, 1.4, 0.3]} color="#ffb877" intensity={0} distance={9} decay={1.8} />
      </group>
    </>
  );
}
