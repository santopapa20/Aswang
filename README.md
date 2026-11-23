# Aswang Night

A top-down 3D survival horror game set in a remote Visayan barrio in the 1950s. Survive each night
until sunrise while creatures from Philippine folklore (aswang, manananggal, wakwak, tikbalang,
kapre, sigbin) hunt you, each beaten by the counter the old stories give.

Status: asset production. The player is rigged and animated (`assets/player/game/player.glb`, six clips:
idle, look, walk, run, sneak, caught) and so is the aswang (`assets/aswang/game/aswang.glb`, six clips:
idle, walk, run, attack, scream, repelled).
No game code yet; the engine and scope are still to be agreed. Full background is in `HANDOFF.md`.

Current models: `assets/player/player_v2*` (Tripo-textured, the one in use) and `assets/aswang/aswang*`.
The older `player_textured` / `player_rigready` files are the first player; they are kept because the
new one borrows its garlic and sash labels and its test skin weights from them.

## Folders

- `assets/concept/` art direction sheet
- `assets/player/` the player: reference images, Tripo exports, coloured model, rig-ready model
- `assets/player/mixamo/` the file to upload to Mixamo and the upload steps (`README.md` there)
- `assets/player/rig_test/` renders from the bend test
- `tools/blender/` the asset scripts

## Asset pipeline

1. Four concept images per character (front, back, left, right; same A-pose, empty hands).
2. Tripo turns them into an untextured shape.
3. Blender scripts colour it and prepare it for animation.
4. Mixamo supplies the skeleton and motion for human-shaped characters.

## Running the tools

All scripts run in headless Blender 5.3 from this folder (Git Bash shown):

```bash
B="/c/Program Files/Blender Foundation/Blender 5.3/blender.exe"

# colour a Tripo model from its four reference images (front/back/left/right.png)
"$B" -b --factory-startup --python tools/blender/project_texture.py -- <model.glb> <ref_dir> <out_dir>

# inspect: triangle counts and open edges / what the parts are and where they meet
"$B" -b --factory-startup --python tools/blender/check_mesh.py -- <model.glb>
"$B" -b --factory-startup --python tools/blender/inspect_parts.py -- <model.blend|glb>

# a Tripo model that already has its own texture: report + flat-lit renders from five angles and a face close-up
"$B" -b --factory-startup --python tools/blender/render_textured.py -- <model.glb> <out_prefix>

# make a textured Tripo model game-sized (about 45k triangles, 2048 colour texture, WebP)
"$B" -b --factory-startup --python tools/blender/optimize_model.py -- <tripo.glb> <out_dir> <name> 45000

# quick grey renders from four angles
"$B" -b --factory-startup --python tools/blender/render_views.py -- <model.glb> <out_prefix> <single|random>

# close the surface, mark the hanging props, save the rig-ready file and (optional) a Mixamo FBX
"$B" -b --factory-startup --python tools/blender/prepare_for_rig.py -- \
  assets/player/player_v2.blend assets/player/rig_landmarks.json assets/player/player_v2_rigready.blend \
  --labels-from assets/player/player_textured.blend --keep-fused \
  --fbx assets/player/mixamo/player_for_mixamo.fbx --height 1.65

# bend test: throwaway skeleton, a few poses, renders (mode: auto | rigid | follow)
"$B" -b --factory-startup --python tools/blender/test_rig.py -- \
  assets/player/player_v2_rigready.blend assets/player/rig_landmarks.json <out_dir> auto \
  assets/player/player_rigready.blend
```

```bash
# merge Mixamo downloads (one "With Skin", the rest without) into one animated GLB with named clips
"$B" -b --factory-startup --python tools/blender/merge_mixamo.py --   assets/player/mixamo/downloads assets/player/player_v2.blend assets/player/game/player.glb

# render every clip of an animated GLB to frames (then ffmpeg makes a video or contact sheet)
"$B" -b --factory-startup --python tools/blender/preview_clips.py -- assets/player/game/player.glb <out_dir>
```

`rig_landmarks.json` holds a character's measured joint positions and names which parts are hanging
props. Each new character needs its own.
