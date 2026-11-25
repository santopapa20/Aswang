# The aswang's kin

The roaming creatures of the night hunts: the dog and the crawler (`game/src/game/Kin.tsx`), and the kin in
human guise, the farmer, the priest and the nurse (`game/src/game/Guise.tsx`). Numbers in `KIN` and `GUISE` in
`game/src/game/data.ts`.
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

## The kin in human guise (`farmer/`, `priest/`, `nurse/`)
Keith's Tripo models "old farmer aswang", "fat priest aswang" and "girl nurse aswang", each shrunk to 20,000
triangles. They walk the paths at night like people and show what they are when garlic is held up to them.

- Rigged as people: `prepare_for_rig.py --keep-fused`, then `rig_humanoid.py`. The landmarks were measured from
  the front and side renders against each model's bounding box.
- The farmer stands in a T-pose with a sickle in one hand and a hatchet in the other, in clothes torn into 73
  loose pieces. Blender's automatic weights cannot solve that body, on the model or on a rebuilt stand-in, so
  `rig_humanoid.py` falls back to weighting each point by its distance to the three nearest bones, then
  smooths the seams.
- The priest stands in a T-pose. The nurse stands with her knees bent and her forearms reaching forward.
- Their motions are the aswang's own Mixamo downloads (`assets/aswang/mixamo/downloads`: `idle`, `walk`, `run`,
  `attack`, `repelled`, `scream`), carried onto each skeleton by `merge_mixamo.py --character`, with the
  travel taken out of all but `idle`.
- `game/farmer.glb` is 1.66 m tall, `game/priest.glb` 1.74 m, `game/nurse.glb` 1.6 m.

Rebuild:

```bash
"$B" -b --factory-startup --python tools/blender/optimize_model.py -- assets/kin/dog/source/dog_tripo.glb assets/kin/dog dog 30000 2048 1024 free
"$B" -b --factory-startup --python tools/blender/turn_model.py -- assets/kin/dog/dog.blend -56.2 assets/kin/dog/dog_turned.blend
"$B" -b --factory-startup --python tools/blender/rig_sigbin.py -- assets/kin/dog/dog_turned.blend assets/kin/dog/rig_landmarks.json assets/kin/dog/game/dog.glb
"$B" -b --factory-startup --python tools/blender/optimize_model.py -- assets/kin/crawler/source/crawler_tripo.glb assets/kin/crawler crawler 35000 2048 1024 free
"$B" -b --factory-startup --python tools/blender/rig_sigbin.py -- assets/kin/crawler/crawler.blend assets/kin/crawler/rig_landmarks.json assets/kin/crawler/game/crawler.glb
for k in farmer:1.66 priest:1.74 nurse:1.6; do n=${k%%:*}; h=${k##*:}
  "$B" -b --factory-startup --python tools/blender/optimize_model.py -- assets/kin/$n/source/${n}_tripo.glb assets/kin/$n $n 20000 2048 1024 free
  "$B" -b --factory-startup --python tools/blender/prepare_for_rig.py -- assets/kin/$n/$n.blend assets/kin/$n/rig_landmarks.json assets/kin/$n/${n}_rigready.blend --keep-fused
  "$B" -b --factory-startup --python tools/blender/rig_humanoid.py -- assets/kin/$n/${n}_rigready.blend assets/kin/$n/rig_landmarks.json assets/kin/$n/${n}_rigged.blend --height $h
  "$B" -b --factory-startup --python tools/blender/merge_mixamo.py -- assets/aswang/mixamo/downloads assets/kin/$n/$n.blend assets/kin/$n/game/$n.glb     --character assets/kin/$n/${n}_rigged.blend --in-place walk,run,attack,repelled,scream
done
```
