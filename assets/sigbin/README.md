# Sigbin

Her hound: a gaunt, hairless thing on four legs with a rat's tail, let out on the last night.

| File | What it is |
| --- | --- |
| `source/sigbin_tripo.glb` | The model as it came from Tripo (92,106 triangles). Not committed |
| `sigbin.blend`, `sigbin.glb` | Reduced to 36,000 triangles by `tools/blender/optimize_model.py` |
| `rig_landmarks.json` | Where its joints are, measured on the model |
| `game/sigbin.glb` | The file the game loads: skeleton and four clips (idle, walk, run, feed) |
| `game/pose_check.png` | Side and three-quarter frames of the walk, to check the rig by eye |

It goes on four legs, so Mixamo cannot animate it. `tools/blender/rig_sigbin.py` builds the skeleton
(23 bones) and writes the motion by hand. Each paw follows a target on the ground, so a planted paw
stays planted, and the result is saved as plain bone rotations.

Rebuild:

```
blender -b --factory-startup --python tools/blender/rig_sigbin.py -- assets/sigbin/sigbin.blend assets/sigbin/rig_landmarks.json assets/sigbin/game/sigbin.glb
cd game && npm run sync-assets
```

Size in the game: 1.63 m nose to tail tip, 0.96 m at the rump (`scale_to_metres` in the landmarks
file). The walk covers 0.97 m a second and the run 2.4; `game/src/game/Sigbin.tsx` uses those two
numbers to keep the paws from sliding, and plays the walk in reverse because the sigbin walks tail first.
