# Amalanhig

One who was aswang and died without passing it on, so it cannot rest. Two lie in the old sitio's graveyard
and rise after dark when the player comes near. It is the one thing in the game he can fight.

- `source/amalanhig_tripo.glb`: the Tripo model as Keith generated it (not committed; raw files are large).
- `amalanhig.blend`, `amalanhig.glb`: shrunk to 40,000 triangles with `tools/blender/optimize_model.py` (`free`).
- `rig_landmarks.json`: joint positions, measured with `tools/blender/slice_model.py` and the renders. It stands
  in a symmetric wide A-pose, so the right side is mirrored from the left.
- `amalanhig_rigready.blend`, `amalanhig_rigged.blend`: `prepare_for_rig.py --keep-fused`, then
  `rig_humanoid.py --height 1.75`, then `fix_stray_weights.py 0.14 4`. Automatic weights tied the rags at its
  hips to its hands (they hang side by side in the rest pose), so they stretched into spikes when the arms
  lifted; the fix takes arm weight away from anything more than 14 cm from the arm and smooths the seam.
- `game/amalanhig.glb`: the game file, with clips `idle` (3 s), `walk` (1.3 s), `grab` (1 s) and `hit` (0.8 s),
  written by hand by `tools/blender/anim_amalanhig.py`. Its joints have set, so the walk swings straight
  legs from the hip with locked knees and the body rocks over them, arms held out in front.

Rising from the grave and falling when beaten are done in the game (`game/src/game/Amalanhig.tsx`): the
whole body tips about its heels like a plank. In the game it turns slowly (1.1 radians a second), so
stepping aside and running beats it; a salt line stops it; the whip knocks it back, and three blows lay it
down for the night and give up what it was buried with. If it gets its hands on him, the night is lost.

Rebuild:

```bash
"$B" -b --factory-startup --python tools/blender/optimize_model.py -- assets/amalanhig/source/amalanhig_tripo.glb assets/amalanhig amalanhig 40000 2048 1024 free
"$B" -b --factory-startup --python tools/blender/prepare_for_rig.py -- assets/amalanhig/amalanhig.blend assets/amalanhig/rig_landmarks.json assets/amalanhig/amalanhig_rigready.blend --keep-fused
"$B" -b --factory-startup --python tools/blender/rig_humanoid.py -- assets/amalanhig/amalanhig_rigready.blend assets/amalanhig/rig_landmarks.json assets/amalanhig/amalanhig_rigged.blend --height 1.75
"$B" -b --factory-startup --python tools/blender/fix_stray_weights.py -- assets/amalanhig/amalanhig_rigged.blend 0.14 4
"$B" -b --factory-startup --python tools/blender/anim_amalanhig.py -- assets/amalanhig/amalanhig_rigged.blend assets/amalanhig/game/amalanhig.glb
```
