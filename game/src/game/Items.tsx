import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group } from "three";
import { useGame } from "./state";

/**
 * Things lying around the barrio to pick up, and the salt lines the player has poured.
 * The pickups are simple stand-in shapes until the real salt bowl and garlic braid models are in.
 */
export function Items() {
  const pickups = useGame((s) => s.pickups);
  const lines = useGame((s) => s.lines);
  const bob = useRef<Group>(null);
  useFrame(({ clock }) => {
    if (bob.current) bob.current.position.y = 0.06 * Math.sin(clock.elapsedTime * 2.2);
  });

  return (
    <>
      <group ref={bob}>
        {pickups.map((p) => (
          <group key={p.id} position={[p.x, 0.32, p.z]}>
            {p.kind === "salt" ? (
              <>
                <mesh>
                  <cylinderGeometry args={[0.2, 0.13, 0.12, 14]} />
                  <meshStandardMaterial color="#6b4a2a" roughness={0.9} />
                </mesh>
                <mesh position={[0, 0.07, 0]}>
                  <sphereGeometry args={[0.17, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
                  <meshStandardMaterial color="#f4f1e8" emissive="#cfd8ff" emissiveIntensity={0.55} roughness={1} />
                </mesh>
              </>
            ) : (
              [[0, 0, 0], [0.09, -0.08, 0.03], [-0.08, -0.1, -0.02], [0.02, -0.19, 0.04]].map(([x, y, z], i) => (
                <mesh key={i} position={[x, y + 0.1, z]}>
                  <sphereGeometry args={[0.075, 10, 8]} />
                  <meshStandardMaterial color="#efe6cf" emissive="#fff0c0" emissiveIntensity={0.5} roughness={0.9} />
                </mesh>
              ))
            )}
          </group>
        ))}
      </group>

      {lines.map((l, i) => {
        const dx = l.bx - l.ax, dz = l.bz - l.az;
        return (
          <mesh key={i} position={[(l.ax + l.bx) / 2, 0.025, (l.az + l.bz) / 2]} rotation-y={-Math.atan2(dz, dx)}>
            <boxGeometry args={[Math.hypot(dx, dz), 0.03, 0.16]} />
            <meshStandardMaterial color="#f6f4ee" emissive="#dfe6ff" emissiveIntensity={0.7} roughness={1} />
          </mesh>
        );
      })}
    </>
  );
}
