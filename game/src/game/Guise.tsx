import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { crossesLine, hitStop, hurt, live, mods, rnd, useGame, step } from "./state";
import { GUISE, GUISE_LOOKS, GuiseLook, KIN_AGAIN, KIN_FIRST, KIN_NIGHTS, TROPHIES } from "./data";
import { strikesAt } from "./combat";
import { kinRoam, kinSolids, P2, pushOut } from "./layout";
import { useCharacter } from "./useCharacter";
import { HealthBar, HealthBarHandle } from "./HealthBar";
import { sound } from "./audio";

type Mode = "away" | "stroll" | "watch" | "turn" | "recoil" | "alert" | "hunt" | "blocked" | "strike" | "back" | "hit" | "dying" | "dead";
const STRIKE = 1.0, STRIKE_AT = 0.45;   // the blow: how long it takes, and how far into it the hands land
const STRIKE_SPEED = 2.4;               // the aswang's attack clip is long and slow; played faster here
const TURN = 0.9;                       // showing itself: the scream, before it comes

/**
 * One of the aswang's kin in human guise: the farmer, the priest or the nurse (one component each; which
 * one walks tonight is set by the night, so each night brings a different face). It walks the paths like a
 * neighbour who is out late, and stops to watch him when he comes near. While the guise holds his blows do
 * nothing to it. A braid of garlic held up to it (G, from the interactables) shows it for what it is: it
 * reels, and then it is a kin like the others and can be laid down. Let it come close with the face still
 * on, or strike it first, and it shows itself and goes for him at once. Numbers in data.ts (GUISE).
 */
