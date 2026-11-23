// Copies the finished character files from the asset pipeline into the game's public folder.
// The game never edits them; re-run after rebuilding a character (npm run sync-assets).
import { copyFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const out = join(root, "game", "public", "models");
mkdirSync(out, { recursive: true });
const files = [
  ["player", join("assets", "player", "game", "player.glb")],
  ["aswang", join("assets", "aswang", "game", "aswang.glb")],
  ["aswang_human", join("assets", "aswang_human", "game", "aswang_human.glb")],
  ["manananggal", join("assets", "manananggal", "game", "manananggal.glb")],
  ["lower_half", join("assets", "manananggal", "lower_half.glb")],
  ["tikbalang", join("assets", "tikbalang", "game", "tikbalang.glb")],
  ["hut", join("assets", "village", "hut.glb")],
  ["fence", join("assets", "village", "fence.glb")],
  ["palm", join("assets", "village", "palm.glb")],
  ["well", join("assets", "village", "well.glb")],
  ["balete", join("assets", "village", "balete.glb")],
  ["rosary", join("assets", "items", "rosary.glb")],
  ["lantern", join("assets", "items", "lantern.glb")],
  ["garlic", join("assets", "items", "garlic.glb")],
  ...["chest", "pot", "sack", "rocks", "logs", "fern", "shrub"].map((n) => [n, join("assets", "props", `${n}.glb`)]),
];
for (const [name, rel] of files) {
  const src = join(root, rel);
  if (!existsSync(src)) { console.warn(`missing ${src}`); continue; }
  copyFileSync(src, join(out, `${name}.glb`));
  console.log(`synced ${name}.glb (${(statSync(src).size / 1e6).toFixed(1)} MB)`);
}
