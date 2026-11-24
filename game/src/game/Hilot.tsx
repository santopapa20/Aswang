import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Mesh, Object3D, Quaternion, Vector3 } from "three";
import { live, useGame } from "./state";
import { hilotDoor, hilotSolid, hilotSpot } from "./layout";
import { useCharacter } from "./useCharacter";

const LOOK_RANGE = 9;           // metres within which she watches you
const LOOK_LIMIT = 1.2;         // radians either side she will turn her head
const YARD_FACING = -0.3;       // in her yard she faces down the path she expects people on
const up = new Vector3(0, 1, 0), side = new Vector3(), axis = new Vector3(), q = new Quaternion(), pq = new Quaternion(), gq = new Quaternion();

/**
 * The hilot, the old sitio's midwife. By day she stands in her yard at the foot of her ladder and watches
 * whoever comes up the path. After dark she keeps indoors with her lamp; when he calls at her house on the
 * third night she opens the door and answers from the threshold, nodding as she speaks, then goes back in.
 * On the last night she is at Rosing's side, out of sight. Model and motions: assets/hilot.
 */
export function Hilot() {
  const shadows = useGame((s) => s.shadows);
  const { group, model, api } = useCharacter("/models/hilot.glb", shadows, false);
  const turn = useRef(0);
  const talkFor = useRef(0);
  const lastCaption = useRef(0);
  const blob = useRef<Mesh>(null);
  const bones = useMemo(() => ({ neck: api.bone("Neck"), head: api.bone("Head") }), [api]);

  useEffect(() => { api.reset(); api.play("idle", { fade: 0 }); }, [api]);

  useFrame(({ clock }, rawDt) => {
    const dt = Math.min(rawDt, 0.1);
    const g = group.current;
    if (!g) return;
    const game = useGame.getState();
    live.hilotOut = Math.max(0, live.hilotOut - dt);

    // where she is: in the yard by day, on her threshold while answering a call, otherwise indoors
    const inYard = game.stage !== "night";
    const atDoor = !inYard && live.hilotOut > 0.4 && live.hilotOut < 9.5;
    g.visible = inYard || atDoor;
    hilotSolid.r = inYard ? 0.3 : 0;
    if (blob.current) blob.current.visible = inYard;
    if (!g.visible) return;
    if (inYard) { g.position.set(hilotSpot.x, 0, hilotSpot.z); g.rotation.y = YARD_FACING; }
    else { g.position.set(hilotDoor.x, hilotDoor.y, hilotDoor.z); g.rotation.y = 0; }
    api.play("idle", { fade: 0.4 });

    // she nods while she speaks
    if (game.caption?.who === "The hilot" && game.caption.id !== lastCaption.current) { lastCaption.current = game.caption.id; talkFor.current = 4.5; }
    talkFor.current = Math.max(0, talkFor.current - dt);
    const nod = talkFor.current > 0 ? 0.13 * Math.max(0, Math.sin(clock.elapsedTime * 6.3)) * Math.min(1, talkFor.current) : 0;

    // her head follows you, within the reach of her neck
    g.updateMatrixWorld();
    const dx = live.player.x - g.position.x, dz = live.player.z - g.position.z;
    let want = 0;
    if (Math.hypot(dx, dz) < LOOK_RANGE) {
      let a = Math.atan2(dx, dz) - g.rotation.y;
      a = Math.atan2(Math.sin(a), Math.cos(a));
      want = Math.max(-LOOK_LIMIT, Math.min(LOOK_LIMIT, a));
    }
    turn.current += (want - turn.current) * Math.min(1, dt * 2.5);
    g.getWorldQuaternion(gq);
    side.set(1, 0, 0).applyQuaternion(gq);                       // across her shoulders, in the world
    for (const [bone, share] of [[bones.neck, 0.4], [bones.head, 0.6]] as [Object3D | undefined, number][]) {
      if (!bone?.parent) continue;
      bone.parent.getWorldQuaternion(pq).invert();
      bone.quaternion.premultiply(q.setFromAxisAngle(axis.copy(side).applyQuaternion(pq), nod * share));
      bone.quaternion.premultiply(q.setFromAxisAngle(axis.copy(up).applyQuaternion(pq), turn.current * share));
    }
  });

  return (
    <>
      <group ref={group}>
        <primitive object={model} />
      </group>
      <mesh ref={blob} rotation-x={-Math.PI / 2} position={[hilotSpot.x, 0.02, hilotSpot.z]}>
        <circleGeometry args={[0.34, 20]} />
        <meshBasicMaterial color="#000" transparent opacity={0.32} depthWrite={false} />
      </mesh>
    </>
  );
}
