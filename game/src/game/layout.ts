/**
 * The map, as data. Everything that stands somewhere is listed or generated here, so the world is the
 * same every time and other code (collision, creatures, the ground painter) reads one source.
 *
 * Axes: +X is east, +Z is south. The camera looks north from the south, so "up" on screen is -Z and
 * every house faces south (+Z) to show its front.
 *
 * Three areas, joined west to east: the barrio, the trail, and the old sitio (emptied after the war,
 * now only the hilot lives there). It is where the better things are found, and the far end of the
 * longest errands.
 */

export function seeded(seed: number) {
  return () => {
    seed |= 0; seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type P2 = { x: number; z: number };
export type Rect = { x0: number; x1: number; z0: number; z1: number };

// ---- where you can walk ----------------------------------------------------------------------
export const BARRIO: Rect = { x0: -37, x1: 34, z0: -33, z1: 34 };
export const TRAIL: Rect = { x0: 34, x1: 92, z0: -3.2, z1: 3.2 };
export const SITIO: Rect = { x0: 92, x1: 130, z0: -22, z1: 22 };
export const walkable: Rect[] = [BARRIO, TRAIL, SITIO];

/** The trail repeats every `period` metres between x0+3 and x1, so a walker can be moved back along it unnoticed. */
export const trail = { period: 15, loopA: 49, loopB: 79, marker: { x: 64, z: -3.9 } };

// ---- houses ----------------------------------------------------------------------------------
/**
 * The hut model (assets/village/hut.glb, fitted by tools/blender/fit_hut.py), measured in game metres from
 * the house's centre: half width and depth, where its front wall and porch floor are, and where the
 * doorway and the three windows open. The doorway is left of centre; a ladder rises to it from the yard.
 */
export const HUT = {
  height: 4.4, hx: 2.2, hz: 1.85,
  floor: 0.8, wallZ: 1.0,
  doorX: -0.27, ladderFootZ: 1.78,
  frontWindow: { x: 0.78, y: 1.92 },
  sideWindow: { z: -0.15, y: 1.86, x: 1.6 },
};
export type HouseId = "home" | "pacing" | "shut" | "kadyo" | "hilot" | "ruin1" | "ruin2" | "ruin3";
export type House = { id: HouseId; x: number; z: number; lit: boolean; yard: boolean; name: string };
export const houses: House[] = [
  { id: "home", x: -18, z: 10, lit: true, yard: true, name: "Rosing's house" },
  { id: "pacing", x: -4, z: -16, lit: true, yard: true, name: "Nang Pacing's house" },
  { id: "shut", x: 18, z: 10, lit: false, yard: true, name: "The shut house" },
  { id: "kadyo", x: 24, z: -22, lit: true, yard: false, name: "Nong Kadyo's hut" },
  { id: "hilot", x: 104, z: -10, lit: true, yard: true, name: "The hilot's house" },
  { id: "ruin1", x: 118, z: -12, lit: false, yard: false, name: "An empty house" },
  { id: "ruin2", x: 121, z: 9, lit: false, yard: true, name: "An empty house" },
  { id: "ruin3", x: 102, z: 13, lit: false, yard: false, name: "An empty house" },
];
export const house = (id: HouseId) => houses.find((h) => h.id === id)!;
export const home = house("home");
/** The spot in front of a house's door where you stand to speak or knock. */
export const doorOf = (h: House): P2 => ({ x: h.x + HUT.doorX, z: h.z + HUT.hz + 0.9 });

// ---- the house you guard ---------------------------------------------------------------------
export type OpeningId = "door" | "west" | "east";
export type Opening = { id: OpeningId; x: number; z: number; approach: P2; name: string };
export const openings: Opening[] = [
  { id: "door", x: home.x + HUT.doorX, z: home.z + HUT.hz + 0.8, approach: { x: home.x + HUT.doorX, z: home.z + 7 }, name: "the door" },
  { id: "west", x: home.x - HUT.hx - 0.8, z: home.z + HUT.sideWindow.z, approach: { x: home.x - 4.2, z: home.z + 5 }, name: "the west window" },
  { id: "east", x: home.x + HUT.hx + 0.8, z: home.z + HUT.sideWindow.z, approach: { x: home.x + 4.2, z: home.z + 5 }, name: "the east window" },
];
/** A smudge fire in the yard. Its smoke keeps anything from settling on the roof. */
export const firePit: P2 = { x: home.x + 4.6, z: home.z + 5.2 };
/** Where she waits, outside the lamplight, between tries at the house. */
export const lurkPoints: P2[] = [
  { x: home.x - 12, z: home.z + 9 }, { x: home.x - 4, z: home.z + 14 }, { x: home.x + 6, z: home.z + 13 },
  { x: home.x + 12, z: home.z + 4 }, { x: home.x - 14, z: home.z + 2 }, { x: home.x + 2, z: home.z + 17 },
];

// ---- landmarks -------------------------------------------------------------------------------
export const well: P2 = { x: 2, z: 4 };
export const balete = { x: -27, z: -22, height: 7, yard: 8.5 };
/** Where Nong Kadyo stands, day and night: at the foot of his ladder, a little to its right, facing the path. */
export const kadyoSpot: P2 = { x: house("kadyo").x + HUT.doorX + 0.2, z: house("kadyo").z + HUT.hz + 0.2 };
/** Where the kapre stands after dark: against the balete's trunk, on the side the barrio can see. */
export const kapreSpot: P2 = { x: balete.x - 2.7, z: balete.z + 2.4 };
export const START: P2 = { x: 2, z: 30 };
/** Where the manananggal may leave her lower half. The first is by the balete's roots. */
export const hidingSpots: P2[] = [
  { x: -23.6, z: -18.6 }, { x: 21, z: 26.5 }, { x: 9, z: -29.5 }, { x: -33.5, z: -3 }, { x: 22.5, z: 5.5 },
];

// ---- paths and worn ground -------------------------------------------------------------------
export type Path = { pts: [number, number][]; w: number };
export const paths: Path[] = [
  { pts: [[2, 40], [2, 22], [3, 9]], w: 2.6 },                                        // the way in from the south
  { pts: [[-2, 6], [-9, 14.5], [-15, 16.2], [-18, 13.4]], w: 2.0 },                   // to Rosing's house
  { pts: [[1, 0], [-2, -8], [-4, -13]], w: 2.0 },                                     // to Pacing's
  { pts: [[6, 3.5], [20, 1], [31, 0], [36, 0], [50, 0], [64, 0], [78, 0], [90, 0], [99, 0]], w: 2.6 },   // east, and the trail (dead straight)
  { pts: [[12, 2.6], [14, 13], [18, 15.4], [18, 13.2]], w: 1.8 },                     // to the shut house
  { pts: [[20, 1], [23, -9], [24, -18.6]], w: 1.8 },                                  // to Kadyo
  { pts: [[-2, -8], [-13, -13.5], [-21.5, -17.5]], w: 1.6 },                          // to the balete
  { pts: [[99, 0], [103.5, -4], [104, -7]], w: 1.8 },                                 // sitio: the hilot
  { pts: [[99, 0], [111, 1.5], [117, -5], [118, -8.8]], w: 1.8 },
  { pts: [[111, 1.5], [119, 9], [121, 12.4]], w: 1.6 },
  { pts: [[103, 3], [102, 16.2]], w: 1.6 },
];
/** Packed earth: the plaza round the well and the swept ground in front of each lived-in house. */
export const patches: { x: number; z: number; r: number }[] = [
  { x: well.x, z: well.z, r: 6.2 },
  ...houses.map((h) => ({ x: h.x, z: h.z + 3.2, r: h.lit ? 5.6 : 4.2 })),
  { x: 99, z: 0, r: 4.5 },
];

function distToSegment(px: number, pz: number, ax: number, az: number, bx: number, bz: number) {
  const dx = bx - ax, dz = bz - az;
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / (dx * dx + dz * dz || 1)));
  return Math.hypot(px - ax - dx * t, pz - az - dz * t);
}
export function distToPath(x: number, z: number) {
  let best = 1e9;
  for (const p of paths) {
    for (let i = 0; i + 1 < p.pts.length; i++) {
      best = Math.min(best, distToSegment(x, z, p.pts[i][0], p.pts[i][1], p.pts[i + 1][0], p.pts[i + 1][1]) - p.w / 2);
    }
  }
  return best;
}
const inRect = (x: number, z: number, r: Rect, pad = 0) => x > r.x0 - pad && x < r.x1 + pad && z > r.z0 - pad && z < r.z1 + pad;
export const isWalkable = (x: number, z: number) => walkable.some((r) => inRect(x, z, r));

