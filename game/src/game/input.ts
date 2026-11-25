import { useEffect } from "react";
import { live, useGame } from "./state";
import { sound } from "./audio";

/** Keys currently held, by KeyboardEvent.code. */
export const held = new Set<string>();
export const toggles = { sneak: false };
/** The touch screen's stick (TouchControls.tsx): which way it is pushed, -1..1, screen down is +z. */
export const stick = { on: false, x: 0, z: 0 };
/** One-shot actions: set on key press, cleared by whoever handles them. */
export const actions = { pour: false, whip: false, slash: false, pouch: false, smudge: false };

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
        // while a line is still being written out, the first press finishes it
        if (["Enter", "Space", "KeyE"].includes(e.code)) { if (live.typing) live.skipTyping = true; else g.advance(); }
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
      if (e.code === "KeyV") actions.slash = true;
      if (e.code === "KeyZ") actions.pouch = true;
      if (e.code === "KeyX") actions.smudge = true;
      if (e.code === "KeyF" && g.stage === "night") g.set({ lampOn: !g.lampOn });
    };
    const up = (e: KeyboardEvent) => held.delete(e.code);
    const blur = () => { held.clear(); stick.on = false; };
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
  if (stick.on) { const n = Math.hypot(stick.x, stick.z) || 1; return { x: stick.x / n, z: stick.z / n }; }
  let x = 0, z = 0;
  if (held.has("KeyW") || held.has("ArrowUp")) z -= 1;
  if (held.has("KeyS") || held.has("ArrowDown")) z += 1;
  if (held.has("KeyA") || held.has("ArrowLeft")) x -= 1;
  if (held.has("KeyD") || held.has("ArrowRight")) x += 1;
  const len = Math.hypot(x, z);
  return len > 0 ? { x: x / len, z: z / len } : { x: 0, z: 0 };
}
