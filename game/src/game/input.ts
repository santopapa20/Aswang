import { useEffect } from "react";
import { useGame } from "./state";
import { sound } from "./audio";

/** Keys currently held, by KeyboardEvent.code. */
export const held = new Set<string>();
export const toggles = { sneak: false };
/** One-shot actions: set on key press, cleared by whoever handles them. */
export const actions = { pour: false, whip: false };

/** Picks one of the answers offered at the end of a conversation. */
export function choose(i: number) {
  const g = useGame.getState(), d = g.dialogue;
  if (!d?.choices || d.index < d.lines.length - 1 || !d.choices[i]) return;
  g.set({ dialogue: null });
  d.choices[i].pick();
  d.then?.();
}

export function useKeyboard() {
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.repeat) return;
      sound.wake();
      const g = useGame.getState();
      const playing = g.stage === "day" || g.stage === "night";
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "Space", "Tab"].includes(e.code)) e.preventDefault();
      if (e.code === "KeyM") g.toggleMute();
      if (g.dialogue) {
        if (["Enter", "Space", "KeyE"].includes(e.code)) g.advance();
        if (e.code.startsWith("Digit")) choose(Number(e.code.slice(5)) - 1);
        return;
      }
      if (e.code === "Escape" && playing) { g.setPanel(g.panel ? null : "pause"); return; }
      if (e.code === "Tab" && playing) { g.setPanel(g.panel === "bag" ? null : "bag"); return; }
      if (g.stage === "morning" && e.code === "Enter") { g.nextDay(); return; }
      if (g.panel || !playing) return;
      held.add(e.code);
      if (e.code === "KeyC") toggles.sneak = !toggles.sneak;
      if (e.code === "KeyL") g.toggleShadows();
      if (e.code === "KeyQ") actions.pour = true;
      if (e.code === "KeyR") actions.whip = true;
      if (e.code === "KeyF" && g.stage === "night") g.set({ lampOn: !g.lampOn });
    };
    const up = (e: KeyboardEvent) => held.delete(e.code);
    const blur = () => held.clear();
    window.addEventListener("keydown", down);
    window.addEventListener("keyup", up);
    window.addEventListener("blur", blur);
    window.addEventListener("pointerdown", sound.wake);
    return () => {
      window.removeEventListener("keydown", down);
      window.removeEventListener("keyup", up);
      window.removeEventListener("blur", blur);
      window.removeEventListener("pointerdown", sound.wake);
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