// ---- fences: a U behind each yard, open to the front -----------------------------------------
export const FENCE_LENGTH = 2.3;
export type FencePiece = { x: number; z: number; rot: number };
export const fences: FencePiece[] = [];
function run(sx: number, sz: number, dir: number, n: number) {
  for (let i = 0; i < n; i++) {
    const d = (i + 0.5) * FENCE_LENGTH;
    fences.push({ x: sx + Math.cos(dir) * d, z: sz - Math.sin(dir) * d, rot: dir });
  }
}
for (const h of houses) {
  if (!h.yard) continue;
  const back = h.z - 5.4, half = 3 * FENCE_LENGTH;
  run(h.x - half, back, 0, 6);
  run(h.x - half, back, -Math.PI / 2, h.id === "ruin2" ? 2 : 3);
  run(h.x + half, back, -Math.PI / 2, h.id === "hilot" ? 2 : 3);
}
run(28.5, -6.8, -Math.PI / 2, 2); run(28.5, 2.2, -Math.PI / 2, 2);      // the gateposts where the trail leaves the barrio

// ---- things to search ------------------------------------------------------------------------
export type NodeKind = "baul" | "banga" | "sako" | "kindling" | "herbs";
export type LootNode = { id: number; kind: NodeKind; x: number; z: number; rich: boolean; rot: number };
const nodeSpots: [NodeKind, number, number, boolean][] = [
  // the barrio: only what the land gives, nobody's belongings
  ["kindling", 20, 22.5, false], ["kindling", -29, 27, false], ["kindling", 12, -27, false],
  ["herbs", -33, 2, false], ["herbs", 28, 17, false], ["herbs", -12, -27, false], ["sako", 6.5, 7.5, false],
  // the old sitio: what people left behind when they went
  ["baul", 115.6, -8.6, true], ["banga", 120.6, -9.2, true], ["sako", 113.5, -14.5, true],
  ["baul", 123.6, 12.4, true], ["banga", 118.2, 12.6, true], ["sako", 125.5, 5.5, true],
  ["baul", 104.4, 16.4, true], ["banga", 99.6, 15.8, true], ["kindling", 109, 18, true],
  ["herbs", 126, -17, true], ["herbs", 95.5, -17.5, true], ["banga", 110, -3.2, true], ["sako", 127, -3, true],
];
export const nodes: LootNode[] = nodeSpots.map(([kind, x, z, rich], i) => ({ id: i + 1, kind, x, z, rich, rot: i * 1.7 }));

