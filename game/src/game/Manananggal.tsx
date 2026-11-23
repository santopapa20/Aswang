import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh, MeshBasicMaterial, Vector3 } from "three";
import { catchPlayer, live, rnd, useGame } from "./state";
import { hidingSpots, home, HUT } from "./layout";
import { ROSING_SAYS } from "./story";
import { useCharacter } from "./useCharacter";
import { useProp } from "./useProp";
import { sound } from "./audio";

type Mode = "absent" | "patrol" | "toRoof" | "perch" | "shriek" | "dive" | "recover" | "ended" | "gone";

const ALTITUDE = 6.2;         // metres she cruises at
const ROOF = HUT.height + 0.5;
const CRUISE = 4.4;           // metres per second
const DIVE_SPEED = 8.5;
const SIGHT = 12;             // metres (along the ground) at which she sees a lit lamp
const STRIKE = 1.15;          // metres from his chest at which a dive connects
const STEER = 1.7;            // how sharply she can correct a dive: running sideways beats it, walking does not

/**
 * The same woman, in the air. Barred at the door, she comes by the roof: she settles on the thatch and
 * works through it unless smoke keeps her off or he strikes the house post, which brings her down on
 * him instead. Away from the house she dives at his lamp. She is ended by salting the lower half she
 * left standing somewhere in the barrio.
 */
