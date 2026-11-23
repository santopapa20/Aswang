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
  ["hut", join("assets", "village", "hut.glb")],
  ["fence", join("assets", "village", "fence.glb")],
];
for (const [name, rel] of files) {
  const src = join(root, rel);
  if (!existsSync(src)) { console.warn(`missing ${src}`); continue; }
  copyFileSync(src, join(out, `${name}.glb`));
  console.log(`synced ${name}.glb (${(statSync(src).size / 1e6).toFixed(1)} MB)`);
}
