# Kapre

A three-metre giant who stands in the roots of the balete after dark, smoking.

- `source/kapre_tripo.glb`: the Tripo model as Keith exported it (not committed; raw files are large).
- `kapre.blend`, `kapre.glb`: shrunk to 50,000 triangles with `tools/blender/optimize_model.py`.
- `rig_landmarks.json`: joint positions measured on the model.
- `kapre_rigged.blend`: the skeleton, built here with `tools/blender/rig_humanoid.py` (the same route as
  the tikbalang; nothing was uploaded to Mixamo for this one).
- `mixamo/downloads/`: three Mixamo motions reused from the tikbalang (Orc Idle, Orc Walk, Mutant Roaring).
- `game/kapre.glb`: the game file, with clips `idle`, `walk` and `roar`. `game/pose_check.png` shows them.

Rebuild:

```bash
"$B" -b --factory-startup --python tools/blender/rig_humanoid.py -- \
  assets/kapre/kapre_rigready.blend assets/kapre/rig_landmarks.json assets/kapre/kapre_rigged.blend --height 3.0
"$B" -b --factory-startup --python tools/blender/merge_mixamo.py -- assets/kapre/mixamo/downloads \
  assets/kapre/kapre.blend assets/kapre/game/kapre.glb --character assets/kapre/kapre_rigged.blend --in-place roar
```

In the game he only uses `idle` and `roar`. `walk` is there for when he needs to come down from the tree.
He has no finger bones, and no cigar model: the cigar is a glowing ember placed in front of his mouth.
