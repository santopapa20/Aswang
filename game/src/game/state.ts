import { create } from "zustand";
import { Vector3 } from "three";

export const NIGHT_SECONDS = 180;

export type Phase = "playing" | "caught" | "survived";
export type Pickup = { id: number; kind: "salt" | "garlic"; x: number; z: number };
/** A line of salt on the ground, from point A to point B. The aswang cannot cross it. */
export type SaltLine = { ax: number; az: number; bx: number; bz: number };
/** Where the manananggal left her lower half: half hidden beside the balete tree. */
export const LOWER_HALF = { x: -17.6, z: -15.6 };

const PICKUPS: Pickup[] = [
  { id: 1, kind: "salt", x: -8.2, z: -3.4 },      // by the first hut
  { id: 2, kind: "salt", x: 11.2, z: -7.2 },      // by the second hut
  { id: 3, kind: "salt", x: 3.4, z: 11.4 },       // by the third hut
  { id: 4, kind: "salt", x: -4.4, z: 3.2 },       // at the well
  { id: 5, kind: "garlic", x: -11.5, z: -7.5 },
  { id: 6, kind: "garlic", x: 7.5, z: 15.5 },
  { id: 7, kind: "garlic", x: 14.5, z: 2.5 },
];

type GameState = {
  phase: Phase;
  runId: number;          // goes up on every restart so characters can reset themselves
  hunted: boolean;        // the aswang has noticed the player
  shadows: boolean;       // lamp shadows on/off (costly on integrated graphics)
  salt: number;
  garlic: number;
  pickups: Pickup[];
  lines: SaltLine[];
  mana: "absent" | "hunting" | "ended";   // the manananggal this night
  overhead: boolean;                      // she has seen the player and is about to dive
  setMana: (m: "absent" | "hunting" | "ended") => void;
  setOverhead: (o: boolean) => void;
  saltLowerHalf: () => boolean;
  setPhase: (p: Phase) => void;
  setHunted: (h: boolean) => void;
  toggleShadows: () => void;
  collect: (id: number) => void;
  pourSalt: (line: SaltLine) => boolean;
  useGarlic: () => boolean;
  restart: () => void;
};

const fresh = () => ({ phase: "playing" as Phase, hunted: false, salt: 1, garlic: 1, pickups: PICKUPS, lines: [] as SaltLine[], mana: "absent" as "absent" | "hunting" | "ended", overhead: false });

export const useGame = create<GameState>((set, get) => ({
  ...fresh(),
  runId: 0,
  shadows: false,
  setPhase: (phase) => set({ phase }),
  setHunted: (hunted) => set({ hunted }),
  toggleShadows: () => set((s) => ({ shadows: !s.shadows })),
  collect: (id) => set((s) => {
    const item = s.pickups.find((p) => p.id === id);
    if (!item) return s;
    return {
      pickups: s.pickups.filter((p) => p.id !== id),
      salt: s.salt + (item.kind === "salt" ? 2 : 0),
      garlic: s.garlic + (item.kind === "garlic" ? 1 : 0),
    };
  }),
  pourSalt: (line) => {
    if (get().salt <= 0 || get().phase !== "playing") return false;
    set((s) => ({ salt: s.salt - 1, lines: [...s.lines, line] }));
    return true;
  },
  setMana: (mana) => set({ mana }),
  setOverhead: (overhead) => set({ overhead }),
  saltLowerHalf: () => {
    if (get().salt <= 0 || get().mana === "ended" || get().phase !== "playing") return false;
    set((s) => ({ salt: s.salt - 1, mana: "ended", overhead: false }));
    return true;
  },
  useGarlic: () => {
    if (get().garlic <= 0) return false;
    set((s) => ({ garlic: s.garlic - 1 }));
    return true;
  },
  restart: () => set((s) => ({ ...fresh(), runId: s.runId + 1 })),
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

/** True if walking from (x1,z1) to (x2,z2) would step over the salt line. */
export function crossesLine(x1: number, z1: number, x2: number, z2: number, l: SaltLine) {
  const side = (px: number, pz: number, qx: number, qz: number, rx: number, rz: number) =>
    (qx - px) * (rz - pz) - (qz - pz) * (rx - px);
  const d1 = side(l.ax, l.az, l.bx, l.bz, x1, z1);
  const d2 = side(l.ax, l.az, l.bx, l.bz, x2, z2);
  const d3 = side(x1, z1, x2, z2, l.ax, l.az);
  const d4 = side(x1, z1, x2, z2, l.bx, l.bz);
  return d1 * d2 < 0 && d3 * d4 < 0;
}