export function Guise({ look }: { look: GuiseLook }) {
  const L = GUISE.looks[look];
  const index = GUISE_LOOKS.indexOf(look);
  const shadows = useGame((s) => s.shadows);
  const runId = useGame((s) => s.runId);
  const { group, model, api } = useCharacter(`/models/${look}.glb`, shadows);
  const solid = kinSolids.guise[index];
  const pos = useRef(new Vector3());
  const facing = useRef(0);
  const tip = useRef(0);
  const mode = useRef<Mode>("away");
  const shown = useRef(false);                 // the guise is off: it can be hurt, and it glows
  const timer = useRef(0);
  const hp = useRef(L.health);
  const goal = useRef<P2>({ x: 0, z: 0 });
  const from = useRef<P2>({ x: 0, z: 0 });
  const shove = useRef({ x: 0, z: 0 });
  const stall = useRef(0);
  const detour = useRef({ t: 0, side: 1 });
  const bar = useRef<HealthBarHandle>(null);

  useEffect(() => { mode.current = "away"; shown.current = false; solid.r = 0; api.reset(); api.play("idle", { fade: 0 }); }, [runId, api, solid]);
  // its own materials: dark while the face holds, a sick glow once it is shown
  const skins = useRef<MeshStandardMaterial[]>([]);
  const flash = useRef(0);
  const glow = useRef(0);
  useEffect(() => {
    skins.current = [];
    model.traverse((o) => {
      const mesh = o as Mesh, m = mesh.material as MeshStandardMaterial | undefined;
      if (!mesh.isMesh || !m?.isMeshStandardMaterial) return;
      const own = m.clone();
      own.emissive = new Color(L.glow); own.emissiveMap = own.map; own.emissiveIntensity = 0;
      mesh.material = own; skins.current.push(own);
    });
  }, [model, L.glow]);

  useFrame((_, rawDt) => {
    const dt = step(rawDt);
    const g = group.current;
    if (!g) return;
    const game = useGame.getState();
    const me = live.kin.guise[index];
    if (game.stage !== "night") {
      mode.current = "away"; shown.current = false; solid.r = 0; g.visible = false; me.mode = "away"; me.unmask = false;
      bar.current?.set(0, 0, 0, 1, false);
      return;
    }
    if (game.panel || game.dialogue) return;
    const p = pos.current;
    solid.r = 0;
    const dx = live.player.x - p.x, dz = live.player.z - p.z;
    const dist = Math.hypot(dx, dz);
    const lit = game.lampOn && live.lampBlown <= 0 && (game.bag.oil > 0 || game.strongLamp);
    const hidden = live.smudge > 0;              // a smouldering smudge bundle hides his scent
    timer.current -= dt;

    const turnToward = (x: number, z: number, rate: number) => {
      let diff = Math.atan2(x, z) - facing.current;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      facing.current += Math.max(-rate * dt, Math.min(rate * dt, diff));
      return Math.abs(diff);
    };
    const go = (speed: number) => {
      const ux = Math.sin(facing.current), uz = Math.cos(facing.current);
      if (game.lines.some((l) => crossesLine(p.x, p.z, p.x + ux * 0.6, p.z + uz * 0.6, l))) return false;
      const bx = p.x, bz = p.z;
      p.x += ux * speed * dt; p.z += uz * speed * dt;
      pushOut(p, 0.35);
      stall.current = Math.hypot(p.x - bx, p.z - bz) < speed * dt * 0.3 ? stall.current + dt : 0;
      if (stall.current > 0.4) { detour.current = { t: 1.2, side: detour.current.t > 0 ? -detour.current.side : rnd() < 0.5 ? 1 : -1 }; stall.current = 0; }
      return true;
    };
    const steer = (x: number, z: number, rate: number) => {
      detour.current.t = Math.max(0, detour.current.t - dt);
      if (detour.current.t <= 0) return turnToward(x, z, rate);
      const s = detour.current.side * 1.3, c = Math.cos(s), n = Math.sin(s);
      turnToward(x * c + z * n, -x * n + z * c, rate * 1.5);
      return 0;
    };
    const haunt = () => kinRoam.guise[Math.floor(rnd() * kinRoam.guise.length)];
    const strike = () => { mode.current = "strike"; timer.current = STRIKE; api.play("attack", { once: true, fade: 0.1, speed: STRIKE_SPEED }); };
    /** The face comes off. `garlic`: shown up by him, and it reels; otherwise it shows itself, and comes. */
    const unmask = (garlic: boolean) => {
      shown.current = true; from.current = { x: p.x, z: p.z }; sound.shriek(); sound.unmask();
      if (garlic) {
        mode.current = "recoil"; timer.current = GUISE.recoil; api.play("repelled", { once: true, fade: 0.12 });
        game.gainXp(5);
        game.toast(`The garlic finds it out. The ${L.name}'s face slides, and what is under it reels back.`, "good");
        game.hint("guise-shown", "Now it is only kin. The whip (R) and the itak (V) will mark it.");
      } else if (dist < L.reach * 1.3) {
        strike();
        game.toast(`It was not a ${L.name}.`, "bad");
      } else {
        mode.current = "turn"; timer.current = TURN; api.play("scream", { once: true, fade: 0.12, speed: 1.4 });
        game.toast(`It was not a ${L.name}.`, "bad");
      }
    };
    const die = () => {
      mode.current = "dying"; timer.current = 0.6;
      sound.whoosh(); hitStop(0.12); flash.current = 1;
      live.guiseNext = live.elapsed + KIN_AGAIN;
      const coins = game.add("coins", L.coins[0] + Math.floor(rnd() * (L.coins[1] - L.coins[0] + 1)));
      const two = rnd() < mods(game).skinner;
      game.set({ trophies: { ...game.trophies, [GUISE.trophy]: game.trophies[GUISE.trophy] + (two ? 2 : 1) } });
      game.gainXp(L.xp);
      game.toast(`What walked as a ${L.name} lies still.${coins ? ` ${coins} centavos,` : ""} and ${two ? "two black stones" : TROPHIES[GUISE.trophy].name.toLowerCase()} from under its tongue.`, "good");
      game.laidDown("guise");
    };

    // garlic held up to it (interact.ts sets the flag; it only offers while the face is on)
    if (me.unmask) {
      me.unmask = false;
      if (!shown.current && (mode.current === "stroll" || mode.current === "watch")) unmask(true);
    }
    const blow = strikesAt(p.x, p.z);
    const struck = blow.damage > 0 || blow.stun > 0;
    const guised = mode.current === "stroll" || mode.current === "watch";
    if (struck && guised) {
      // a blow on a neighbour's body: it does not mark it, and it drops the pretence
      game.hint("guise-blow", "Your blow lands on what looks like a man and does not mark it. Hold up garlic first (G).");
      unmask(false);
    } else if (struck && shown.current && ["alert", "hunt", "blocked", "strike", "back", "recoil", "turn"].includes(mode.current)) {
      if (blow.damage <= 0) { mode.current = "hit"; timer.current = blow.stun; shove.current = { x: 0, z: 0 }; api.play("repelled", { once: true, fade: 0.08, speed: 1.6 }); }
      else {
        hp.current -= blow.damage;
        sound.strike(); game.gainXp(3); flash.current = 1;
        if (hp.current <= 0) die();
        else {
          hitStop(0.06);
          const n = Math.max(dist, 0.01);
          shove.current = { x: (-dx / n) * 2 * L.knockback, z: (-dz / n) * 2 * L.knockback };
          mode.current = "hit"; timer.current = Math.max(L.stagger, blow.stun); api.play("repelled", { once: true, fade: 0.08, speed: 1.8 });
        }
      }
    }

    switch (mode.current) {
      case "away": {
        const night = KIN_NIGHTS[game.night] ?? { guise: 0 };
        const turn = live.guiseLook ?? GUISE_LOOKS[(game.night + live.kinOut.guise) % GUISE_LOOKS.length];
        const others = live.kin.guise.some((k, i) => i !== index && k.mode !== "away");
        if (turn !== look || others || live.elapsed < KIN_FIRST || live.elapsed < live.guiseNext || live.kinOut.guise >= night.guise) break;
        const far = kinRoam.guise.filter((r) => Math.hypot(r.x - live.player.x, r.z - live.player.z) > 20);
        const at = far.length ? far[Math.floor(rnd() * far.length)] : kinRoam.guise[0];
        live.kinOut.guise += 1;
        p.set(at.x, 0, at.z); facing.current = rnd() * Math.PI * 2; tip.current = 0;
        hp.current = L.health; shown.current = false; goal.current = haunt(); mode.current = "stroll";
        break;
      }
      case "stroll": {
        // a neighbour out late, going about the paths; once shown, it prowls them the same way
        const gx = goal.current.x - p.x, gz = goal.current.z - p.z;
        if (Math.hypot(gx, gz) < 1.5) goal.current = haunt();
        steer(gx, gz, L.turn * 0.5);
        go(GUISE.stroll);
        api.move("walk", GUISE.stroll, { fade: 0.4 });
        if (live.caught <= 0 && !hidden && dist < GUISE.notice * (lit ? 1 : 0.6)) {
          if (shown.current) { mode.current = "alert"; timer.current = GUISE.alert; from.current = { x: p.x, z: p.z }; sound.shriek(); }
          else {
            mode.current = "watch";
            game.hint("guise", "Someone walks the path at this hour, and nobody in the barrio does. Hold up garlic (G) before you let it come close.");
          }
        }
        break;
      }
      case "watch":
        // it stands and watches him, as a neighbour would; too close and the face comes off
        api.play("idle", { fade: 0.3 });
        turnToward(dx, dz, L.turn * 0.6);
        if (hidden || dist > GUISE.notice + 2) mode.current = "stroll";
        else if (dist < GUISE.close) unmask(false);
        break;
      case "turn":
      case "recoil":
        turnToward(dx, dz, L.turn * (mode.current === "turn" ? 1.5 : 0.3));
        if (timer.current <= 0) mode.current = dist < L.reach && mode.current === "turn" ? "strike" : "hunt";
        if (mode.current === "strike") strike();
        break;
      case "alert":
        api.play("idle", { fade: 0.15 });
        turnToward(dx, dz, L.turn * 1.5);
        if (timer.current <= 0) mode.current = "hunt";
        break;
      case "hunt": {
        if (live.caught > 0 || hidden || dist > GUISE.lose || Math.hypot(p.x - from.current.x, p.z - from.current.z) > GUISE.leash) { mode.current = "stroll"; goal.current = { ...from.current }; break; }
        const off = steer(dx, dz, L.turn);
        if (!go(L.speed * Math.max(0.3, Math.cos(Math.min(off, Math.PI / 2))))) { mode.current = "blocked"; break; }
        api.move("run", L.speed, { fade: 0.25 });
        if (dist < L.reach && off < 0.7) strike();
        break;
      }
      case "blocked":
        api.play("idle", { fade: 0.3 });
        turnToward(dx, dz, L.turn);
        if (!game.lines.some((l) => crossesLine(p.x, p.z, live.player.x, live.player.z, l))) mode.current = "hunt";
        else if (dist > GUISE.lose) { mode.current = "stroll"; goal.current = haunt(); }
        break;
      case "strike":
        turnToward(dx, dz, L.turn * 0.8);
        if (timer.current <= STRIKE - STRIKE_AT && timer.current + dt > STRIKE - STRIKE_AT && dist < L.reach * 1.5) hurt(L.harm);
        if (timer.current <= 0) { mode.current = "back"; timer.current = L.rest; }
        break;
      case "back": {
        const n = Math.max(dist, 0.01);
        turnToward(-dx / n + (-dz / n) * 0.8, -dz / n + (dx / n) * 0.8, L.turn);
        go(GUISE.stroll * 1.8);
        api.move("walk", GUISE.stroll * 1.8, { fade: 0.3 });
        if (timer.current <= 0) mode.current = "hunt";
        break;
      }
      case "hit": {
        const k = Math.min(1, dt * 6);
        p.x += shove.current.x * k * 0.5; p.z += shove.current.z * k * 0.5;
        shove.current.x *= 1 - k; shove.current.z *= 1 - k;
        pushOut(p, 0.35);
        if (timer.current <= 0) mode.current = "hunt";
        break;
      }
      case "dying":
        // it goes over backwards, stiff
        tip.current = (Math.PI / 2) * Math.min(1, 1 - Math.max(0, timer.current) / 0.6);
        if (timer.current <= 0) { mode.current = "dead"; timer.current = 8; }
        break;
      case "dead":
        if (timer.current <= 0) mode.current = "away";
        break;
    }

    const standing = mode.current !== "away" && mode.current !== "dying" && mode.current !== "dead";
    g.visible = mode.current !== "away";
    g.position.set(p.x, 0, p.z);
    g.rotation.set(-tip.current, facing.current, 0, "YXZ");
    solid.x = p.x; solid.z = p.z; solid.r = standing ? 0.35 : 0;
    me.mode = mode.current; me.x = p.x; me.z = p.z; me.hp = hp.current / L.health; me.shown = shown.current;
    bar.current?.set(p.x, L.bar, p.z, hp.current / L.health, standing && shown.current && hp.current < L.health);
    flash.current = Math.max(0, flash.current - Math.min(rawDt, 0.1) * 6);
    glow.current += ((shown.current && mode.current !== "dead" ? 0.38 : 0) - glow.current) * Math.min(1, Math.min(rawDt, 0.1) * 3);
    for (const m of skins.current) m.emissiveIntensity = glow.current + flash.current * (game.settings.flashes === "reduced" ? 0.4 : 1.6);
  });

  return (
    <>
      <group ref={group} visible={false}>
        <primitive object={model} />
      </group>
      <HealthBar ref={bar} />
    </>
  );
}
