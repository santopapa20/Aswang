import { useEffect, useMemo, useRef } from "react";
import { useAnimations, useGLTF } from "@react-three/drei";
import { AnimationAction, Group, LoopOnce, LoopRepeat, Mesh, Object3D } from "three";
import { clone as cloneSkinned } from "three/examples/jsm/utils/SkeletonUtils.js";

export type PlayOptions = { fade?: number; once?: boolean; speed?: number };

/**
 * Loads an animated character and gives back a `play(clip)` that cross-fades between its clips.
 * The clip names are the ones written by tools/blender/merge_mixamo.py (idle, walk, run, ...).
 */
export function useCharacter(url: string, shadows: boolean) {
  const group = useRef<Group>(null);
  const gltf = useGLTF(url);
  const model = useMemo(() => {
    const m = cloneSkinned(gltf.scene) as Object3D;
    // the bind-pose bounds are wrong once the character moves, so never cull it
    m.traverse((o) => { if ((o as Mesh).isMesh) o.frustumCulled = false; });
    return m;
  }, [gltf.scene]);

  useEffect(() => {
    model.traverse((o) => { if ((o as Mesh).isMesh) { o.castShadow = shadows; o.receiveShadow = false; } });
  }, [model, shadows]);

  const { actions, mixer } = useAnimations(gltf.animations, group);
  const current = useRef("");

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
  }), [actions, mixer, model]);

  return { group, model, api };
}
