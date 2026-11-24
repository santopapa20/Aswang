import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh, PointLight, Vector3 } from "three";
import { live, mods, SHIRT_SECONDS, useGame, step as frameStep } from "./state";
import { pushOut } from "./layout";
import { actions, moveAxis, held, toggles } from "./input";
import { interactables, Interactable } from "./interact";
import { useCharacter } from "./useCharacter";
import { useProp } from "./useProp";
import { sound } from "./audio";
import { BLADE, EAT, WHIP } from "./data";

const SPEED = { sneak: 0.9, walk: 1.7, run: 3.6 };
// how far away each way of moving can be noticed, in metres
const NOISE = { still: 4.5, sneak: 4, walk: 9, run: 15 };
const RUN_SECONDS = 7;        // how long he can run on a full breath
const OIL_SECONDS = 50;       // how long one unit of oil burns
const hand = new Vector3();

export function Player() {
  const shadows = useGame((s) => s.shadows);
  const runId = useGame((s) => s.runId);
  const { group, model, api } = useCharacter("/models/player.glb", shadows, false);
  const lantern = useProp("/models/lantern.glb", 0.34, "y", 1, false)[0];
  const lamp = useRef<Group>(null);
  const light = useRef<PointLight>(null);
  const fill = useRef<PointLight>(null);
  const blob = useRef<Group>(null);
  const flame = useRef<Mesh>(null);
  const stillFor = useRef(0);
  const winded = useRef(false);
  const holding = useRef({ key: "", t: 0 });
  const step = useRef(0);
  const gait = useRef(0);
  const swing = useRef({ x: 0, z: 0, vx: 0, vz: 0, px: 0, pz: 0, ux: 0, uz: 0, ready: false });

  useEffect(() => {
    stillFor.current = 0;
    live.shirtTurn = 0; live.caught = 0; live.stamina = 1; live.health = mods(useGame.getState()).health; live.hurt = 0; live.eating = 0; live.prompts.E = live.prompts.G = null; live.near = [];
    holding.current = { key: "", t: 0 };
    api.reset();
    api.play("idle", { fade: 0 });
  }, [runId, api]);

  useFrame((state, rawDt) => {
    const dt = frameStep(rawDt);
    const g = group.current;
    if (!g) return;
    const game = useGame.getState();
    const m = mods(game);
    const night = game.stage === "night";
    const free = (game.stage === "day" || night) && !game.dialogue && !game.panel && live.caught <= 0;
    let mode: keyof typeof NOISE = "still";

    if (live.caught > 0) {
      api.play("caught", { once: true, fade: 0.15 });
      live.playerNoise = 0; live.prompts.E = live.prompts.G = null; live.near = [];
    } else if (!free) {
      api.play("idle", { fade: 0.4 });
      live.playerNoise = NOISE.still; live.prompts.E = live.prompts.G = null; live.near = [];
      holding.current.t = 0;
    } else {
      // ---- what is within reach (E and G)
      let near: Record<"E" | "G", Interactable | null> = { E: null, G: null };
      let best = { E: 9, G: 9 };
      const around: typeof live.near = [];
      for (const it of interactables(game)) {
        const d = Math.hypot(it.x - live.player.x, it.z - live.player.z);
        if (d < it.r && d < best[it.button]) { best[it.button] = d; near[it.button] = it; }
        // one ring per place: the door offers both E and G, and they would draw on top of each other
        if (d < 7.5 && it.act && around.length < 10 && !around.some((a) => Math.hypot(a.x - it.x, a.z - it.z) < 0.6)) around.push({ x: it.x, z: it.z, r: Math.min(0.8, it.r * 0.45), button: it.button, focus: false });
      }
      for (const a of around) a.focus = [near.E, near.G].some((n) => n && Math.hypot(n.x - a.x, n.z - a.z) < 0.6);
      live.near = around;
      const button = held.has("KeyE") && near.E?.act ? "E" : held.has("KeyG") && near.G?.act ? "G" : null;
      const using = button ? near[button]! : null;
      // turning his shirt inside out breaks the tikbalang's hold; he must stand still for it
      const turningShirt = game.lost && held.has("KeyT");
      if (turningShirt) {
        live.shirtTurn += dt;
        if (live.shirtTurn >= SHIRT_SECONDS) { game.set({ shirt: true, lost: false }); live.shirtTurn = 0; game.gainXp(25); }
      } else live.shirtTurn = 0;

      // ---- H held: he stands and eats a bundle of herbs, and some of his strength comes back
      const hungry = held.has("KeyH") && !using && !turningShirt;
      if (hungry && game.bag.herbs <= 0) { live.eating = 0; game.hint("noherbs", "You have no herbs to eat. Pick them where they grow, or search for them."); }
      else if (hungry && live.health >= m.health - 0.5) live.eating = 0;
      else if (hungry) {
        live.eating += dt;
        if (live.eating >= EAT.seconds) { live.eating = 0; game.spend("herbs", 1); live.health = Math.min(m.health, live.health + EAT.heals); sound.blip(); }
      } else live.eating = 0;
      const eating = live.eating > 0;

      // ---- moving
      const want = using || turningShirt || eating ? { x: 0, z: 0 } : moveAxis();
      const moving = want.x !== 0 || want.z !== 0;
      if (live.stamina <= 0) winded.current = true;
      if (live.stamina > 0.3) winded.current = false;
      const running = moving && !toggles.sneak && !winded.current && (held.has("ShiftLeft") || held.has("ShiftRight"));
      mode = !moving ? "still" : toggles.sneak ? "sneak" : running ? "run" : "walk";
      live.stamina = Math.max(0, Math.min(1, live.stamina + (running ? -dt / (RUN_SECONDS * m.stamina) : dt / 8)));
      if (moving) {
        const speed = SPEED[mode as keyof typeof SPEED] * m.speed * (game.carrying === "water" ? 0.85 : 1);
        const bx = live.player.x, bz = live.player.z;
        live.player.x += want.x * speed * dt;
        live.player.z += want.z * speed * dt;
        pushOut(live.player, 0.35);
        // steps keep time with how far he actually went (slower when leaning on a wall)
        const went = Math.hypot(live.player.x - bx, live.player.z - bz) / Math.max(dt, 1e-3);
        gait.current += (Math.max(went, speed * 0.35) - gait.current) * Math.min(1, dt * 10);
        let diff = Math.atan2(want.x, want.z) - live.facing;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        live.facing += diff * Math.min(1, dt * 12);
        stillFor.current = 0;
        api.move(mode, gait.current, { fade: 0.2 });
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
      for (const b of ["E", "G"] as const) {
        const it = near[b];
        live.prompts[b] = it ? { label: it.label, progress: !it.act ? -1 : using === it ? holding.current.t / Math.max(0.01, it.hold) : 0 } : null;
      }

      // ---- Q pours a line of salt across the ground just ahead of him
      if (actions.pour) {
        const fx = Math.sin(live.facing), fz = Math.cos(live.facing);
        const cx = live.player.x + fx * 0.9, cz = live.player.z + fz * 0.9, half = 1.4;
        if (!game.pourSalt({ ax: cx - fz * half, az: cz + fx * half, bx: cx + fz * half, bz: cz - fx * half })) game.toast("You have no salt.", "bad");
      }
      // ---- R cracks the whip: she falls back if she is close (Aswang.tsx listens for `whipWait`)
      if (actions.whip && game.hasWhip && live.whipWait <= 0 && live.stamina > 0.2) { live.whipWait = WHIP.cooldown * m.whip; live.whipCrack = true; live.stamina -= 0.2; sound.whip(); }
      // ---- V strikes with the itak (close, in front of him); Z throws a salt pouch in the face of what is in front
      if (actions.slash && game.kit.itak && live.itakWait <= 0 && live.stamina > BLADE.breath) { live.itakWait = BLADE.cooldown; live.slash = true; live.stamina -= BLADE.breath; sound.slash(); }
      else if (actions.slash && !game.kit.itak) game.hint("noitak", "You have no itak. Make one at the bench beside the house, by day.");
      if (actions.pouch) {
        if (game.kit.pouch > 0) { game.set({ kit: { ...game.kit, pouch: game.kit.pouch - 1 } }); live.saltThrow = true; sound.whoosh(); }
        else game.hint("nopouch", "You have no salt pouches. Make them at the bench beside the house, by day.");
      }
    }
    actions.pour = false; actions.whip = false; actions.slash = false; actions.pouch = false;
    live.itakWait = Math.max(0, live.itakWait - dt);
    live.whipWait = Math.max(0, live.whipWait - dt);
    live.hurt = Math.max(0, live.hurt - dt * 1.4);
    live.health = Math.min(live.health, m.health);
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
      // it hangs from his fingers on a short handle and swings: the hand's acceleration pushes the lamp
      // the other way, gravity brings it back, and the handle's friction settles it
      const s = swing.current;
      if (!s.ready || dt <= 0) { s.px = hand.x; s.pz = hand.z; s.ux = 0; s.uz = 0; s.ready = true; }
      else {
        const ux = (hand.x - s.px) / dt, uz = (hand.z - s.pz) / dt;
        const ax = Math.max(-40, Math.min(40, (ux - s.ux) / dt)), az = Math.max(-40, Math.min(40, (uz - s.uz) / dt));
        s.px = hand.x; s.pz = hand.z; s.ux = ux; s.uz = uz;
        const L = 0.22, k = 9.8 / L, c = 5.5;
        s.vx += (-k * s.x - c * s.vx - ax / L) * dt; s.x += s.vx * dt;          // about z: + swings the lamp toward +x
        s.vz += (-k * s.z - c * s.vz + az / L) * dt; s.z += s.vz * dt;          // about x: + swings it toward -z
        s.x = Math.max(-0.7, Math.min(0.7, s.x)); s.z = Math.max(-0.7, Math.min(0.7, s.z));
      }
      lamp.current.rotation.set(s.z, 0, s.x);
    }
    if (light.current) {
      const t = state.clock.elapsedTime;
      const flicker = 0.9 + 0.06 * Math.sin(t * 11.3) + 0.04 * Math.sin(t * 23.7 + 1.3);
      const dark = 1 - live.daylight;
      const strength = !lit ? 0 : dry ? 5 : live.caught > 0 ? 12 : 36;
      const want = strength * flicker * Math.max(0, dark * 1.15 - 0.15);
      light.current.intensity += (want - light.current.intensity) * Math.min(1, dt * 6);
      light.current.distance = 17 * m.lamp;
      if (fill.current) fill.current.intensity = light.current.intensity * 0.3;
      if (flame.current) flame.current.visible = strength > 0 && dark > 0.2;
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
        {/* the flame itself: a small bright core, so the lantern reads as lit from any distance */}
        <mesh ref={flame} position={[0, -0.06, 0]}>
          <sphereGeometry args={[0.034, 10, 8]} />
          <meshBasicMaterial color="#ffc978" fog={false} />
        </mesh>
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
