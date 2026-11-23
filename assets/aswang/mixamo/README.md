# Aswang → Mixamo

Upload file: `aswang_for_mixamo.fbx` in this folder (one mesh, 1.70 m tall, textures embedded).
The steps are the same as for the player (`assets/player/mixamo/README.md`). What differs:

## Markers

Leave **Use Symmetry** ticked.

| Marker | Where on her |
| --- | --- |
| Chin | Tip of the chin |
| Wrists | The thin part of the arm just above each clawed hand |
| Elbows | The bony elbow, a little below the ragged sleeve |
| Knees | The kneecaps, just under the torn hem of the skirt |
| Groin | Under the skirt, about one third of the way down from the waist wrap to the hem |

**Skeleton LOD: Standard Skeleton (65)** for her, so the long claws can curl. If the fingers come
out twisted in the preview, go back and choose **No Fingers (25)**.

## Animations

| Clip | Try searching | In Place |
| --- | --- | --- |
| idle | "zombie idle" | n/a |
| walk | "zombie walk" or "creeping" | tick |
| run | "zombie run" or "mutant run" | tick |
| attack | "zombie attack" | n/a |
| scream | "zombie scream" | n/a |
| repelled | "zombie reaction hit" (for salt and garlic) | n/a |

Settings: **FBX Binary**, **30 fps**, **Keyframe Reduction: none**. First clip **With Skin**, the
rest **Without Skin**. Save into `assets/aswang/mixamo/downloads/` as `idle.fbx`, `walk.fbx`,
`run.fbx`, `attack.fbx`, `scream.fbx`, `repelled.fbx`.

Expect her long hair to look stiff or stretched in Mixamo's preview. That is fixed afterwards by
giving the hair its own bones; it is not a reason to stop.

## What was actually downloaded (2026-11-23)

Skeleton: Standard Skeleton (65), fingers included. Clips: `idle` = Zombie Idle (alert),
`walk` = Zombie Walk (in place), `run` = Zombie Running (in place), `attack` = Zombie Attack
(overhead two-hand), `scream` = Zombie Scream, `repelled` = Zombie Reaction Hit (stumble back).
Merged into `assets/aswang/game/aswang.glb` with `tools/blender/merge_mixamo.py`.
