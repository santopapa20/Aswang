// Prints the size of every model in public/models (width, height, depth in the model's own units, Y up),
// read from the files themselves. Used to set collision sizes in src/game/layout.ts to match what is drawn.
//   node scripts/sizes.mjs
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "models");
const mul = (a, b) => { const o = new Array(16).fill(0); for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) for (let k = 0; k < 4; k++) o[c * 4 + r] += a[k * 4 + r] * b[c * 4 + k]; return o; };
const trs = (n) => {
  if (n.matrix) return n.matrix;
  const [x, y, z, w] = n.rotation ?? [0, 0, 0, 1], [sx, sy, sz] = n.scale ?? [1, 1, 1], [tx, ty, tz] = n.translation ?? [0, 0, 0];
  return [(1 - 2 * (y * y + z * z)) * sx, 2 * (x * y + z * w) * sx, 2 * (x * z - y * w) * sx, 0, 2 * (x * y - z * w) * sy, (1 - 2 * (x * x + z * z)) * sy, 2 * (y * z + x * w) * sy, 0, 2 * (x * z + y * w) * sz, 2 * (y * z - x * w) * sz, (1 - 2 * (x * x + y * y)) * sz, 0, tx, ty, tz, 1];
};
for (const f of readdirSync(dir).filter((f) => f.endsWith(".glb")).sort()) {
  const buf = readFileSync(join(dir, f));
  const json = JSON.parse(buf.subarray(20, 20 + buf.readUInt32LE(12)).toString("utf8"));
  const lo = [1e9, 1e9, 1e9], hi = [-1e9, -1e9, -1e9];
  let tris = 0;
  const walk = (i, m) => {
    const n = json.nodes[i], w = mul(m, trs(n));
    if (n.mesh !== undefined && n.skin === undefined) for (const p of json.meshes[n.mesh].primitives) {
      const a = json.accessors[p.attributes.POSITION];
      tris += (p.indices !== undefined ? json.accessors[p.indices].count : a.count) / 3;
      for (let c = 0; c < 8; c++) {
        const v = [c & 1 ? a.max[0] : a.min[0], c & 2 ? a.max[1] : a.min[1], c & 4 ? a.max[2] : a.min[2]];
        for (let k = 0; k < 3; k++) { const q = w[k] * v[0] + w[4 + k] * v[1] + w[8 + k] * v[2] + w[12 + k]; lo[k] = Math.min(lo[k], q); hi[k] = Math.max(hi[k], q); }
      }
    }
    for (const c of n.children ?? []) walk(c, w);
  };
  for (const r of json.scenes[json.scene ?? 0].nodes) walk(r, [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1]);
  if (lo[0] > hi[0]) { console.log(f.padEnd(18), "(skinned)"); continue; }
  const d = hi.map((h, k) => h - lo[k]);
  console.log(f.padEnd(18), `x ${d[0].toFixed(2)}  y ${d[1].toFixed(2)}  z ${d[2].toFixed(2)}   tris ${Math.round(tris)}   ${(buf.length / 1e6).toFixed(1)} MB`);
}
