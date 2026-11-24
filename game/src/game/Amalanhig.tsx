import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { crossesLine, hurt, live, mods, rnd, useGame } from "./state";
import { WHIP } from "./data";
import { HealthBar, HealthBarHandle } from "./HealthBar";
import { amalanhigGraves, amalanhigSolids, pushOut } from "./layout";
import { useCharacter } from "./useCharacter";
import { sound } from "./audio";

type Mode = "grave" | "rise" | "hunt" | "grab" | "hit" | "fall" | "down" | "return" | "sink";

const WAKE = 8;               // metres from its grave at which it hears him after dark
const LOSE = 24;              // and how far it follows him before it gives up and goes back down
const SPEED = 2.0;            // faster than he walks, slower than he runs
const TURN = 1.1;             // radians a second: its joints have set, so it turns slowly. Step aside and it lurches past
const REACH = 1.2;            // how close it must be, facing him, to get its hands on him
const HEALTH = 100;           // three whip blows lay it down for the rest of the night
const GRAB_HARM = 40;         // what its hands take from him; it lets go and he staggers clear
const GRAB_REST = 2.5;        // seconds before it can get hold of him again
const RISE = 2.4, FALL = 0.9;
const HALF_PI = Math.PI / 2;

/**
 * An amalanhig: one who was aswang and died without passing it on, so it cannot rest. It lies in the old
 * sitio's graveyard. After dark, if he comes near, it rises out of the ground stiff as a plank, pivoting on
 * its feet, and comes after him with its arms out. It cannot bend: it turns slowly, so stepping aside and
 * running beats it, and a salt line stops it. If it gets its hands on him it hurts him badly (twice and a
 * little more puts him down). The whip knocks it back and hurts it;
 * three blows and it falls flat and stays down till morning, and what it was buried with is his.
 * It is the one thing in the barrio he can fight. Model and motions: assets/amalanhig.
 */