// ---- plants: generated once, in deliberate places --------------------------------------------
export type Tree = { x: number; z: number; h: number; lean: number; solid: boolean };
export type Blob = { x: number; z: number; s: number; r: number };
export const palms: Tree[] = [];
export const bushes: Blob[] = [];
export const rocks: Blob[] = [];
export const tufts: Blob[] = [];

// ---- larger things placed by hand (decided before the trees, so no palm grows through one) ------
export type Decor = {
  kind: "rocks" | "shrub" | "fern" | "logs" | "pot" | "deadtree" | "stump" | "mossylog" | "boulder" | "campfire" | "bench" | "basket" | "garden" | "cross" | "barrel" | "wheelbarrow" | "straw" | "rooster";
  x: number; z: number; s: number; r: number;
};
const lived = houses.filter((h) => h.lit);
export const placed: Decor[] = [
  // the old sitio: bare trees, and the graves of those who did not leave
  { kind: "deadtree", x: 110.5, z: -9.5, s: 1, r: 0.4 }, { kind: "deadtree", x: 113.2, z: 9.6, s: 0.85, r: 2.6 }, { kind: "deadtree", x: 94.6, z: -7.2, s: 0.9, r: 4.1 },
  { kind: "deadtree", x: 27.2, z: 12.6, s: 0.8, r: 1.3 },                                    // one in the barrio, by the shut house
  ...([[106.4, 8.4, 1.0, 0.1], [108.3, 8.0, 0.86, -0.25], [110.2, 8.7, 1.08, 0.2], [107.2, 10.8, 0.92, 0.35], [109.3, 11.1, 0.8, -0.15]] as const).map(([x, z, s, r]) => ({ kind: "cross" as const, x, z, s, r })),
  // the forest floor at the edges
  ...([[-33.4, 22, 1.0, 0.5], [31, 27.6, 0.9, 2.2], [15.5, -30.6, 1.05, 4], [95, 19, 1.0, 1.1], [128, 14.4, 0.9, 3.3]] as const).map(([x, z, s, r]) => ({ kind: "stump" as const, x, z, s, r })),
  ...([[-9.6, 22.6, 1.0, 0.5], [27.6, -9.6, 0.9, 1.9], [-30.2, -9.4, 1.05, 2.7], [97.4, 9.6, 1.0, 1.2], [116.2, 15.8, 0.9, 0.2]] as const).map(([x, z, s, r]) => ({ kind: "mossylog" as const, x, z, s, r })),
  ...([[-21, 24.2, 1.0, 0.7], [9.6, 17.6, 0.7, 2.0], [-34, -12.2, 1.2, 4.4], [30, -28, 1.1, 1.0], [100, -15.6, 1.0, 3.0], [123.6, -4.6, 0.8, 5.2]] as const).map(([x, z, s, r]) => ({ kind: "boulder" as const, x, z, s, r })),
  // the plaza: somewhere to sit by the well
  { kind: "bench", x: well.x + 2.9, z: well.z - 0.5, s: 1, r: 1.3 }, { kind: "bench", x: well.x - 2.6, z: well.z + 1.5, s: 1, r: -0.9 },
  // lived-in houses: a seat, a basket by the jars, a bed of flowers, and a cooking fire where nobody fights
  ...lived.flatMap((h): Decor[] => h.id === "home"
    ? [{ kind: "basket", x: h.x + 2.95, z: h.z + HUT.hz + 0.55, s: 1, r: 0.4 }, { kind: "garden", x: h.x - 6.2, z: h.z + 7.4, s: 1, r: 0.3 }]
    : [
      { kind: "bench", x: h.x - 2.7, z: h.z + HUT.hz + 1.2, s: 1, r: 0.2 }, { kind: "basket", x: h.x - 1.25, z: h.z + HUT.hz + 0.45, s: 1, r: h.x },
      { kind: "garden", x: h.x - 4.9, z: h.z + 1.4, s: 1, r: h.z * 0.3 }, { kind: "campfire", x: h.x + 3.6, z: h.z + HUT.hz + 2.3, s: 1, r: h.x * 0.7 },
      // a rain barrel under the eaves, and rice straw kept dry beside the firewood
      { kind: "barrel", x: h.x + HUT.hx + 0.7, z: h.z + 1.1, s: 1, r: h.x }, { kind: "straw", x: h.x - HUT.hx - 1.0, z: h.z - 0.75, s: 1, r: 0.15 }, { kind: "straw", x: h.x - HUT.hx - 1.25, z: h.z - 1.75, s: 0.9, r: 1.2 },
    ]),
  // a barrow left where the work stopped
  { kind: "wheelbarrow", x: 28.8, z: -21.2, s: 1, r: 2.3 }, { kind: "wheelbarrow", x: 14.6, z: 13.4, s: 1, r: 0.6 }, { kind: "wheelbarrow", x: 9.8, z: 0.1, s: 1, r: 4.0 },
  // fighting cocks scratching about by day (they roost at night, so they are only drawn in daylight, and you walk through them)
  ...([[home.x - 1.7, home.z + 6.3, 0.4], [-1.8, -11.4, 2.4], [22.3, -17.1, 5.0], [105.7, -5.3, 1.2], [well.x - 1.3, well.z + 3.3, 3.6], [well.x + 3.7, well.z + 2.3, 0.9]] as const)
    .map(([x, z, r]) => ({ kind: "rooster" as const, x, z, s: 1, r })),
];

