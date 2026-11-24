import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Color, Mesh, MeshStandardMaterial, Vector3 } from "three";
import { crossesLine, hurt, live, mods, rnd, useGame } from "./state";
import { KIN, KIN_AGAIN, KIN_AT_ONCE, KIN_FIRST, KIN_NIGHTS, KinKind, TROPHIES, WHIP } from "./data";
import { kinRoam, kinSolids, P2, pushOut } from "./layout";
import { useCharacter } from "./useCharacter";
import { HealthBar, HealthBarHandle } from "./HealthBar";
import { sound } from "./audio";

type Mode = "away" | "prowl" | "hunt" | "blocked" | "bite" | "back" | "hit" | "dying" | "dead";
const BITE = 0.7, BITE_AT = 0.4;     // the bite clip's length, and how far into it the jaws close

/**
 * One of the aswang's kin, roaming the fields at night: a dead dog (they run in pairs) or a crawler, a man
 * gone on all fours. They come out a while after dusk, wander between their haunts, and go for him if he
 * comes near, sooner if his lamp is lit. A bite takes some of his health; after one they draw off a moment
 * and come again. A line of salt stops them. The whip hurts them, but a crawler in the dark shrugs most of
 * it off: keep the lamp on it. Laid down, each leaves coins and a trophy, and counts towards Nong Kadyo's
 * work. How many come out each night is in data.ts (KIN_NIGHTS); models in assets/kin.
 */
