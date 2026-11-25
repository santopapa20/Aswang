# Stake fence

The fence round Rosing's yard that the player makes at the bench (the "Stake fence" recipe,
`hedge` in `game/src/game/data.ts`). Drawn by `game/src/game/World.tsx` along `stakes` in `layout.ts`, nine
panels 1.15 m wide (about 1.5 m tall), only once it is made.

- `source/hedge/hedge_tripo.glb` (in `assets/village/source/`, not committed): Keith's Tripo model "spiky
  fences", three panels of sharpened stakes lined up one behind another: a whole one, a broken one and a
  charred one, 318 loose parts in all.
- `stakes.glb`: the whole panel only, 1,824 triangles, texture 1024 px, by `tools/blender/keep_piece.py`, which
  groups the loose parts by where their centres fall along the axis they are lined up on and keeps one group.

Rebuild:

```bash
"$B" -b --factory-startup --python tools/blender/keep_piece.py -- assets/village/source/hedge/hedge_tripo.glb assets/village/stakes/stakes.glb 0 1024
cp assets/village/stakes/stakes.glb game/public/models/stakes.glb
```