const clearOfThings = (x: number, z: number, pad: number) =>
  distToPath(x, z) > pad
  && placed.every((d) => Math.hypot(x - d.x, z - d.z) > (d.kind === "deadtree" ? 3.4 : 2) + pad * 0.3)
  && patches.every((p) => Math.hypot(x - p.x, z - p.z) > p.r + pad * 0.4)
  && houses.every((h) => Math.abs(x - h.x) > HUT.hx + pad + 1 || Math.abs(z - h.z) > HUT.hz + pad + 1)
  && fences.every((f) => Math.hypot(x - f.x, z - f.z) > 1.3 + pad * 0.3)
  && Math.hypot(x - balete.x, z - balete.z) > balete.height * 0.75
  && nodes.every((n) => Math.hypot(x - n.x, z - n.z) > 1.6)
  && hidingSpots.every((s) => Math.hypot(x - s.x, z - s.z) > 2)
  && lurkPoints.every((s) => Math.hypot(x - s.x, z - s.z) > 1.5)
  && openings.every((o) => Math.hypot(x - o.approach.x, z - o.approach.z) > 2.5)
  && Math.hypot(x - firePit.x, z - firePit.z) > 2.5;

{
  const rnd = seeded(1953);
  const addPalm = (x: number, z: number, solid: boolean) => {
    if (palms.some((p) => Math.hypot(p.x - x, p.z - z) < 3.1)) return false;
    palms.push({ x, z, h: 4.4 + rnd() * 1.6, lean: (rnd() - 0.5) * 0.3, solid });      // h is the whole height in metres
    return true;
  };
  // groves: a few clusters inside the barrio and the sitio, never on a path or in a yard
  const groves: [number, number, number, number, number][] = [
    [22, 25, 9, 6.5, 9], [-29, 27, 6, 5, 6], [11, -28, 10, 3.5, 7], [-33, -3, 3, 9, 5], [30, 16, 3, 8, 4],
    [-14, -26, 6, 4, 4], [9.5, 10, 1, 1, 1], [-7, -2, 1, 1, 1], [13, -7, 1, 1, 1], [-27, 0, 1, 1, 1],
    [112, 17, 9, 3.5, 5], [126, -16, 3.5, 5, 4], [96, -17, 3, 4, 3], [110, -18, 6, 2.5, 3], [127, 0, 2, 6, 3],
  ];
  for (const [cx, cz, rx, rz, want] of groves) {
    let made = 0;
    for (let tries = 0; tries < 400 && made < want; tries++) {
      const a = rnd() * Math.PI * 2, d = Math.sqrt(rnd());
      const x = cx + Math.cos(a) * rx * d, z = cz + Math.sin(a) * rz * d;
      if (isWalkable(x, z) && clearOfThings(x, z, 2.2) && addPalm(x, z, true)) made++;
    }
  }
  // the treeline: a band just outside where you can walk, so the world ends in trees and not in nothing
  const band = (r: Rect, skip: (x: number, z: number) => boolean) => {
    const per = 2 * (r.x1 - r.x0 + r.z1 - r.z0);
    for (let s = 0; s < per; s += 2.1) {
      let x: number, z: number, nx = 0, nz = 0, t = s;
      const w = r.x1 - r.x0, d = r.z1 - r.z0;
      if (t < w) { x = r.x0 + t; z = r.z0; nz = -1; }
      else if ((t -= w) < d) { x = r.x1; z = r.z0 + t; nx = 1; }
      else if ((t -= d) < w) { x = r.x1 - t; z = r.z1; nz = 1; }
      else { t -= w; x = r.x0; z = r.z1 - t; nx = -1; }
      if (skip(x, z)) continue;
      const out = 1.2 + rnd() * 2.4;
      bushes.push({ x: x + nx * out + (rnd() - 0.5), z: z + nz * out + (rnd() - 0.5), s: 0.9 + rnd() * 0.7, r: rnd() * 6 });
      bushes.push({ x: x + nx * (out + 1.6) + (rnd() - 0.5) * 1.6, z: z + nz * (out + 1.6) + (rnd() - 0.5) * 1.6, s: 1.1 + rnd() * 0.8, r: rnd() * 6 });
      if (rnd() < 0.7) bushes.push({ x: x + nx * (out + 3.4), z: z + nz * (out + 3.4), s: 1.4 + rnd() * 1.0, r: rnd() * 6 });
      if (rnd() < 0.62) addPalm(x + nx * (2.2 + rnd() * 5), z + nz * (2.2 + rnd() * 5), false);
    }
  };
  band(BARRIO, (x, z) => (x > 33 && Math.abs(z) < 4.6) || (z > 33 && Math.abs(x - 2) < 3.5));
  band(SITIO, (x, z) => x < 93 && Math.abs(z) < 4.6);
  // the trail: the same stretch of trees and undergrowth repeated every 15 m (see `trail`)
  const palmPattern: [number, number][] = [[2, -5.4], [6.5, 5.8], [9.5, -6.6], [13, 5.2]];
  const bushPattern: [number, number, number][] = [[0.5, 4.4, 1.9], [3.5, -4.6, 2.2], [5.8, 4.9, 1.6], [8, -4.3, 1.7], [10.5, 4.5, 2.3], [12.6, -4.8, 2.0], [14, -7.5, 2.6], [7, 7.6, 2.6]];
  for (let p = 0; p < 4; p++) {
    const base = 37 + p * trail.period;
    for (const [dx, z] of palmPattern) palms.push({ x: base + dx, z, h: 4.8 + ((dx * 7) % 3) * 0.4, lean: z > 0 ? 0.12 : -0.1, solid: false });
    for (const [dx, z, s] of bushPattern) bushes.push({ x: base + dx, z, s: s * (z > 0 ? 0.42 : 0.62), r: dx });      // lower on the camera's side of the trail
  }
  // stones and grass
  for (let i = 0; i < 70; i++) {
    const area = i % 3 === 2 ? SITIO : BARRIO;
    const x = area.x0 + rnd() * (area.x1 - area.x0), z = area.z0 + rnd() * (area.z1 - area.z0);
    if (clearOfThings(x, z, 0.8)) rocks.push({ x, z, s: 0.14 + rnd() * 0.24, r: rnd() * 6 });
  }
  // grass on the trail repeats with the trees, so nothing gives the loop away
  for (let i = 0; i < 130; i++) {
    const dx = rnd() * trail.period, z = (rnd() - 0.5) * 15, s = 0.8 + rnd() * 0.7, r = rnd() * 6;
    if (Math.abs(z) < 1.5) continue;
    for (let p = 0; p < 4; p++) tufts.push({ x: 37 + p * trail.period + dx, z, s, r });
  }
  for (let i = 0; i < 8600; i++) {
    const area = rnd() < 0.68 ? BARRIO : SITIO;
    const x = area.x0 + rnd() * (area.x1 - area.x0), z = area.z0 + rnd() * (area.z1 - area.z0);
    const worn = distToPath(x, z);
    if (worn < 0.25 || patches.some((p) => Math.hypot(x - p.x, z - p.z) < p.r * 0.86)) continue;
    if (houses.some((h) => Math.abs(x - h.x) < HUT.hx + 0.2 && Math.abs(z - h.z) < HUT.hz + 0.2)) continue;
    if (worn < 0.9 && rnd() < 0.5) continue;                                   // thin at the edge of trodden ground
    tufts.push({ x, z, s: 0.6 + rnd() * 0.75 + Math.min(0.4, worn * 0.06), r: rnd() * 6 });
  }
}