export function Amalanhig({ index }: { index: number }) {
  const shadows = useGame((s) => s.shadows);
  const runId = useGame((s) => s.runId);
  const { group, model, api } = useCharacter("/models/amalanhig.glb", shadows);
  const grave = amalanhigGraves[index];
  const solid = amalanhigSolids[index];
  const pos = useRef(new Vector3(grave.x, 0, grave.z));
  const facing = useRef(0);
  const tilt = useRef(-HALF_PI);           // 0 standing, -90 degrees lying on its back
  const mode = useRef<Mode>("grave");
  const timer = useRef(0);
  const hits = useRef(0);
  const hp = useRef(HEALTH);
  const grabRest = useRef(0);
  const bar = useRef<HealthBarHandle>(null);
  const shove = useRef({ x: 0, z: 0 });
  const stall = useRef(0);

  const reset = () => {
    mode.current = "grave"; hits.current = 0; hp.current = HEALTH; grabRest.current = 0; tilt.current = -HALF_PI; facing.current = 0;
    pos.current.set(grave.x, 0, grave.z); solid.r = 0;
  };
  useEffect(() => { reset(); api.reset(); api.play("idle", { fade: 0 }); }, [runId, api]);   // eslint-disable-line react-hooks/exhaustive-deps
  // grave-pale: its own skin gives off a faint, sick light, so it can be made out in the dark before the lamp finds it
  useEffect(() => {
    model.traverse((o) => {
      const m = (o as Mesh).material as MeshStandardMaterial | undefined;
      if (!(o as Mesh).isMesh || !m?.isMeshStandardMaterial) return;
      m.emissive = new Color("#9fb59a"); m.emissiveMap = m.map; m.emissiveIntensity = 0.32; m.needsUpdate = true;
    });
  }, [model]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const g = group.current;
    if (!g) return;
    const game = useGame.getState();
    const me = live.amalanhig[index];
    if (game.stage !== "night") {
      // morning: whatever was out is back in the ground
      if (mode.current !== "grave") reset();
      g.visible = false; me.mode = "grave";
      return;
    }
    if (game.panel || game.dialogue) return;
    const p = pos.current;
    solid.r = 0;                              // its own circle must not push it about (set again below)
    const dx = live.player.x - p.x, dz = live.player.z - p.z;
    const dist = Math.hypot(dx, dz);
    timer.current -= dt;

    const turnToward = (x: number, z: number, rate: number) => {
      let diff = Math.atan2(x, z) - facing.current;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      facing.current += Math.max(-rate * dt, Math.min(rate * dt, diff));
      return Math.abs(diff);
    };
    /** Lurches forward the way it is facing (never sideways: it cannot). False if a salt line stops it. */
    const lurch = (speed: number) => {
      const ux = Math.sin(facing.current), uz = Math.cos(facing.current);
      if (game.lines.some((l) => crossesLine(p.x, p.z, p.x + ux * 0.6, p.z + uz * 0.6, l))) return false;
      const bx = p.x, bz = p.z;
      p.x += ux * speed * dt; p.z += uz * speed * dt;
      pushOut(p, 0.4);
      // pressed against something: it leans that way until it turns enough to slide past
      stall.current = Math.hypot(p.x - bx, p.z - bz) < speed * dt * 0.3 ? stall.current + dt : 0;
      if (stall.current > 0.6) { facing.current += 0.9 * (rnd() < 0.5 ? 1 : -1); stall.current = 0; }
      return true;
    };
    const struck = () => {
      hits.current += 1;
      hp.current -= WHIP.damage * mods(game).damage;
      sound.strike(); game.gainXp(4);
      const n = Math.max(dist, 0.01);
      shove.current = { x: (-dx / n) * 3.2, z: (-dz / n) * 3.2 };     // knocked back about a metre and a half
      if (hp.current <= 0) { mode.current = "fall"; timer.current = FALL; api.play("hit", { once: true, fade: 0.1 }); return; }
      mode.current = "hit"; timer.current = 0.9; api.play("hit", { once: true, fade: 0.08 });
    };
    const whipped = live.whipCrack && dist < WHIP.range;
    grabRest.current = Math.max(0, grabRest.current - dt);

    switch (mode.current) {
      case "grave":
        if (live.caught <= 0 && dist < WAKE) {
          mode.current = "rise"; timer.current = RISE; tilt.current = -HALF_PI; facing.current = 0;
          sound.growl();
          game.hint("amalanhig", "An amalanhig. It cannot bend: it turns slowly, so step aside and run. The whip (R) knocks it back, and three blows lay it down.");
        }
        break;
      case "rise": {
        // stiff as a plank, it swings up out of the ground about its heels
        const k = 1 - Math.max(0, timer.current) / RISE;
        tilt.current = -HALF_PI * (1 - k * k * (3 - 2 * k));
        api.play("idle", { fade: 0.3 });
        if (timer.current <= 0) { tilt.current = 0; mode.current = "hunt"; }
        break;
      }
      case "hunt": {
        if (whipped) { struck(); break; }
        if (live.caught > 0) { api.play("idle", { fade: 0.4 }); break; }
        if (dist > LOSE || Math.hypot(live.player.x - grave.x, live.player.z - grave.z) > LOSE) { mode.current = "return"; break; }
        const off = turnToward(dx, dz, TURN);
        // it only makes headway when it is roughly facing him; badly off, it mostly stands and turns
        const going = lurch(SPEED * Math.max(0.2, Math.cos(Math.min(off, Math.PI / 2))));
        api.move(going ? "walk" : "idle", going ? SPEED : 0, { fade: 0.3 });
        if (dist < REACH && off < 0.6 && grabRest.current <= 0) { mode.current = "grab"; timer.current = 1.0; api.play("grab", { once: true, fade: 0.1 }); sound.growl(); }
        break;
      }
      case "grab":
        if (whipped && timer.current > 0.35) { struck(); break; }
        turnToward(dx, dz, TURN * 2);
        // the arms close about two thirds of the way through
        if (timer.current <= 0.35 && timer.current + dt > 0.35 && dist < REACH * 1.5) {
          // its hands close on him: it hurts, and he tears himself loose a stride away
          hurt(GRAB_HARM);
          const n = Math.max(dist, 0.01);
          live.player.x += (dx / n) * 1.1; live.player.z += (dz / n) * 1.1;
          pushOut(live.player, 0.35);
          grabRest.current = GRAB_REST;
        }
        if (timer.current <= 0) mode.current = "hunt";
        break;
      case "hit":
      case "fall": {
        const k = Math.min(1, dt * 6);
        p.x += shove.current.x * k * 0.5; p.z += shove.current.z * k * 0.5;
        shove.current.x *= 1 - k; shove.current.z *= 1 - k;
        pushOut(p, 0.4);
        if (mode.current === "hit") { if (timer.current <= 0) mode.current = "hunt"; break; }
        // it goes over backwards like a felled tree, gathering speed
        const t = 1 - Math.max(0, timer.current) / FALL;
        tilt.current = -HALF_PI * t * t;
        if (timer.current <= 0) {
          tilt.current = -HALF_PI; mode.current = "down";
          sound.whoosh(); live.shake = Math.max(live.shake, 0.35);
          const got: string[] = [];
          const c = game.add("coins", 4 + Math.floor(rnd() * 6)); if (c) got.push(`${c} centavos`);
          const h = game.add("herbs", 1 + Math.floor(rnd() * 2)); if (h) got.push(`${h} herbs`);
          game.gainXp(35);
          game.toast(`The amalanhig lies still. In its grave clothes: ${got.length ? got.join(", ") : "nothing you can carry"}.`, "good");
          if (rnd() < 0.3) { game.addCharm(0.03); game.toast("And knotted in its hair, a charm.", "good"); }
        }
        break;
      }
      case "down":
        api.play("idle", { fade: 0.5 });
        break;
      case "return": {
        // it walks back to its grave and lies down again
        const gx = grave.x - p.x, gz = grave.z - p.z;
        if (dist < WAKE * 0.6) { mode.current = "hunt"; break; }
        if (Math.hypot(gx, gz) < 0.5) { mode.current = "sink"; timer.current = RISE; break; }
        turnToward(gx, gz, TURN * 1.5);
        lurch(SPEED * 0.7);
        api.move("walk", SPEED * 0.7, { fade: 0.3 });
        break;
      }
      case "sink": {
        const k = 1 - Math.max(0, timer.current) / RISE;
        tilt.current = -HALF_PI * k * k * (3 - 2 * k);
        api.play("idle", { fade: 0.3 });
        if (timer.current <= 0) { reset(); }
        break;
      }
    }

    // place it: tipped about its heels, sunk a little into the ground while it comes out of it or goes back in
    const standing = mode.current === "hunt" || mode.current === "grab" || mode.current === "hit" || mode.current === "return";
    const lying = -tilt.current / HALF_PI;
    const sunk = mode.current === "rise" || mode.current === "sink" ? -0.3 * lying : mode.current === "down" || mode.current === "fall" ? 0.1 * lying : 0;
    g.visible = mode.current !== "grave";
    g.position.set(p.x, sunk, p.z);
    g.rotation.order = "YXZ";
    g.rotation.set(tilt.current, facing.current, 0);
    solid.x = p.x; solid.z = p.z; solid.r = standing ? 0.35 : 0;
    me.mode = mode.current; me.x = p.x; me.z = p.z; me.hits = hits.current; me.hp = hp.current / HEALTH;
    bar.current?.set(p.x, 2.05, p.z, hp.current / HEALTH, standing && hp.current < HEALTH);
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
