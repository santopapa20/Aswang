# Player → Mixamo, step by step

Upload file: `player_for_mixamo.fbx` in this folder (one mesh, 1.65 m tall, texture embedded).
Mixamo is free but needs your own Adobe login. Nothing here costs Tripo credits.

## 1. Upload

1. Go to mixamo.com and sign in.
2. Click **Upload Character** and choose `player_for_mixamo.fbx`.
3. He should appear standing upright, facing you. If he is lying down or facing away, use the
   rotate arrows under the preview until he faces you, then **Next**.
4. If he shows up plain grey instead of coloured, carry on anyway. The colour is put back when the
   files are merged.

## 2. Place the markers

Leave **Use Symmetry** ticked. Drag each circle onto the model:

| Marker | Where on this character |
| --- | --- |
| Chin | On the tip of his chin |
| Wrists | The narrowest part of each arm, just above the hand |
| Elbows | Right at the edge of the rolled-up sleeves |
| Knees | Just above the rolled trouser cuffs (his knees are hidden by the baggy trousers) |
| Groin | Halfway between the bottom of the sash and the point where the trouser legs split. Not at the split itself: the trousers hang low, his real hips are higher |

**Skeleton LOD:** choose **No Fingers (25)**. Then **Next** and wait for the rig (about two minutes).

Check the preview animation before accepting: knees should bend at the cuffs, elbows at the sleeve
edge. If a joint bends in the wrong place, go back and move that marker. Send a screenshot if unsure.

## 3. Download the animations

Search for each one, click it, tick **In Place** where that box is offered, then **Download**.
Names in Mixamo's library vary, so pick the one that looks right for a scared barrio boy at night.

| Clip | Try searching | In Place |
| --- | --- | --- |
| idle | "breathing idle" or "idle" | n/a |
| walk | "walking" | tick |
| run | "running" or "slow run" | tick |
| sneak | "crouch walk" or "sneak" | tick |
| look around | "looking around" or "terrified" | n/a |
| caught / fall | "falling back death", "stumble backwards" or "dying" | n/a |

Download settings for every clip: **Format: FBX Binary (.fbx)**, **Frames per second: 30**,
**Keyframe Reduction: none**.

- The **first** one (idle): **Skin: With Skin**.
- All the **others**: **Skin: Without Skin** (much smaller files).

## 4. Put them here

Save all the downloaded `.fbx` files into `assets/player/mixamo/downloads/` and name them
`idle.fbx`, `walk.fbx`, `run.fbx`, `sneak.fbx`, `look.fbx`, `caught.fbx`. Then say they are there.

They then get merged into one `player.glb` with named clips and WebP textures. On this model the
garlic braid and sash tails are part of the trousers, so they follow the leg; a small sway can be
added to them afterwards.
