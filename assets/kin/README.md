# The aswang's kin

The roaming creatures of the night hunts (`game/src/game/Kin.tsx`, numbers in `KIN` in `game/src/game/data.ts`).
Both were downloaded by Keith from Tripo; the raw files sit in each `source/` folder (not committed).

Both are rigged on four legs by `tools/blender/rig_sigbin.py`, the sigbin's script, which builds the skeleton,
skins it and writes the motion with each paw following a target on the ground. Their landmarks ask for the
clips `idle`, `walk`, `run`, `bite` and `hit`.

## Zombie dog (`dog/`)
- `dog.blend`, `dog.glb`: shrunk to 30,000 triangles with `optimize_model.py` (`free`).
- `dog_turned.blend`: the model stands at an angle in its file, so `tools/blender/turn_model.py` turns it
  -56.2 degrees to face -Y. The landmarks are measured on this one.
- `game/dog.glb`: 1.0 m nose to tail, 0.76 m tall.

## Crawler (`crawler/`)
- `crawler.blend`, `crawler.glb`: shrunk to 35,000 triangles.
- A man gone on all fours: the arms are rigged as forelegs and the legs as hind legs. One foot is forward
  and one back, so the right leg's joints are listed on their own (`"right"` in the landmarks).
- `game/crawler.glb`: 0.93 m tall, 1.4 m across the hands.

Rebuild:

```bash
"$B" -b --factory-startup --python tools/blender/optimize_model.py -- assets/kin/dog/source/dog_tripo.glb assets/kin/dog dog 30000 2048 1024 free
"$B" -b --factory-startup --python tools/blender/turn_model.py -- assets/kin/dog/dog.blend -56.2 assets/kin/dog/dog_turned.blend
"$B" -b --factory-startup --python tools/blender/rig_sigbin.py -- assets/kin/dog/dog_turned.blend assets/kin/dog/rig_landmarks.json assets/kin/dog/game/dog.glb
"$B" -b --factory-startup --python tools/blender/optimize_model.py -- assets/kin/crawler/source/crawler_tripo.glb assets/kin/crawler crawler 35000 2048 1024 free
"$B" -b --factory-startup --python tools/blender/rig_sigbin.py -- assets/kin/crawler/crawler.blend assets/kin/crawler/rig_landmarks.json assets/kin/crawler/game/crawler.glb
```
