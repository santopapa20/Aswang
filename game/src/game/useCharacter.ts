import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useAnimations, useGLTF } from "@react-three/drei";
import { assetUrl } from "./assetUrl";
import { live, useGame } from "./state";
import { AnimationAction, AnimationMixer, Box3, Group, LoopOnce, LoopRepeat, Mesh, Object3D, SkinnedMesh, Vector3 } from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

export type PlayOptions = { fade?: number; once?: boolean; speed?: number };

/** Footstep speeds measured so far, by model and clip: shared by every copy of a character, so the
 *  measurement (a copy of the skeleton stepped through the clip) is done once, not once per copy. */
const PACES = new Map<string, number>();

/**
 * Loads an animated character and gives back a `play(clip)` that cross-fades between its clips.
 * The clip names are the ones written by tools/blender/merge_mixamo.py (idle, walk, run, ...).
 */
export function useCharacter(url: string, shadows: boolean, holdsStill = true) {
  const group = useRef<Group>(null);
  const gltf = useGLTF(assetUrl(url));
  const model = useMemo(() => {
    const m = cloneSkinned(gltf.scene) as Object3D;
    // Culled like anything else, so a creature out of view costs nothing: three would measure a skinned
    // mesh's bounds once, in whatever pose it is in, so it is given its bind-pose sphere at twice the radius
    // instead, which holds every pose these clips reach (the clips stay in place; the game moves the group).
    m.traverse((o) => {
      const mesh = o as SkinnedMesh;
      if (!mesh.isMesh) return;
      if (!mesh.geometry.boundingSphere) mesh.geometry.computeBoundingSphere();
      const sphere = mesh.geometry.boundingSphere!.clone();
      sphere.radius *= 2;
      if (mesh.isSkinnedMesh) mesh.boundingSphere = sphere;
      mesh.frustumCulled = true;
    });
    m.userData.url = url;              // (for scripts/drawcount.mjs)
    return m;
  }, [gltf.scene]);

  useEffect(() => {
    model.traverse((o) => { if ((o as Mesh).isMesh) { o.castShadow = shadows; o.receiveShadow = false; } });
  }, [model, shadows]);

  const { actions, mixer } = useAnimations(gltf.animations, group);
  const current = useRef("");
  // while the game waits (a panel is open, or someone is speaking) everyone but the player holds still
  useFrame(() => { const g = useGame.getState(); mixer.timeScale = (holdsStill && (g.panel || g.dialogue) ? 0 : 1) * live.timeScale; });

  const api = useMemo(() => ({
    play(name: string, opts: PlayOptions = {}) {
      const next = actions[name] as AnimationAction | null | undefined;
      if (!next) return;
      if (current.current === name) { next.timeScale = opts.speed ?? 1; return; }
      const prev = actions[current.current] as AnimationAction | null | undefined;
      const fade = opts.fade ?? 0.25;
      next.reset();
      next.setLoop(opts.once ? LoopOnce : LoopRepeat, opts.once ? 1 : Infinity);
      next.clampWhenFinished = !!opts.once;
      next.timeScale = opts.speed ?? 1;
      next.fadeIn(fade).play();
      if (prev) prev.fadeOut(fade);
      current.current = name;
    },
    get clip() { return current.current; },
    /**
     * How fast the ground passes under a walking clip's feet, in metres a second at normal speed. Found by
     * playing the clip on a copy of the character and following each foot while it is down. 0 if the clip
     * has no feet to follow. Measured once per clip.
     */
    pace(name: string) {
      const key = `${url}|${name}`;
      if (PACES.has(key)) return PACES.get(key)!;
      const clip = gltf.animations.find((a) => a.name === name);
      let pace = 0;
      if (clip) {
        const rig = cloneSkinned(gltf.scene) as Object3D;
        const feet: Object3D[] = [];
        rig.traverse((o) => { if (/(left|right)foot$|(fore|hind)paw[lr]$/.test(o.name.replace(/[:_.]/g, "").toLowerCase())) feet.push(o); });
        if (feet.length) {
          const tall = new Box3().setFromObject(rig).getSize(new Vector3()).y;
          const m = new AnimationMixer(rig);
          m.clipAction(clip).play();
          const N = 80, dt = clip.duration / N;
          const track = feet.map(() => [] as Vector3[]);
          for (let i = 0; i <= N; i++) {
            m.setTime(i * dt); rig.updateMatrixWorld(true);
            feet.forEach((f, k) => track[k].push(f.getWorldPosition(new Vector3())));
          }
          let dist = 0, time = 0;
          for (const t of track) {
            const low = Math.min(...t.map((p) => p.y));
            for (let i = 1; i < t.length; i++) {
              if (t[i].y < low + tall * 0.012 && t[i - 1].y < low + tall * 0.012) { dist += Math.hypot(t[i].x - t[i - 1].x, t[i].z - t[i - 1].z); time += dt; }
            }
          }
          pace = time > 0 ? dist / time : 0;
          m.stopAllAction();
        }
      }
      PACES.set(key, pace);
      if (import.meta.env.DEV) console.debug(`pace ${url} ${name} ${pace.toFixed(2)} m/s`);
      return pace;
    },
    /** Plays a walking clip at the rate that matches moving at `speed` metres a second, so the feet do not slide. */
    move(name: string, speed: number, opts: PlayOptions = {}) {
      const pace = this.pace(name);
      const rate = pace > 0.05 ? Math.min(2.2, Math.max(0.45, speed / pace)) : 1;
      this.play(name, { ...opts, speed: rate });
    },
    time(name: string) { return actions[name]?.time ?? 0; },
    duration(name: string) { return actions[name]?.getClip().duration ?? 0; },
    reset() { mixer.stopAllAction(); current.current = ""; },
    /** Finds a bone by the end of its name, e.g. "RightHand" (Mixamo prefixes are ignored). */
    bone(part: string): Object3D | undefined {
      let found: Object3D | undefined;
      const want = part.toLowerCase();
      model.traverse((o) => {
        if (!found && o.name.replace(/[:_]/g, "").toLowerCase().endsWith(want)) found = o;
      });
      return found;
    },
  }), [actions, mixer, model, gltf, url]);

  // measure the walking clips' footstep speeds while the game is loading, a little apart, rather than the
  // first time each one is used, which stalled the game for a moment when a creature first broke into a run
  useEffect(() => {
    const names = gltf.animations.map((c) => c.name).filter((n) => /walk|run|sneak/i.test(n));
    const ids = names.map((n, i) => setTimeout(() => api.pace(n), 1200 + i * 250 + Math.random() * 600));
    return () => ids.forEach(clearTimeout);
  }, [api, gltf]);

  return { group, model, api };
}
