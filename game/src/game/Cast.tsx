/** The barrio's other residents: the kapre in the balete's roots, and Nang Pacing by day; and the director that runs the clock. */
import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh, MeshBasicMaterial, PointLight, Vector3 } from "three";
import { live, useGame } from "./state";
import { balete, doorOf, hidingSpots, home, house, kapreSpot, P2, pushOut, well } from "./layout";
import { useCharacter } from "./useCharacter";
import { sound } from "./audio";

const mouth = new Vector3();

/**
 * The kapre has stood in the balete's roots for a hundred years, three metres of him, smoking. He is
 * only there after dark. He is nobody's enemy: run under his tree and he roars and blows out the lamp;
 * leave him tobacco and, on the last night, the ember of his cigar drifts to where the legs are hidden.
 */
export function Kapre() {
  const shadows = useGame((s) => s.shadows);
  const runId = useGame((s) => s.runId);
  const { group, model, api } = useCharacter("/models/kapre.glb", shadows);
  const blob = useRef<Group>(null);
  const cigar = useRef<Group>(null);
  const ember = useRef<Mesh>(null);
  const halo = useRef<Mesh>(null);
  const glow = useRef<PointLight>(null);
  const guide = useRef<Group>(null);
  const cool = useRef(0);
  const roaring = useRef(0);
  const told = useRef(false);
  const facing = useRef(0.9);
  useEffect(() => {
    cool.current = 0; roaring.current = 0; told.current = false; facing.current = 0.9;
    api.reset();
    api.play("idle", { fade: 0 });
  }, [runId, api]);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const g = group.current;
    if (!g) return;
    const game = useGame.getState();
    const night = game.stage === "night";
    const t = clock.elapsedTime;
    g.visible = night;
    if (blob.current) blob.current.visible = night;
    if (cigar.current) cigar.current.visible = night;

    const dx = live.player.x - kapreSpot.x, dz = live.player.z - kapreSpot.z;
    const d = Math.hypot(live.player.x - balete.x, live.player.z - balete.z);
    cool.current -= dt; roaring.current -= dt;
    if (night && d < balete.yard) {
      game.hint("kapre", "The air under the balete smells of tobacco. Something very large is standing in the roots. Walk. Do not run here.");
      const running = live.playerNoise > 12;
      if (running && game.kapre !== "friend" && cool.current <= 0 && live.lampBlown <= 0) {
        cool.current = 45; live.lampBlown = 22; live.shake = 0.8;
        roaring.current = api.duration("roar") * 0.75;
        game.set({ kapre: "angry" });
        sound.roar(); sound.whoosh();
        game.toast("The giant in the roots bends down, roars, and blows. Your lamp is out.", "bad");
      }
    }
    if (night) {
      if (roaring.current > 0) api.play("roar", { once: true, fade: 0.2 });
      else api.play("idle", { fade: 0.6, speed: 0.6 });
      // he turns, slowly, to keep whoever is near in front of him
      if (Math.hypot(dx, dz) < 14) {
        let diff = Math.atan2(dx, dz) - facing.current;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        facing.current += diff * Math.min(1, dt * 0.8);
      }
      g.position.set(kapreSpot.x, 0, kapreSpot.z);
      g.rotation.y = facing.current;

      // the cigar: an ember in front of his mouth that brightens every few seconds as he draws on it
      const head = api.bone("Head");
      if (head && cigar.current) {
        head.getWorldPosition(mouth);
        cigar.current.position.set(mouth.x + Math.sin(facing.current) * 0.42, mouth.y + 0.12, mouth.z + Math.cos(facing.current) * 0.42);
      }
      const draw = Math.max(0, Math.sin(t * 0.9)) ** 6;
      if (ember.current) { (ember.current.material as MeshBasicMaterial).color.setRGB(1, 0.18 + 0.4 * draw, 0.05); ember.current.scale.setScalar(0.8 + 0.7 * draw); }
      if (halo.current) (halo.current.material as MeshBasicMaterial).opacity = 0.1 + 0.3 * draw;
      if (glow.current) glow.current.intensity = 1.2 + 5 * draw;
    }

    // on the last night, a friend's ember drifts to where she hid her legs
    const guiding = night && game.night === 5 && game.kapre === "friend" && game.mana === "hunting";
    if (guide.current) {
      guide.current.visible = guiding;
      if (guiding) {
        const s = hidingSpots[game.legsAt];
        guide.current.position.set(s.x + Math.sin(t * 0.7) * 0.5, 2.3 + Math.sin(t * 1.3) * 0.3, s.z + Math.cos(t * 0.5) * 0.5);
        if (!told.current) { told.current = true; game.toast("A red ember drifts away from the balete and out over the barrio. Follow it.", "good"); }
      }
    }
  });

  return (
    <>
      <group ref={group} visible={false}>
        <primitive object={model} />
      </group>
      <group ref={blob} visible={false} position={[kapreSpot.x, 0.02, kapreSpot.z]}>
        <mesh rotation-x={-Math.PI / 2}>
          <circleGeometry args={[1.1, 24]} />
          <meshBasicMaterial color="#000" transparent opacity={0.4} depthWrite={false} />
        </mesh>
      </group>
      <group ref={cigar} visible={false}>
        <mesh ref={ember}><sphereGeometry args={[0.06, 10, 8]} /><meshBasicMaterial color="#ff4a12" fog={false} /></mesh>
        <mesh ref={halo}><sphereGeometry args={[0.34, 12, 10]} /><meshBasicMaterial color="#ff3a0a" transparent opacity={0.15} depthWrite={false} fog={false} /></mesh>
        <pointLight ref={glow} color="#ff5a2a" intensity={1.5} distance={5.5} decay={1.7} />
      </group>
      <group ref={guide} visible={false}>
        <mesh><sphereGeometry args={[0.09, 10, 8]} /><meshBasicMaterial color="#ff5a1a" fog={false} /></mesh>
        <mesh><sphereGeometry args={[0.5, 12, 10]} /><meshBasicMaterial color="#ff3a0a" transparent opacity={0.22} depthWrite={false} fog={false} /></mesh>
        <pointLight color="#ff5a2a" intensity={5} distance={7} decay={1.8} />
      </group>
    </>
  );
}