export function Manananggal() {
  const shadows = useGame((s) => s.shadows);
  const runId = useGame((s) => s.runId);
  const { group, model, api } = useCharacter("/models/manananggal.glb", shadows);
  const blob = useRef<Mesh>(null);
  const pos = useRef(new Vector3());
  const dir = useRef(new Vector3(0, 0, 1));
  const facing = useRef(0);
  const mode = useRef<Mode>("absent");
  const timer = useRef(0);
  const roofIn = useRef(30);
  const goal = useRef(new Vector3());
  const angry = useRef(false);        // driven off the roof by noise: her next move is to come down on him

  useEffect(() => {
    mode.current = "absent"; timer.current = 0; roofIn.current = 30; angry.current = false;
    api.reset();
    api.play("hover", { fade: 0 });
  }, [runId, api]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const g = group.current;
    if (!g) return;
    const game = useGame.getState();
    const airNight = game.stage === "night" && game.form === "air";
    if (!airNight) { mode.current = "absent"; g.visible = false; if (blob.current) blob.current.visible = false; return; }
    const p = pos.current;
    const night = game.night;
    const flat = Math.hypot(live.player.x - p.x, live.player.z - p.z);
    const lit = game.lampOn && live.lampBlown <= 0 && game.bag.oil > 0;
    const fromHome = Math.hypot(live.player.x - home.x, live.player.z - home.z);
    timer.current -= dt;

    if ((game.mana === "ended" || game.mana === "dead") && mode.current !== "ended" && mode.current !== "gone" && mode.current !== "absent") {
      mode.current = "ended"; timer.current = 4; live.breach = 0; live.breachAt = null; sound.shriek();
    }
    const flyTo = (tx: number, ty: number, tz: number, speed: number) => {
      const d = new Vector3(tx - p.x, ty - p.y, tz - p.z);
      const len = d.length();
      if (len > 1e-3) { d.multiplyScalar(1 / len); dir.current.lerp(d, Math.min(1, dt * 3)).normalize(); }
      p.addScaledVector(dir.current, Math.min(speed * dt, len));
      return len;
    };
    const newGoal = () => goal.current.set(home.x + (rnd() - 0.5) * 46, ALTITUDE, home.z + (rnd() - 0.5) * 40);
    const leaveRoof = (wait: number) => { game.set({ onRoof: false }); live.breach = 0; live.breachAt = null; roofIn.current = wait; };
    const nextRoof = () => (night === 2 ? 36 : night === 4 ? 30 : 24) + rnd() * 14;

    switch (mode.current) {
      case "absent":
        g.visible = false;
        if (live.elapsed > (night === 2 ? 26 : 16) && game.mana === "absent") {
          const s = hidingSpots[game.legsAt];
          p.set(s.x, 1.4, s.z);
          game.set({ mana: "hunting" });
          mode.current = "patrol"; newGoal(); timer.current = 6; roofIn.current = night === 2 ? 22 : 14;
          sound.wings();
        }
        break;
      case "patrol":
        api.play("fly", { fade: 0.3 });
        roofIn.current -= dt;
        if (flyTo(goal.current.x, ALTITUDE, goal.current.z, CRUISE) < 1.5) newGoal();
        // near the house she wants the roof, not him: she only dives at someone out in the open
        if (live.caught <= 0 && timer.current <= 0 && fromHome > 10 && ((lit && flat < SIGHT) || flat < 4)) {
          mode.current = "shriek"; timer.current = api.duration("shriek") * 0.8; game.set({ overhead: true }); sound.shriek();
        } else if (roofIn.current <= 0) mode.current = "toRoof";
        break;
      case "toRoof":
        api.play("fly", { fade: 0.3 });
        if (flyTo(home.x, ROOF + 0.3, home.z, CRUISE * 1.2) < 0.7) {
          if (live.smoke > 0) {
            game.say("Rosing", ROSING_SAYS.smoke); game.set({ tally: { ...game.tally, held: game.tally.held + 1 } }); game.gainXp(10);
            roofIn.current = nextRoof(); mode.current = "recover"; timer.current = 3; sound.wings();
          } else {
            mode.current = "perch"; live.breach = 0; live.breachAt = "door";
            game.set({ onRoof: true }); game.say("Rosing", ROSING_SAYS.roof); sound.knock();
            game.hint("roof", "She is on the roof. Feed the smudge fire, or strike the house post at the door and be ready to run.");
          }
        }
        break;
      case "perch":
        api.play("hover", { fade: 0.3 });
        live.breach += dt / (night === 2 ? 13 : 10);
        if (live.smoke > 0) {
          game.say("Rosing", ROSING_SAYS.smoke); game.gainXp(10); game.set({ tally: { ...game.tally, held: game.tally.held + 1 } });
          leaveRoof(nextRoof()); mode.current = "recover"; timer.current = 3; sound.wings();
        } else if (live.struck) {
          // she lifts off, swings wide, and comes back down on whoever made the noise
          sound.strike(); sound.wings(); game.gainXp(10);
          leaveRoof(nextRoof()); angry.current = true;
          dir.current.set(p.x - live.player.x, 0.4, p.z - live.player.z).normalize();
          mode.current = "recover"; timer.current = 2.3;
        } else if (live.breach >= 1) {
          sound.breach(); game.breach("It came through the roof.");
          leaveRoof(nextRoof() + 10); mode.current = "recover"; timer.current = 4;
        }
        break;
      case "shriek":
        api.play("shriek", { once: true, fade: 0.2 });
        if (p.y < ALTITUDE - 0.5) p.y += dt * 2.5;
        dir.current.lerp(new Vector3(live.player.x - p.x, 0, live.player.z - p.z).normalize(), Math.min(1, dt * 4)).normalize();
        if (timer.current <= 0) { mode.current = "dive"; timer.current = 3.2; }
        break;
      case "dive": {
        api.play("dive", { once: true, fade: 0.2 });
        const want = new Vector3(live.player.x - p.x, 1.15 - p.y, live.player.z - p.z);
        const reach = want.length();
        want.normalize();
        dir.current.lerp(want, Math.min(1, dt * STEER)).normalize();
        p.addScaledVector(dir.current, DIVE_SPEED * dt);
        if (p.y < 0.9) p.y = 0.9;
        if (live.caught <= 0 && reach < STRIKE) { catchPlayer(); mode.current = "recover"; timer.current = 4; game.set({ overhead: false }); }
        else if (timer.current <= 0 || (p.y <= 1.0 && dir.current.dot(want) < 0.2)) { mode.current = "recover"; timer.current = 4; game.set({ overhead: false }); game.gainXp(6); }
        break;
      }
      case "recover":
        // missed, or turned away: climb, then go back to circling
        api.play("fly", { fade: 0.3 });
        flyTo(p.x + dir.current.x * 6, ALTITUDE, p.z + dir.current.z * 6, CRUISE * 1.2);
        if (timer.current <= 0 && angry.current && live.caught <= 0) {
          angry.current = false;
          mode.current = "shriek"; timer.current = api.duration("shriek") * 0.7; game.set({ overhead: true }); sound.shriek();
        } else if (timer.current <= 0) { mode.current = "patrol"; newGoal(); timer.current = 5; }
        break;
      case "ended":
        // her body is salted: she screams and flees into the sky
        api.play("shriek", { once: true, fade: 0.15 });
        p.y += dt * (timer.current < 2.6 ? 7 : 0.5);
        if (timer.current <= 0) mode.current = "gone";
        break;
      case "gone":
        break;
    }

    const shown = mode.current !== "absent" && mode.current !== "gone";
    if (shown) { live.aswang.x = p.x; live.aswang.z = p.z; live.aswang.near = flat; }
    live.aswang.active = shown && mode.current !== "ended";
    if (Math.hypot(dir.current.x, dir.current.z) > 0.05) {
      let diff = Math.atan2(dir.current.x, dir.current.z) - facing.current;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      facing.current += diff * Math.min(1, dt * 6);
    }
    g.visible = shown;
    g.position.set(p.x, p.y - 0.3, p.z);
    g.rotation.y = facing.current;

    // her shadow on the ground is the best warning: it sharpens as she comes down
    if (blob.current) {
      const low = 1 - Math.min(1, Math.max(0, (p.y - 1) / ALTITUDE));
      blob.current.visible = shown;
      blob.current.position.set(p.x, 0.04, p.z);
      blob.current.scale.setScalar(1.6 - 0.7 * low);
      (blob.current.material as MeshBasicMaterial).opacity = 0.18 + 0.4 * low;
    }
  });

  return (
    <>
      <group ref={group} visible={false}>
        <primitive object={model} />
      </group>
      <mesh ref={blob} rotation-x={-Math.PI / 2} visible={false}>
        <circleGeometry args={[0.7, 24]} />
        <meshBasicMaterial color="#000" transparent opacity={0.2} depthWrite={false} />
      </mesh>
      <LowerHalf />
    </>
  );
}

