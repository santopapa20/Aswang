import { useMemo } from "react";
import { useGLTF } from "@react-three/drei";
import { assetUrl } from "./assetUrl";
import { Box3, Material, Mesh, MeshLambertMaterial, MeshStandardMaterial, Object3D, Vector3 } from "three";

/** Models big enough on screen for the fine relief in their surface to show. The rest do without it. */
const KEEP_RELIEF = ["/models/hut.glb", "/models/balete.glb", "/models/well.glb"];
const lighter = new WeakMap<Material, MeshLambertMaterial>();
/**
 * The models arrive with physically based materials: fine for a studio render, heavy for an office
 * laptop, and slow for its graphics chip to build. Thatch, wood, earth and leaves are all matt, so a
 * simple matt material looks the same here, loads in a fraction of the time and draws faster.
 */
function matt(source: Material, relief: boolean) {
  let m = lighter.get(source);
  if (!m) {
    const s = source as MeshStandardMaterial;
    m = new MeshLambertMaterial({ name: s.name, map: s.map, color: s.color, normalMap: relief ? s.normalMap : null, side: s.side, transparent: s.transparent, opacity: s.opacity, alphaTest: s.alphaTest });
    if (relief && s.normalMap) m.normalScale.copy(s.normalScale);
    lighter.set(source, m);
  }
  return m;
}

/**
 * Loads a prop and returns `count` copies of it, each resized so that `size` metres fits along
 * `axis`, centred on X and Z and standing on the ground (its lowest point at y = 0).
 */
export function useProp(url: string, size: number, axis: "x" | "y", count: number, shadows: boolean) {
  const gltf = useGLTF(assetUrl(url));
  return useMemo(() => {
    const box = new Box3().setFromObject(gltf.scene);
    const dim = box.getSize(new Vector3());
    const centre = box.getCenter(new Vector3());
    const scale = size / (axis === "x" ? dim.x : dim.y);
    const relief = KEEP_RELIEF.includes(url);
    return Array.from({ length: count }, () => {
      const copy = gltf.scene.clone(true);
      copy.userData.url = url;
      copy.traverse((o) => {
        const mesh = o as Mesh;
        if (!mesh.isMesh) return;
        mesh.castShadow = shadows; mesh.receiveShadow = shadows;
        if (!Array.isArray(mesh.material) && (mesh.material as MeshStandardMaterial).isMeshStandardMaterial) mesh.material = matt(mesh.material, relief);
      });
      copy.position.set(-centre.x * scale, -box.min.y * scale, -centre.z * scale);
      copy.scale.setScalar(scale);
      const holder = new Object3D();
      holder.add(copy);
      return holder;
    });
  }, [gltf.scene, url, size, axis, count, shadows]);
}