const PACING_HOME = doorOf(house("pacing"));
const ROUND: P2[] = [
  { x: home.x + 2.6, z: home.z + 5.6 }, { x: well.x - 2.2, z: well.z + 1.6 }, { x: PACING_HOME.x + 1, z: PACING_HOME.z + 1.2 }, { x: well.x + 1.8, z: well.z - 2 },
];

/** Nang Pacing by day: the kind neighbour, going between her house, the well and your yard. */
export function Pacing() {
  const shadows = useGame((s) => s.shadows);
  const runId = useGame((s) => s.runId);
  const { group, model, api } = useCharacter("/models/aswang_human.glb", shadows);
  const blob = useRef<Group>(null);
  const pos = useRef(new Vector3());
  const facing = useRef(0);
  const at = useRef(0);
  const wait = useRef(0);

  useEffect(() => {
    const g = useGame.getState();
    at.current = g.night === 1 ? 1 : 0;                       // the first afternoon she is at the well; later she starts at your door
    pos.current.set(ROUND[at.current].x, 0, ROUND[at.current].z);
    wait.current = g.night === 1 ? 60 : 14;
    api.reset();
    api.play("idle", { fade: 0 });
  }, [runId, api]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const g = group.current;
    if (!g) return;
    const game = useGame.getState();
    const here = game.stage === "day";
    live.pacing.here = here;
    g.visible = here; if (blob.current) blob.current.visible = here;
    if (!here) return;
    const p = pos.current;
    const dx = live.player.x - p.x, dz = live.player.z - p.z;
    const talking = !!game.dialogue || Math.hypot(dx, dz) < 2.2;
    let face = facing.current;
    if (talking) { api.play("idle", { fade: 0.4 }); face = Math.atan2(dx, dz); }
    else if (wait.current > 0) { wait.current -= dt; api.play(wait.current % 9 > 5 ? "look" : "idle", { fade: 0.5 }); }
    else {
      const to = ROUND[at.current];
      const ex = to.x - p.x, ez = to.z - p.z, d = Math.hypot(ex, ez);
      if (d < 0.4) { at.current = (at.current + 1) % ROUND.length; wait.current = 8 + (at.current * 3) % 7; }
      else { p.x += (ex / d) * 0.95 * dt; p.z += (ez / d) * 0.95 * dt; pushOut(p, 0.4); face = Math.atan2(ex, ez); api.play("walk", { fade: 0.4 }); }
    }
    let diff = face - facing.current;
    diff = Math.atan2(Math.sin(diff), Math.cos(diff));
    facing.current += diff * Math.min(1, dt * 5);
    live.pacing.x = p.x; live.pacing.z = p.z;
    g.position.copy(p);
    g.rotation.y = facing.current;
    blob.current?.position.set(p.x, 0.02, p.z);
  });

  return (
    <>
      <group ref={group} visible={false}>
        <primitive object={model} />
      </group>
      <group ref={blob} visible={false}>
        <mesh rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.42, 20]} />
          <meshBasicMaterial color="#000" transparent opacity={0.3} depthWrite={false} />
        </mesh>
      </group>
    </>
  );
}

