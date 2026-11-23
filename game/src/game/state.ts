import { create } from "zustand";
import { Vector3 } from "three";

export const NIGHT_SECONDS = 180;

export type Phase = "playing" | "caught" | "survived";

type GameState = {
  phase: Phase;
  runId: number;          // goes up on every restart so characters can reset themselves
  hunted: boolean;        // the aswang has noticed the player
  shadows: boolean;       // lamp shadows on/off (costly on integrated graphics)
  setPhase: (p: Phase) => void;
  setHunted: (h: boolean) => void;
  toggleShadows: () => void;
  restart: () => void;
};

export const useGame = create<GameState>((set) => ({
  phase: "playing",
  runId: 0,
  hunted: false,
  shadows: false,
  setPhase: (phase) => set({ phase }),
  setHunted: (hunted) => set({ hunted }),
  toggleShadows: () => set((s) => ({ shadows: !s.shadows })),
  restart: () => set((s) => ({ phase: "playing", hunted: false, runId: s.runId + 1 })),
}));

/** Values that change every frame live here instead of in React state, so nothing re-renders. */
export const live = {
  player: new Vector3(0, 0, 6),
  playerNoise: 0,          // how far away the player can be noticed, in metres
  timeLeft: NIGHT_SECONDS,
  fps: 0,
};

/** Things you cannot walk through: x, z, radius. */
export type Obstacle = { x: number; z: number; r: number };
export const obstacles: Obstacle[] = [];

export function pushOut(pos: Vector3, radius: number) {
  for (const o of obstacles) {
    const dx = pos.x - o.x, dz = pos.z - o.z;
    const d = Math.hypot(dx, dz), min = o.r + radius;
    if (d < min && d > 1e-4) { pos.x = o.x + (dx / d) * min; pos.z = o.z + (dz / d) * min; }
  }
  const limit = 34;
  pos.x = Math.max(-limit, Math.min(limit, pos.x));
  pos.z = Math.max(-limit, Math.min(limit, pos.z));
}
