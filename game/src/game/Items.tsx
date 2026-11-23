import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group } from "three";
import { useGame } from "./state";
import { useProp } from "./useProp";

/**
 * Things lying around the barrio to pick up, and the salt lines the player has poured.
 * The salt bowl is still a simple stand-in shape; the garlic braid is the real model.
 */
export function Items() {
  const pickups = useGame((s) => s.pickups);
  const lines = useGame((s) => s.lines);
  const garlicModels = useProp("/models/garlic.glb", 0.55, "y", 8, false);
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
              <primitive object={garlicModels[p.id % garlicModels.length]} position={[0, -0.2, 0]} rotation-y={p.id} />
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
