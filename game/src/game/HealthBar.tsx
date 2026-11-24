import { forwardRef, useImperativeHandle, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh, MeshBasicMaterial, PlaneGeometry } from "three";

export type HealthBarHandle = { set: (x: number, y: number, z: number, share: number, show: boolean) => void };
const W = 0.9, H = 0.07;

/**
 * A thin bar that floats over a creature once it has been hurt, always turned to face the camera.
 * The owner moves it each frame with `set(x, y, z, share, show)`; `share` is what it has left, 0 to 1.
 */
export const HealthBar = forwardRef<HealthBarHandle>(function HealthBar(_, ref) {
  const group = useRef<Group>(null);
  const fill = useRef<Mesh>(null);
  const geo = useMemo(() => new PlaneGeometry(1, 1), []);
  const mats = useMemo(() => ({
    // drawn last and over everything (grass included), and not dimmed by the night's fog
    back: new MeshBasicMaterial({ color: "#120806", transparent: true, opacity: 0.8, depthTest: false, depthWrite: false, fog: false, toneMapped: false }),
    fill: new MeshBasicMaterial({ color: "#e8452c", transparent: true, depthTest: false, depthWrite: false, fog: false, toneMapped: false }),
  }), []);
  useImperativeHandle(ref, () => ({
    set(x, y, z, share, show) {
      const g = group.current, f = fill.current;
      if (!g || !f) return;
      g.visible = show;
      if (!show) return;
      g.position.set(x, y, z);
      const s = Math.max(0, Math.min(1, share));
      f.scale.set(W * s, H * 0.7, 1);
      f.position.x = -W * (1 - s) / 2;
    },
  }), []);
  useFrame(({ camera }) => { if (group.current?.visible) group.current.quaternion.copy(camera.quaternion); });
  return (
    <group ref={group} visible={false} renderOrder={20}>
      <mesh geometry={geo} material={mats.back} scale={[W + 0.04, H + 0.04, 1]} renderOrder={20} />
      <mesh ref={fill} geometry={geo} material={mats.fill} position-z={0.001} renderOrder={21} />
    </group>
  );
});
