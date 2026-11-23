import { useEffect, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh, MeshBasicMaterial, Vector3 } from "three";
import { live, LOWER_HALF, NIGHT_SECONDS, useGame } from "./state";
import { useCharacter } from "./useCharacter";
import { useProp } from "./useProp";

type Mode = "absent" | "patrol" | "shriek" | "dive" | "recover" | "ended";

const ARRIVES_AFTER = 25;     // seconds into the night before she takes off
const ALTITUDE = 5.2;         // metres she cruises at
const CRUISE = 4.2;           // metres per second
const DIVE_SPEED = 8.5;
const SIGHT = 12;             // metres (along the ground) at which she spots the lamp
const STRIKE = 1.15;          // metres from his chest at which a dive connects
const STEER = 1.7;            // how sharply she can correct a dive: running sideways beats it, walking does not

/**
 * The manananggal: a winged upper body that flies over fences and huts and dives at the player.
 * She cannot be stopped by a salt line. She is ended for the night by pouring salt on the lower
 * half she left standing somewhere in the barrio.
 */
export function Manananggal() {
  const shadows = useGame((s) => s.shadows);
  const runId = useGame((s) => s.runId);
  const { group, model, api } = useCharacter("/models/manananggal.glb", shadows);
  const blob = useRef<Mesh>(null);
  const pos = useRef(new Vector3(LOWER_HALF.x, ALTITUDE, LOWER_HALF.z));
  const dir = useRef(new Vector3(0, 0, 1));
  const facing = useRef(0);
  const mode = useRef<Mode>("absent");
  const timer = useRef(0);
  const goal = useRef(new Vector3());

  useEffect(() => {
    pos.current.set(LOWER_HALF.x, 1.2, LOWER_HALF.z);
    mode.current = "absent";
    timer.current = 0;
    api.reset();
    api.play("hover", { fade: 0 });
  }, [runId, api]);

  useFrame((_, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const g = group.current;
    if (!g) return;
    const game = useGame.getState();
    const p = pos.current;
    const flat = Math.hypot(live.player.x - p.x, live.player.z - p.z);
    timer.current -= dt;

    if (game.mana === "ended" && mode.current !== "ended") {
      mode.current = "ended"; timer.current = 4; game.setOverhead(false);
    }
    const flyTo = (tx: number, ty: number, tz: number, speed: number) => {
      const d = new Vector3(tx - p.x, ty - p.y, tz - p.z);
      const len = d.length();
      if (len > 1e-3) { d.multiplyScalar(1 / len); dir.current.lerp(d, Math.min(1, dt * 3)).normalize(); }
      p.addScaledVector(dir.current, Math.min(speed * dt, len));
      return len;
    };
    const newGoal = () => goal.current.set((Math.random() - 0.5) * 44, ALTITUDE, (Math.random() - 0.5) * 44);

    switch (mode.current) {
      case "absent":
        g.visible = false;
        if (game.phase === "playing" && live.timeLeft < NIGHT_SECONDS - ARRIVES_AFTER && game.mana === "absent") {
          g.visible = true;
          game.setMana("hunting");
          mode.current = "patrol"; newGoal(); timer.current = 5;
        }
        break;
      case "patrol":
        api.play("fly", { fade: 0.3 });
        if (flyTo(goal.current.x, ALTITUDE, goal.current.z, CRUISE) < 1.5) newGoal();
        if (game.phase === "playing" && timer.current <= 0 && flat < SIGHT) {
          mode.current = "shriek"; timer.current = api.duration("shriek") * 0.8; game.setOverhead(true);
        }
        break;
      case "shriek":
        api.play("shriek", { once: true, fade: 0.2 });
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
        if (game.phase === "playing" && reach < STRIKE) { game.setPhase("caught"); mode.current = "recover"; timer.current = 4; game.setOverhead(false); }
        else if (timer.current <= 0 || (p.y <= 1.0 && dir.current.dot(want) < 0.2)) { mode.current = "recover"; timer.current = 4; game.setOverhead(false); }
        break;
      }
      case "recover":
        // missed: climb away, then go back to circling
        api.play("fly", { fade: 0.3 });
        flyTo(p.x + dir.current.x * 6, ALTITUDE, p.z + dir.current.z * 6, CRUISE * 1.2);
        if (timer.current <= 0) { mode.current = "patrol"; newGoal(); timer.current = 4; }
        break;
      case "ended":
        // her body is salted: she screams and flees into the sky
        api.play("shriek", { once: true, fade: 0.15 });
        p.y += dt * (timer.current < 2.6 ? 7 : 0.5);
        if (timer.current <= 0) g.visible = false;
        break;
    }

    if (Math.hypot(dir.current.x, dir.current.z) > 0.05) {
      let diff = Math.atan2(dir.current.x, dir.current.z) - facing.current;
      diff = Math.atan2(Math.sin(diff), Math.cos(diff));
      facing.current += diff * Math.min(1, dt * 6);
    }
    g.position.set(p.x, p.y - 0.3, p.z);
    g.rotation.y = facing.current;

    // her shadow on the ground is the player's best warning: it sharpens as she comes down
    if (blob.current) {
      const low = 1 - Math.min(1, Math.max(0, (p.y - 1) / ALTITUDE));
      blob.current.visible = g.visible;
      blob.current.position.set(p.x, 0.03, p.z);
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

/** The hips and legs she left behind. Salt them (E, standing close) and she cannot rejoin her body. */
function LowerHalf() {
  const shadows = useGame((s) => s.shadows);
  const ended = useGame((s) => s.mana === "ended");
  const half = useProp("/models/lower_half.glb", 1.02, "y", 1, shadows)[0];
  const holder = useRef<Group>(null);
  useFrame((_, dt) => {
    if (!holder.current) return;
    // once salted, the legs topple over
    const want = ended ? Math.PI / 2 : 0;
    holder.current.rotation.x += (want - holder.current.rotation.x) * Math.min(1, dt * 3);
  });
  return (
    <group position={[LOWER_HALF.x, 0, LOWER_HALF.z]} rotation-y={0.8}>
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