// ---- set dressing: real models, placed on purpose ---------------------------------------------
export const decor: Decor[] = [];
for (const h of houses) {
  if (!h.lit) continue;
  decor.push({ kind: "shrub", x: h.x - 4.9, z: h.z - 3.9, s: 1.25, r: h.x });           // in the back corners of each lived-in yard
  decor.push({ kind: "shrub", x: h.x + 5.2, z: h.z - 4.1, s: 1.05, r: h.z });
}
for (const [x, z, s] of [[7.6, 9.2, 1.2], [-4.6, -1.2, 1.0], [30.2, 4.6, 1.3], [96.4, 4.4, 1.2], [112, -19, 1.3], [-31, 14, 1.3]]) decor.push({ kind: "shrub", x, z, s, r: x * z });
for (const [x, z, s] of [[5.4, 20.5, 1.0], [-6.6, 9.4, 0.8], [9.2, -3.4, 0.9], [27.4, 3.4, 1.1], [-10.4, -10.6, 0.9], [21.6, -12, 0.8], [97.2, -3.8, 1.0], [108.6, 4.6, 0.9], [116.2, 3.2, 1.1], [-2.6, 26, 0.9]]) {
  decor.push({ kind: "rocks", x, z, s, r: x + z });
}
// lived-in houses keep their water jars by the ladder and their firewood under the eaves (Rosing's yard is kept clear: it is fought over)
for (const h of houses) {
  if (!h.lit) continue;
  decor.push({ kind: "pot", x: h.x + 1.75, z: h.z + HUT.hz + 0.42, s: 1, r: h.x }, { kind: "pot", x: h.x + 2.3, z: h.z + HUT.hz + 0.2, s: 0.8, r: h.z });
  if (h.id !== "home") decor.push({ kind: "logs", x: h.x - HUT.hx - 0.95, z: h.z + 0.9, s: 1, r: 1.57 }, { kind: "pot", x: h.x - 1.9, z: h.z + HUT.hz + 0.5, s: 1.1, r: 2 });
}
// the old sitio is going back to the forest: growth has come up against the empty houses
for (const h of houses) {
  if (h.lit || h.id === "shut") continue;
  for (const [dx, dz, s] of [[-2.9, 2.6, 1.0], [2.8, 2.9, 0.8], [-3.1, -0.6, 1.2], [3.2, -1.4, 1.1], [0.9, 3.3, 0.6]]) bushes.push({ x: h.x + dx, z: h.z + dz, s, r: dx * 3 + h.x });
}
decor.push(...placed);
palms.filter((p) => p.solid).slice(0, 26).forEach((p, i) => decor.push({ kind: "fern", x: p.x + Math.cos(i * 2.4) * 1.1, z: p.z + Math.sin(i * 2.4) * 1.1, s: 0.7 + (i % 3) * 0.12, r: i }));
for (let p = 0; p < 4; p++) {
  const base = 37 + p * trail.period;                                                  // the trail's dressing repeats with its trees
  decor.push({ kind: "fern", x: base + 4.6, z: -3.9, s: 0.8, r: 1 }, { kind: "fern", x: base + 11.6, z: 4.0, s: 0.75, r: 2 }, { kind: "rocks", x: base + 7.4, z: 4.3, s: 0.7, r: 3 });
}

