# Nong Kadyo

The barrio's albularyo. He stands at the foot of his ladder day and night, a stick in his right hand and a
lamp held up in his left.

- `source/kadyo_tripo.glb`: the Tripo model as Keith generated it (not committed; raw files are large).
- `kadyo.blend`, `kadyo.glb`: shrunk to 45,000 triangles with `tools/blender/optimize_model.py` (`free`).
- `rig_landmarks.json`: joint positions, measured with `tools/blender/slice_model.py`. He stands lopsided,
  so his right side is listed on its own under `right` instead of being mirrored from the left.
- `kadyo_rigready.blend`, `kadyo_rigged.blend`: `prepare_for_rig.py --keep-fused`, then `rig_humanoid.py --height 1.58`.
- `game/kadyo.glb`: the game file, with clips `idle` (5 s) and `talk` (3 s), written by `tools/blender/anim_kadyo.py`.

He keeps the pose he was modelled in. Ready-made Mixamo motions assume arms held out and would bend his stick
and swing the lamp through him, so his motions are written by hand and only move what an old man standing
still moves. The game turns his head toward the player on top of them and lights his lamp after dark
(`game/src/game/Kadyo.tsx`).

Rebuild:

```bash
"$B" -b --factory-startup --python tools/blender/prepare_for_rig.py -- assets/kadyo/kadyo.blend assets/kadyo/rig_landmarks.json assets/kadyo/kadyo_rigready.blend --keep-fused
"$B" -b --factory-startup --python tools/blender/rig_humanoid.py -- assets/kadyo/kadyo_rigready.blend assets/kadyo/rig_landmarks.json assets/kadyo/kadyo_rigged.blend --height 1.58
"$B" -b --factory-startup --python tools/blender/anim_kadyo.py -- assets/kadyo/kadyo_rigged.blend assets/kadyo/game/kadyo.glb
```
