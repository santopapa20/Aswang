import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { AdditiveBlending, Mesh, MeshBasicMaterial, Object3D, Quaternion, Sprite, SpriteMaterial, Vector3 } from "three";
import { live, useGame } from "./state";
import { kadyoSpot } from "./layout";
import { useCharacter } from "./useCharacter";
import { glowTexture } from "./Atmosphere";

const LOOK_RANGE = 9;           // metres within which he follows you with his eyes
const LOOK_LIMIT = 1.05;        // radians either side he will turn his head before he turns no further
const up = new Vector3(0, 1, 0), at = new Vector3(), dir = new Vector3(), axis = new Vector3(), q = new Quaternion(), pq = new Quaternion();

/**
 * Nong Kadyo, the albularyo, standing at the foot of his ladder day and night with his stick and his lamp.
 * He keeps still, breathing, and turns his head to watch whoever comes near; when he speaks (a conversation,
 * the trade, a word at the door) he leans in and nods. After dark his lamp glows and throws a little light
 * on the ground. Model and motions: assets/kadyo (tools/blender/rig_humanoid.py and anim_kadyo.py).
 */
export function Kadyo() {
  const shadows = useGame((s) => s.shadows);
  // he keeps talking while a conversation or the trade has the rest of the world waiting
  const { group, model, api } = useCharacter("/models/kadyo.glb", shadows, false);
  const turn = useRef(0);
  const talkFor = useRef(0);
  const lastCaption = useRef(0);
  const glow = useMemo(() => new Sprite(new SpriteMaterial({ map: glowTexture(), color: "#ffb15c", transparent: true, depthWrite: false, blending: AdditiveBlending, opacity: 0 })), []);
  const pool = useRef<Mesh>(null);
  const bones = useMemo(() => ({ neck: api.bone("Neck"), head: api.bone("Head"), hand: api.bone("LeftHand") }), [api]);

  useEffect(() => { api.reset(); api.play("idle", { fade: 0 }); }, [api]);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const g = group.current;
    if (!g) return;
    const game = useGame.getState();
    // is he speaking? in a conversation with him, at his trade, or a word said at his door just now
    const line = game.dialogue?.lines[game.dialogue.index];
    if (game.caption?.who === "Nong Kadyo" && game.caption.id !== lastCaption.current) { lastCaption.current = game.caption.id; talkFor.current = 4.5; }
    talkFor.current = Math.max(0, talkFor.current - dt);
    const speaking = line?.who === "Nong Kadyo" || game.panel === "trade" || talkFor.current > 0;
    api.play(speaking ? "talk" : "idle", { fade: 0.6 });

    // his head follows you (on top of whatever the motion is doing), within the reach of an old neck
    g.updateMatrixWorld();
    const dx = live.player.x - kadyoSpot.x, dz = live.player.z - kadyoSpot.z;
    const near = Math.hypot(dx, dz) < LOOK_RANGE && (game.stage === "day" || game.stage === "night");
    let want = 0;
    if (near) {
      let a = Math.atan2(dx, dz) - g.rotation.y;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      want = Math.max(-LOOK_LIMIT, Math.min(LOOK_LIMIT, a));
    }
    turn.current += (want - turn.current) * Math.min(1, dt * 2.5);
    for (const [bone, share] of [[bones.neck, 0.45], [bones.head, 0.55]] as [Object3D | undefined, number][]) {
      if (!bone?.parent) continue;
      bone.parent.getWorldQuaternion(pq);
      axis.copy(up).applyQuaternion(pq.invert());              // the world's up, seen from the bone's parent
      bone.quaternion.premultiply(q.setFromAxisAngle(axis, turn.current * share));
    }

    // his lamp, after dark
    const dark = Math.max(0, 1 - live.daylight * 1.6);
    const f = 0.85 + 0.1 * Math.sin(clock.elapsedTime * 9.1) + 0.05 * Math.sin(clock.elapsedTime * 23.3);
    if (bones.hand) {
      bones.hand.getWorldPosition(at);
      dir.set(0, -0.31, 0);
      glow.position.copy(at).add(dir);
    }
    (glow.material as SpriteMaterial).opacity = Math.min(1, 1.15 * dark * f);
    glow.scale.setScalar(1.45 + 0.15 * f);
    if (pool.current) {
      (pool.current.material as MeshBasicMaterial).opacity = 0.5 * dark * f;
      pool.current.position.set(glow.position.x, 0.05, glow.position.z);
    }
  });

  return (
    <>
      <group ref={group} position={[kadyoSpot.x, 0, kadyoSpot.z]} rotation-y={0.12}>
        <primitive object={model} />
      </group>
      <primitive object={glow} />
      <mesh ref={pool} rotation-x={-Math.PI / 2} renderOrder={3}>
        <planeGeometry args={[5.2, 5.2]} />
        <meshBasicMaterial map={glowTexture()} color="#ff9a48" transparent opacity={0} depthWrite={false} blending={AdditiveBlending} />
      </mesh>
      <mesh rotation-x={-Math.PI / 2} position={[kadyoSpot.x, 0.02, kadyoSpot.z]}>
        <circleGeometry args={[0.36, 20]} />
        <meshBasicMaterial color="#000" transparent opacity={0.32} depthWrite={false} />
      </mesh>
    </>
  );
}
