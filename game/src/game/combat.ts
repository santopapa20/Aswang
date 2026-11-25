/**
 * What his blows do to a thing standing at (x, z) this frame: the whip (R) reaches all round him, the itak
 * (V) only what is close and in front of him, and a thrown salt pouch (Z) makes what is in front of him reel.
 * The creatures that can be hurt (Amalanhig.tsx, Kin.tsx) ask this each frame; the flags are set by
 * Player.tsx and cleared at the end of the frame by the Director (Cast.tsx).
 */
import { POUCH } from "./data";
import { live, mods, useGame } from "./state";

export function strikesAt(x: number, z: number): { damage: number; stun: number; blade: boolean } {
  if (!live.whipCrack && !live.slash && !live.saltThrow) return { damage: 0, stun: 0, blade: false };
  const m = mods(useGame.getState());
  const dx = x - live.player.x, dz = z - live.player.z, d = Math.hypot(dx, dz);
  const ahead = d < 0.3 || (Math.sin(live.facing) * dx + Math.cos(live.facing) * dz) / d > 0.35;
  let damage = 0, stun = 0, blade = false;
  if (live.whipCrack && d < m.whipReach) damage += m.whipDamage;
  if (live.slash && d < m.bladeReach && ahead) { damage += m.bladeDamage; blade = true; }
  if (live.saltThrow && d < POUCH.range && ahead) stun = POUCH.stun;
  return { damage, stun, blade };
}