// ---- collision -------------------------------------------------------------------------------
export type Circle = { x: number; z: number; r: number };
/** How far from its centre each kind of prop stops you, in metres at full size. */
const SOLID: Record<Decor["kind"], number> = { rocks: 0.5, shrub: 0.8, fern: 0, logs: 0.5, pot: 0.32, deadtree: 0.8, stump: 0.95, mossylog: 0.4, boulder: 0.8, campfire: 0.6, bench: 0.42, basket: 0.3, garden: 0.85, cross: 0.32, barrel: 0.42, wheelbarrow: 0.7, straw: 0.55, rooster: 0 };
export const solids: Circle[] = [
  { x: kadyoSpot.x, z: kadyoSpot.z, r: 0.32 },
  ...palms.filter((p) => p.solid).map((p) => ({ x: p.x, z: p.z, r: 0.45 })),
  ...fences.flatMap((f) => [-0.75, 0, 0.75].map((k) => ({ x: f.x + Math.cos(f.rot) * k, z: f.z - Math.sin(f.rot) * k, r: 0.45 }))),
  { x: well.x, z: well.z, r: 1.05 },
  { x: balete.x, z: balete.z, r: balete.height * 0.2 },
  { x: firePit.x, z: firePit.z, r: 0.5 },
  { x: kapreSpot.x, z: kapreSpot.z, r: 0.95 },
  ...nodes.filter((n) => n.kind !== "herbs").map((n) => ({ x: n.x, z: n.z, r: 0.45 })),
  { x: trail.marker.x, z: trail.marker.z, r: 0.3 },
  ...decor.filter((d) => d.kind !== "fern" && d.kind !== "mossylog" && d.kind !== "rooster").map((d) => ({ x: d.x, z: d.z, r: SOLID[d.kind] * d.s })),
  // a fallen log is long: three circles along it
  ...decor.filter((d) => d.kind === "mossylog").flatMap((d) => [-0.8, 0, 0.8].map((k) => ({ x: d.x + Math.cos(d.r) * k * d.s, z: d.z - Math.sin(d.r) * k * d.s, r: 0.4 * d.s }))),
];
export const boxes = houses.map((h) => ({ x: h.x, z: h.z, hx: HUT.hx + 0.1, hz: HUT.hz + 0.1 }));