/** Runs the clock: day into night into cockcrow, what Rosing says and asks for, and what is heard. */
export function Director() {
  const said = useRef<Set<string>>(new Set());
  const runId = useGame((s) => s.runId);
  useEffect(() => { said.current = new Set(); }, [runId]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const game = useGame.getState();
    const night = game.stage === "night", day = game.stage === "day";
    const once = (key: string, fn: () => void) => { if (!said.current.has(key)) { said.current.add(key); fn(); } };

    if ((day || night) && !game.dialogue && game.panel !== "pause") {
      if (live.caught > 0) {
        live.caught -= dt;
        if (live.caught <= 0) { live.caught = 0; game.endNight("caught"); }
      } else {
        live.clock = Math.max(0, live.clock - dt);
        live.elapsed += dt;
        live.smoke = Math.max(0, live.smoke - dt);
      }
      if (day) {
        if (live.clock < 26) once("dusk", () => game.toast("The light is going. Be home before dark."));
        if (live.clock <= 0) game.startNight();
      }
      if (night && live.caught <= 0) {
        const plan = NIGHTS[game.night - 1];
        for (const line of ROSING_NIGHT[game.night] ?? []) {
          if (live.elapsed >= line.at) once(`r${line.at}`, () => {
            if (game.night === 3 && game.trusted && line.at < 10) game.say("Nang Pacing", "Go on, Dong. I am here. She will be quite safe with me.");
            else game.say("Rosing", line.text);
          });
        }
        if (live.elapsed >= plan.errandAt) once("errand", () => { game.say("Rosing", ROSING_ERRAND[plan.errand]); game.setErrand(plan.errand); });
        if (game.night === 1 && live.elapsed > 16) once("tik", () => game.hint("tiktik", "Listen. The clicking is LOUD when she is far, and FAINT when she is near."));
        if (game.night === 2 && live.elapsed > 12) once("fire", () => game.hint("fire", "Tonight she will try the roof. Keep the smudge fire in the yard fed with kindling."));
        if (live.clock <= 0) { sound.rooster(); game.endNight("dawn"); }
      }
    }

    // how light it is: full day, a dusk that falls over the last stretch of the day, night, and a grey dawn
    const want = day ? Math.min(1, 0.12 + live.clock / 30) : night ? (live.clock < 28 ? 0.42 * (1 - live.clock / 28) : 0) : game.stage === "title" ? 0.16 : 0.45;
    live.daylight += (want - live.daylight) * Math.min(1, dt * 1.2);
    live.shake = Math.max(0, live.shake - dt * 1.4);

    const hearing = night && live.aswang.active && live.caught <= 0;
    sound.update(dt, {
      dark: 1 - live.daylight,
      tiktik: hearing ? live.aswang.near : null,
      scratch: night && live.breach > 0,
      fear: hearing ? Math.max(0, 1 - live.aswang.near / 9) : 0,
      smoke: live.smoke > 0,
      muted: game.muted || game.stage === "title",
    });
    live.whipCrack = false; live.struck = false;
  });
  return null;
}

import { NIGHTS, ROSING_ERRAND, ROSING_NIGHT } from "./story";
