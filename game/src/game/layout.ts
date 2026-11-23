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
export const HUT = { height: 4.4, hx: 2.2, hz: 1.85 };          // half width and half depth of the model
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
export const doorOf = (h: House): P2 => ({ x: h.x, z: h.z + HUT.hz + 0.9 });

// ---- the house you guard ---------------------------------------------------------------------
export type OpeningId = "door" | "west" | "east";
export type Opening = { id: OpeningId; x: number; z: number; approach: P2; name: string };
export const openings: Opening[] = [
  { id: "door", x: home.x, z: home.z + HUT.hz + 0.8, approach: { x: home.x, z: home.z + 7 }, name: "the door" },
  { id: "west", x: home.x - HUT.hx - 0.8, z: home.z, approach: { x: home.x - 4.2, z: home.z + 5 }, name: "the west window" },
  { id: "east", x: home.x + HUT.hx + 0.8, z: home.z, approach: { x: home.x + 4.2, z: home.z + 5 }, name: "the east window" },
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

const clearOfThings = (x: number, z: number, pad: number) =>
  distToPath(x, z) > pad
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
    palms.push({ x, z, h: 5.4 + rnd() * 3.2, lean: (rnd() - 0.5) * 0.3, solid });
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
      bushes.push({ x: x + nx * out + (rnd() - 0.5), z: z + nz * out + (rnd() - 0.5), s: 1.5 + rnd() * 1.5, r: rnd() * 6 });
      if (rnd() < 0.55) bushes.push({ x: x + nx * (out + 3.2), z: z + nz * (out + 3.2), s: 2 + rnd() * 1.6, r: rnd() * 6 });
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
    for (const [dx, z] of palmPattern) palms.push({ x: base + dx, z, h: 6.2 + ((dx * 7) % 3), lean: z > 0 ? 0.12 : -0.1, solid: false });
    for (const [dx, z, s] of bushPattern) bushes.push({ x: base + dx, z, s, r: dx });
  }
  // stones and grass
  for (let i = 0; i < 70; i++) {
    const area = i % 3 === 2 ? SITIO : BARRIO;
    const x = area.x0 + rnd() * (area.x1 - area.x0), z = area.z0 + rnd() * (area.z1 - area.z0);
    if (clearOfThings(x, z, 0.8)) rocks.push({ x, z, s: 0.12 + rnd() * 0.2, r: rnd() * 6 });
  }
  // grass on the trail repeats with the trees, so nothing gives the loop away
  for (let i = 0; i < 130; i++) {
    const dx = rnd() * trail.period, z = (rnd() - 0.5) * 15, s = 0.4 + rnd() * 0.45, r = rnd() * 6;
    if (Math.abs(z) < 1.5) continue;
    for (let p = 0; p < 4; p++) tufts.push({ x: 37 + p * trail.period + dx, z, s, r });
  }
  for (let i = 0; i < 6000; i++) {
    const area = rnd() < 0.68 ? BARRIO : SITIO;
    const x = area.x0 + rnd() * (area.x1 - area.x0), z = area.z0 + rnd() * (area.z1 - area.z0);
    const worn = distToPath(x, z);
    if (worn < 0.25 || patches.some((p) => Math.hypot(x - p.x, z - p.z) < p.r * 0.86)) continue;
    if (houses.some((h) => Math.abs(x - h.x) < HUT.hx + 0.2 && Math.abs(z - h.z) < HUT.hz + 0.2)) continue;
    tufts.push({ x, z, s: 0.36 + rnd() * 0.4 + Math.min(0.25, worn * 0.04), r: rnd() * 6 });
  }
}

// ---- collision -------------------------------------------------------------------------------
export type Circle = { x: number; z: number; r: number };
export const solids: Circle[] = [
  ...palms.filter((p) => p.solid).map((p) => ({ x: p.x, z: p.z, r: 0.45 })),
  ...fences.flatMap((f) => [-0.75, 0, 0.75].map((k) => ({ x: f.x + Math.cos(f.rot) * k, z: f.z - Math.sin(f.rot) * k, r: 0.45 }))),
  { x: well.x, z: well.z, r: 1.05 },
  { x: balete.x, z: balete.z, r: balete.height * 0.2 },
  { x: firePit.x, z: firePit.z, r: 0.5 },
  ...nodes.filter((n) => n.kind !== "herbs").map((n) => ({ x: n.x, z: n.z, r: 0.45 })),
  { x: trail.marker.x, z: trail.marker.z, r: 0.3 },
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