/** Moves a point out of anything solid and back onto walkable ground. */
export function pushOut(pos: P2, radius: number) {
  for (const o of solids) {
    const dx = pos.x - o.x, dz = pos.z - o.z;
    if (Math.abs(dx) > 2 || Math.abs(dz) > 2.6) continue;
    const d = Math.hypot(dx, dz), min = o.r + radius;
    if (d < min && d > 1e-4) { pos.x = o.x + (dx / d) * min; pos.z = o.z + (dz / d) * min; }
  }
  for (const b of boxes) {
    const dx = pos.x - b.x, dz = pos.z - b.z;
    const px = b.hx + radius - Math.abs(dx), pz = b.hz + radius - Math.abs(dz);
    if (px > 0 && pz > 0) {
      if (px < pz) pos.x = b.x + Math.sign(dx || 1) * (b.hx + radius);
      else pos.z = b.z + Math.sign(dz || 1) * (b.hz + radius);
    }
  }
  if (!walkable.some((r) => inRect(pos.x, pos.z, r))) {
    // off the map: go to the nearest point of the nearest area
    let best = 1e9, bx = pos.x, bz = pos.z;
    for (const r of walkable) {
      const cx = Math.max(r.x0, Math.min(r.x1, pos.x)), cz = Math.max(r.z0, Math.min(r.z1, pos.z));
      const d = Math.hypot(cx - pos.x, cz - pos.z);
      if (d < best) { best = d; bx = cx; bz = cz; }
    }
    pos.x = bx; pos.z = bz;
  }
}