export function Kin({ kind, index }: { kind: KinKind; index: number }) {
  const K = KIN[kind];
  const shadows = useGame((s) => s.shadows);
  const runId = useGame((s) => s.runId);
  const { group, model, api } = useCharacter(`/models/${kind}.glb`, shadows);
  const solid = kinSolids[kind][index];
  const pos = useRef(new Vector3());
  const facing = useRef(0);
  const tip = useRef(0);
  const mode = useRef<Mode>("away");
  const timer = useRef(0);
  const wait = useRef(0);
  const hp = useRef(K.health);
  const goal = useRef<P2>({ x: 0, z: 0 });
  const from = useRef<P2>({ x: 0, z: 0 });     // where it took up the chase: it will not be drawn far from there
  const shove = useRef({ x: 0, z: 0 });
  const stall = useRef(0);
  const detour = useRef({ t: 0, side: 1 });
  const bar = useRef<HealthBarHandle>(null);

  useEffect(() => { mode.current = "away"; wait.current = 0; solid.r = 0; api.reset(); api.play("idle", { fade: 0 }); }, [runId, api, solid]);
  // a faint grave-light in the skin, so the shape can be made out in the dark before the lamp finds it
  useEffect(() => {
    model.traverse((o) => {
      const m = (o as Mesh).material as MeshStandardMaterial | undefined;
      if (!(o as Mesh).isMesh || !m?.isMeshStandardMaterial) return;
      m.emissive = new Color("#a8b39a"); m.emissiveMap = m.map; m.emissiveIntensity = 0.22; m.needsUpdate = true;
    });
  }, [model]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const g = group.current;
    if (!g) return;
    const game = useGame.getState();
    const me = live.kin[kind][index];
    if (game.stage !== "night") {
      mode.current = "away"; wait.current = 0; solid.r = 0; g.visible = false; me.mode = "away";
      bar.current?.set(0, 0, 0, 1, false);
      return;
    }
    if (game.panel || game.dialogue) return;
    const p = pos.current;
    solid.r = 0;                                 // its own circle must not push it (set again below)
    const dx = live.player.x - p.x, dz = live.player.z - p.z;
    const dist = Math.hypot(dx, dz);
    const lit = game.lampOn && live.lampBlown <= 0 && game.bag.oil > 0;
    timer.current -= dt;

    const turnToward = (x: number, z: number, rate: number) => {
      let diff = Math.atan2(x, z) - facing.current;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      facing.current += Math.max(-rate * dt, Math.min(rate * dt, diff));
      return Math.abs(diff);
    };
    /** Goes forward the way it faces. False if a salt line is in the way. */
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
    /** Heads for a point, going round whatever it walked into. */
    const steer = (x: number, z: number, rate: number) => {
      detour.current.t = Math.max(0, detour.current.t - dt);
      if (detour.current.t <= 0) return turnToward(x, z, rate);
      const s = detour.current.side * 1.3, c = Math.cos(s), n = Math.sin(s);
      turnToward(x * c + z * n, -x * n + z * c, rate * 1.5);
      return 0;
    };
    const haunt = () => {
      const all = kinRoam[kind];
      if (kind === "dog" && index > 0) {
        // the second of a pair keeps by the first
        const lead = live.kin.dog[0];
        if (lead.mode !== "away" && lead.mode !== "dying" && lead.mode !== "dead") return { x: lead.x + Math.cos(index * 2.1) * 1.6, z: lead.z + Math.sin(index * 2.1) * 1.6 };
      }
      return all[Math.floor(rnd() * all.length)];
    };
    const die = () => {
      mode.current = "dying"; timer.current = 0.5;
      sound.whoosh();
      const coins = game.add("coins", K.coins[0] + Math.floor(rnd() * (K.coins[1] - K.coins[0] + 1)));
      game.set({ trophies: { ...game.trophies, [K.trophy]: game.trophies[K.trophy] + 1 } });
      game.gainXp(K.xp);
      game.toast(`The ${K.name} lies still.${coins ? ` ${coins} centavos,` : ""} and ${TROPHIES[K.trophy].name.toLowerCase()}.`, "good");
      game.laidDown(kind);
    };
    const struck = () => {
      const dark = K.unlit > 0 && !lit;
      if (dark) game.hint(`dark-${kind}`, "In the dark the whip slides off it. Keep your lamp lit (F) when you strike.");
      hp.current -= WHIP.damage * mods(game).damage * (dark ? 1 - K.unlit : 1);
      sound.strike(); game.gainXp(3);
      if (hp.current <= 0) { die(); return; }
      const n = Math.max(dist, 0.01);
      shove.current = { x: (-dx / n) * 2 * K.knockback, z: (-dz / n) * 2 * K.knockback };
      mode.current = "hit"; timer.current = K.stagger; api.play("hit", { once: true, fade: 0.08 });
    };
    const awake = mode.current === "prowl" || mode.current === "hunt" || mode.current === "blocked" || mode.current === "bite" || mode.current === "back";
    if (awake && live.whipCrack && dist < WHIP.range) struck();

    switch (mode.current) {
      case "away": {
        wait.current -= dt;
        const night = KIN_NIGHTS[game.night] ?? { dog: 0, crawler: 0 };
        if (index >= KIN_AT_ONCE[kind] || live.elapsed < KIN_FIRST || wait.current > 0 || live.kinOut[kind] >= night[kind]) break;
        let at: P2;
        if (kind === "dog" && index > 0) {
          const lead = live.kin.dog[0];
          if (lead.mode === "away" || lead.mode === "dead" || lead.mode === "dying") break;   // it comes out with the first
          at = { x: lead.x + 1.5, z: lead.z + 1.2 };
        } else {
          // out of sight of him: one of its haunts well away from where he is
          const far = kinRoam[kind].filter((r) => Math.hypot(r.x - live.player.x, r.z - live.player.z) > 20);
          at = far.length ? far[Math.floor(rnd() * far.length)] : kinRoam[kind][0];
        }
        live.kinOut[kind] += 1;
        p.set(at.x, 0, at.z); facing.current = rnd() * Math.PI * 2; tip.current = 0;
        hp.current = K.health; goal.current = haunt(); mode.current = "prowl";
        break;
      }
      case "prowl": {
        const gx = goal.current.x - p.x, gz = goal.current.z - p.z;
        if (Math.hypot(gx, gz) < 1.5) goal.current = haunt();
        steer(gx, gz, K.turn * 0.6);
        go(K.prowl);
        api.move("walk", K.prowl, { fade: 0.4 });
        if (live.caught <= 0 && dist < K.notice * (lit ? 1 : 0.6)) {
          mode.current = "hunt"; from.current = { x: p.x, z: p.z };
          if (kind === "dog") sound.growl(); else sound.shriek();
          game.hint(`kin-${kind}`, kind === "dog"
            ? "Dead dogs. Crack the whip (R) when one is close. They will not cross a line of salt (Q)."
            : "A crawler. Keep your lamp on it and crack the whip (R): in the dark the whip slides off.");
        }
        break;
      }
      case "hunt": {
        if (live.caught > 0 || dist > K.lose || Math.hypot(p.x - from.current.x, p.z - from.current.z) > K.leash) { mode.current = "prowl"; goal.current = { ...from.current }; break; }
        const off = steer(dx, dz, K.turn);
        if (!go(K.speed * Math.max(0.3, Math.cos(Math.min(off, Math.PI / 2))))) { mode.current = "blocked"; break; }
        api.move("run", K.speed, { fade: 0.25 });
        if (dist < K.reach && off < 0.7) { mode.current = "bite"; timer.current = BITE; api.play("bite", { once: true, fade: 0.08 }); }
        break;
      }
      case "blocked":
        // at a salt line: it paces and stares, and goes on as soon as the way to him is clear
        api.play("idle", { fade: 0.3 });
        turnToward(dx, dz, K.turn);
        if (!game.lines.some((l) => crossesLine(p.x, p.z, live.player.x, live.player.z, l))) mode.current = "hunt";
        else if (dist > K.lose) { mode.current = "prowl"; goal.current = haunt(); }
        break;
      case "bite":
        turnToward(dx, dz, K.turn);
        if (timer.current <= BITE - BITE_AT && timer.current + dt > BITE - BITE_AT && dist < K.reach * 1.6) hurt(K.harm);
        if (timer.current <= 0) { mode.current = "back"; timer.current = K.rest; }
        break;
      case "back": {
        // it draws off and circles, then comes again
        const n = Math.max(dist, 0.01), s = index % 2 ? 1 : -1;
        turnToward(-dx / n + (-dz / n) * s * 0.8, -dz / n + (dx / n) * s * 0.8, K.turn);
        go(K.prowl * 1.6);
        api.move("walk", K.prowl * 1.6, { fade: 0.3 });
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
        // over on its side
        tip.current = (Math.PI / 2) * Math.min(1, 1 - Math.max(0, timer.current) / 0.5);
        if (timer.current <= 0) { mode.current = "dead"; timer.current = 8; }
        break;
      case "dead":
        if (timer.current <= 0) { mode.current = "away"; wait.current = KIN_AGAIN; }
        break;
    }

    const standing = mode.current !== "away" && mode.current !== "dying" && mode.current !== "dead";
    g.visible = mode.current !== "away";
    g.position.set(p.x, mode.current === "dying" || mode.current === "dead" ? 0.05 : 0, p.z);
    g.rotation.set(0, facing.current, tip.current);
    solid.x = p.x; solid.z = p.z; solid.r = standing ? 0.3 : 0;
    me.mode = mode.current; me.x = p.x; me.z = p.z; me.hp = hp.current / K.health;
    bar.current?.set(p.x, K.bar, p.z, hp.current / K.health, standing && hp.current < K.health);
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