/** The hips and legs she left behind. Salt them (standing close) and she cannot rejoin her body. */
function LowerHalf() {
  const shadows = useGame((s) => s.shadows);
  const shown = useGame((s) => s.stage === "night" && s.form === "air" && s.mana !== "absent");
  const ended = useGame((s) => s.mana === "ended" || s.mana === "dead");
  const spot = useGame((s) => hidingSpots[s.legsAt]);
  const half = useProp("/models/lower_half.glb", 1.02, "y", 1, shadows)[0];
  const holder = useRef<Group>(null);
  useFrame((_, dt) => {
    if (!holder.current) return;
    const want = ended ? Math.PI / 2 : 0;       // once salted, the legs topple over
    holder.current.rotation.x += (want - holder.current.rotation.x) * Math.min(1, dt * 3);
  });
  if (!shown) return null;
  return (
    <group position={[spot.x, 0, spot.z]} rotation-y={0.8}>
      <group ref={holder}>
        <primitive object={half} />
      </group>
      {ended && (
        <mesh position={[0, 0.03, 0]} rotation-x={-Math.PI / 2}>
          <circleGeometry args={[0.5, 20]} />
          <meshStandardMaterial color="#d9d5ca" emissive="#dfe6ff" emissiveIntensity={0.18} roughness={1} transparent opacity={0.85} />
        </mesh>
      )}
    </group>
  );
}
