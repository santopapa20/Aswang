# Aswang

A top-down 3D survival horror game set in a remote Visayan barrio in the 1950s. Survive each night
until sunrise while creatures from Philippine folklore (aswang, manananggal, tikbalang,
kapre, sigbin, amalanhig, and the aswang's kin) hunt you, each beaten by the counter the old stories give.

**Play it:** https://santopapa20.github.io/Aswang/ (a computer with a keyboard, or a phone held sideways).

Keep your sister Rosing and her unborn child alive for five nights in a Capiz barrio in 1953. By day you
gather, trade with Nong Kadyo, make things at the bench and do favours; at dusk you lay salt and garlic
at the door and windows; at night you keep the house while the aswang, the manananggal, her kin and
worse come for it. Press **?** in the game (or "How to play" on the title) for the full guide.

Status: playable start to finish, with five endings. Checked by script, not yet by a person playing by
hand (see `docs/BUGS.md`). What is in the game, and how each part was tested: `docs/GAME_PLAN.md`.

## Running the game

```bash
cd game
npm install      # first time only
npm run dev      # then open http://localhost:5173
```

WASD or arrows to move, Shift to run, C to sneak. Hold E to use, search or talk; hold G at a door or window to protect it, or near a night walker to hold up garlic. Q pours a line of salt, F shutters the lamp, R cracks the whip, V strikes with the itak, Z throws a salt pouch, X lights a smudge bundle, H (held) eats herbs, T (held) turns your shirt inside out. Tab opens the bag, Esc pauses, ? opens the guide, M mutes. On a phone: the left half of the screen is a stick, the buttons on the right do what can be done now.
`npm run dev` first copies the finished models from `assets/` into `game/public/models/`.

Checking the game without playing it (the dev server must be running; needs Edge or Chrome installed):

```bash
npm run selftest   # plays all five nights by script and prints a pass/fail list
npm run shots      # photographs the main screens into game/shots/
node scripts/touch.mjs     # plays the touch controls on an emulated phone
node scripts/levels.mjs    # meters the sound in six situations
```

Other measuring scripts in `game/scripts/` (each explains itself at the top): `duel.mjs` (fights),
`economy.mjs` (coins), `frames.mjs`, `prodfps.mjs`, `drawcount.mjs`, `bound.mjs`, `hitch.mjs`, `soak.mjs`
(frame rate, stalls and memory).

## Putting it online

The site is the built game on the `gh-pages` branch (the models are not in the repository, so GitHub
cannot build it): build, check out `gh-pages` in a separate folder, replace its files with `game/dist` plus a
`.nojekyll` file, commit and push. Each deploy is a new commit on that branch. Vite's `base` is `./`, so the same build works at
`/Aswang/`.

Any single state can be opened in a browser too: `http://localhost:5173/#shot=roof` (the names are in `game/src/devshots.ts`).

## Folders

- `assets/concept/` art direction sheet
- `assets/player/` the player: reference images, Tripo exports, coloured model, rig-ready model
- `assets/player/mixamo/` the file to upload to Mixamo and the upload steps (`README.md` there)
- `assets/player/rig_test/` renders from the bend test
- `assets/village/` hut and fence exported from Tripo's community gallery (wooden thatched hut by LégioFr,
  bamboo fence; credit the creators), shrunk with `optimize_model.py`
- `game/` the browser game (Vite, React, three.js via React Three Fiber)
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

# a body Mixamo's auto-rigger refuses (the tikbalang): build the same skeleton here from measured joints,
# then merge with --character. The motions are downloaded "Without Skin" on any Mixamo character.
"$B" -b --factory-startup --python tools/blender/rig_humanoid.py -- \
  assets/tikbalang/tikbalang_rigready.blend assets/tikbalang/rig_landmarks.json assets/tikbalang/tikbalang_rigged.blend --height 2.3
"$B" -b --factory-startup --python tools/blender/merge_mixamo.py -- assets/tikbalang/mixamo/downloads \
  assets/tikbalang/tikbalang.blend assets/tikbalang/game/tikbalang.glb --character assets/tikbalang/tikbalang_rigged.blend \n  --in-place attack,roar

# render every clip of an animated GLB to frames (then ffmpeg makes a video or contact sheet)
"$B" -b --factory-startup --python tools/blender/preview_clips.py -- assets/player/game/player.glb <out_dir>
```

`rig_landmarks.json` holds a character's measured joint positions and names which parts are hanging
props. Each new character needs its own.
