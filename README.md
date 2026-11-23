# Aswang Night

A top-down 3D survival horror game set in a remote Visayan barrio in the 1950s. Survive each night
until sunrise while creatures from Philippine folklore (aswang, manananggal, wakwak, tikbalang,
kapre, sigbin) hunt you, each beaten by the counter the old stories give.

Status: asset production. The player character is modelled, coloured and prepared for rigging.
No game code yet; the engine and scope are still to be agreed. Full background is in `HANDOFF.md`.

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

# weld seams, detach and cap hanging props, save the rig-ready file and (optional) a Mixamo FBX
"$B" -b --factory-startup --python tools/blender/prepare_for_rig.py -- \
  assets/player/player_textured.blend assets/player/rig_landmarks.json \
  assets/player/player_rigready.blend assets/player/mixamo/player_for_mixamo.fbx 1.65

# bend test: throwaway skeleton, a few poses, renders (mode: auto | rigid | follow)
"$B" -b --factory-startup --python tools/blender/test_rig.py -- \
  assets/player/player_rigready.blend assets/player/rig_landmarks.json <out_dir> rigid
```

`rig_landmarks.json` holds a character's measured joint positions and names which parts are hanging
props. Each new character needs its own.
