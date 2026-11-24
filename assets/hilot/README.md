# The hilot

The old sitio's midwife. By day she stands in her yard at the foot of her ladder; after dark she keeps
indoors, and on the third night she opens her door to the player's call and answers from the threshold.

- `source/hilot_tripo.glb`: the Tripo model as Keith generated it (not committed; raw files are large).
- `hilot.blend`, `hilot.glb`: shrunk to 45,000 triangles with `tools/blender/optimize_model.py` (`free`).
- `rig_landmarks.json`: joint positions, measured with `tools/blender/slice_model.py` and the front and side
  renders. She stands in a symmetric A-pose, so the right side is mirrored from the left. Her legs are
  inside an ankle-length patadyong; the hip and knee joints are placed where the feet say they must be.
- `hilot_rigready.blend`, `hilot_rigged.blend`: `prepare_for_rig.py --keep-fused`, then `rig_humanoid.py --height 1.52`.
- `mixamo/downloads/`: three Mixamo motions reused from the aswang's human form (idle, look, walk).
- `game/hilot.glb`: the game file, with clips `idle` (6 s), `look` (6.3 s) and `walk` (1.2 s).

The game uses `idle`, turns her head toward the player and nods it while she speaks
(`game/src/game/Hilot.tsx`). `walk` is there for when she needs to come down to Rosing's house.

Rebuild:

```bash
"$B" -b --factory-startup --python tools/blender/optimize_model.py -- assets/hilot/source/hilot_tripo.glb assets/hilot hilot 45000 2048 1024 free
"$B" -b --factory-startup --python tools/blender/prepare_for_rig.py -- assets/hilot/hilot.blend assets/hilot/rig_landmarks.json assets/hilot/hilot_rigready.blend --keep-fused
"$B" -b --factory-startup --python tools/blender/rig_humanoid.py -- assets/hilot/hilot_rigready.blend assets/hilot/rig_landmarks.json assets/hilot/hilot_rigged.blend --height 1.52
"$B" -b --factory-startup --python tools/blender/merge_mixamo.py -- assets/hilot/mixamo/downloads assets/hilot/hilot.blend assets/hilot/game/hilot.glb --character assets/hilot/hilot_rigged.blend
```
