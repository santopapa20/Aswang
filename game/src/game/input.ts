import { useEffect } from "react";
import { useGame } from "./state";

/** Keys currently held, by KeyboardEvent.code. */
export const held = new Set<string>();
export const toggles = { sneak: false };

export function useKeyboard() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      held.add(e.code);
      if (e.code === "KeyC") toggles.sneak = !toggles.sneak;
      if (e.code === "KeyR") { toggles.sneak = false; useGame.getState().restart(); }
      if (e.code === "KeyL") useGame.getState().toggleShadows();
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space"].includes(e.code)) e.preventDefault();
    };
    const up = (e: KeyboardEvent) => held.delete(e.code);
    const blur = () => held.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
    };
  }, []);
}

/** Direction the player wants to go, on the ground plane. Up on screen is -Z. */
export function moveAxis(): { x: number; z: number } {
  let x = 0, z = 0;
  if (held.has("KeyW") || held.has("ArrowUp")) z -= 1;
  if (held.has("KeyS") || held.has("ArrowDown")) z += 1;
  if (held.has("KeyA") || held.has("ArrowLeft")) x -= 1;
  if (held.has("KeyD") || held.has("ArrowRight")) x += 1;
  const len = Math.hypot(x, z);
  return len > 0 ? { x: x / len, z: z / len } : { x: 0, z: 0 };
}
