/**
 * Help that lives in the 3D view: where the current objective is on screen (read by the interface to
 * draw its arrow), and soft rings on the ground under the things the player can use.
 */
import { useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh, MeshBasicMaterial, Vector3 } from "three";
import { live, useGame } from "./state";
import { objective } from "./objective";

const RINGS = 10;
const v = new Vector3();

export function Guide() {
  const rings = useRef<Group>(null);
  const slots = useMemo(() => Array.from({ length: RINGS }, (_, i) => i), []);

  useFrame(({ camera, clock, size }) => {
    const game = useGame.getState();
    const o = objective(game);
    live.objective = o;
    const g = live.guide;
    g.show = !!o.target && (game.stage === "day" || game.stage === "night") && !game.dialogue && !game.panel;
    if (o.target) {
      const dist = Math.hypot(o.target.x - live.player.x, o.target.z - live.player.z);
      v.set(o.target.x, 0.6, o.target.z).project(camera);
      let nx = v.x, ny = v.y;
      if (v.z > 1) { nx = -nx; ny = -ny; }                    // behind the camera: point the other way
      const on = v.z <= 1 && Math.abs(nx) < 0.84 && ny > -0.6 && ny < 0.5;
      if (!on) {                                              // slide it to the edge of the screen, clear of the cards along the top and bottom
        const k = 1 / Math.max(Math.abs(nx) / 0.88, Math.abs(ny) / (ny > 0 ? 0.5 : 0.6), 1e-3);
        nx *= k; ny *= k;
      }
      g.x = (nx * 0.5 + 0.5) * 100; g.y = (-ny * 0.5 + 0.5) * 100;
      g.angle = Math.atan2(-v.y * (v.z > 1 ? -1 : 1), v.x * (v.z > 1 ? -1 : 1) * (size.width / size.height));
      g.on = on; g.dist = dist; g.urgent = o.urgent;
      if (dist < 2.2) g.show = false;                         // he is there: the prompt takes over
    }

    // rings under what can be used nearby; the one in reach is brighter
    const t = clock.elapsedTime;
    const list = live.near;
    rings.current?.children.forEach((c, i) => {
      const it = list[i];
      c.visible = !!it;
      if (!it) return;
      c.position.set(it.x, 0.04, it.z);
      const pulse = 0.5 + 0.5 * Math.sin(t * 3.2 + i);
      c.scale.setScalar(it.r * (0.94 + 0.06 * pulse));
      const m = (c as Mesh).material as MeshBasicMaterial;
      m.opacity = (it.focus ? 0.34 : 0.1) + 0.08 * pulse;
      m.color.set(it.button === "G" ? "#cfd8ff" : "#ffc46b");
    });
  });

  return (
    <group ref={rings}>
      {slots.map((i) => (
        <mesh key={i} rotation-x={-Math.PI / 2} visible={false} renderOrder={3}>
          <ringGeometry args={[0.94, 1, 48]} />
          <meshBasicMaterial color="#ffc46b" transparent opacity={0.2} depthWrite={false} fog={false} />
        </mesh>
      ))}
    </group>
  );
}
