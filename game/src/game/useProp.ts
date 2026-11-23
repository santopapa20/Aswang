import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { Box3, Mesh, Object3D, Vector3 } from "three";

/**
 * Loads a prop and returns `count` copies of it, each resized so that `size` metres fits along
 * `axis`, centred on X and Z and standing on the ground (its lowest point at y = 0).
 */
export function useProp(url: string, size: number, axis: "x" | "y", count: number, shadows: boolean) {
  const gltf = useGLTF(url);
  return useMemo(() => {
    const box = new Box3().setFromObject(gltf.scene);
    const dim = box.getSize(new Vector3());
    const centre = box.getCenter(new Vector3());
    const scale = size / (axis === "x" ? dim.x : dim.y);
    return Array.from({ length: count }, () => {
      const copy = gltf.scene.clone(true);
      copy.traverse((o) => { if ((o as Mesh).isMesh) { o.castShadow = shadows; o.receiveShadow = shadows; } });
      copy.position.set(-centre.x * scale, -box.min.y * scale, -centre.z * scale);
      copy.scale.setScalar(scale);
      const holder = new Object3D();
      holder.add(copy);
      return holder;
    });
  }, [gltf.scene, size, axis, count, shadows]);
}
