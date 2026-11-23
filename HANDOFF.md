# Aswang Night: handoff from the portfolio chat

This file carries everything the game chat needs to continue. It was written on 2026-11-23 when
the game work was moved out of the portfolio-website chat.

## Who and why

Keith is a fresh BSIT graduate in Cebu, Philippines (strongest in Java, Spring Boot, React and
MySQL; comfortable with three.js / React Three Fiber from the 3D portfolio he built). This game is
his next portfolio project. Do not touch the portfolio (`C:\Users\keith\OneDrive\Desktop\web port`)
or Sakay Sugbo (`C:\Users\keith\OneDrive\Desktop\sakay-sugbo`).

## The game

"Aswang Night": top-down 3D survival horror in a remote Visayan barrio in the 1950s. Survive each
night until sunrise (about five minutes). By day you gather supplies; at night creatures from
Philippine folklore hunt you, each with a counter taken from the stories:

- Aswang: looks like a normal villager by day; salt and garlic keep it from a doorway.
- Manananggal: a flying winged upper body; salt on the lower half it left behind ends it.
- Wakwak: its call gets quieter the closer it is.
- Tikbalang: flips your controls until you turn your shirt inside out.
- Kapre: sits in a tree smoking; harmless unless you cross its yard.
- Sigbin: walks backwards.

First playable version: player + aswang + manananggal on one map. Nothing is coded yet and no
engine has been agreed; a browser game with three.js / React Three Fiber fits his skills, but
confirm with him first. His laptop has Intel UHD integrated graphics: keep models around
20-50k triangles each and effects light.

## His quality bar (his words)

"Don't cut corners on the design. Make every asset highly detailed and visually polished so nothing
looks cheap or generic. Go all out with the scary aesthetics, intricate details, premium-quality
visuals, and smooth, impressive animations and effects. Everything should look high-end, cinematic,
and professionally crafted."

He insisted on 3D, not 2D. Be honest about what is and isn't achievable; he decides well from renders.

## Art direction

Fixed by a ChatGPT concept sheet he likes: `assets/concept/asset-sheet.webp`. Realistic and moody;
cold moonlight in deep blue and violet against warm amber kerosene-lamp light. The player's lamp is
a separate object that casts real light, so characters are generated with empty hands.

## Asset pipeline (works on this PC)

Tools: Blender 5.3 at `C:\Program Files\Blender Foundation\Blender 5.3\blender.exe` (run headless:
`blender -b --factory-startup --python script.py -- args`), Node 26, Git Bash, ffmpeg at
`C:\Users\keith\ffmpeg\bin`.

1. **Concept images.** Claude writes the prompt; he generates in ChatGPT. One image per view (front,
   left, right, back), and he wants one prompt per side. Full body, A-pose with arms about 40 degrees
   out, empty hands, soft flat even lighting, plain light-grey background, no text. The player's side
   views came out with the arms hanging down, which reduced accuracy: stress the same A-pose in every
   view. He sends each image to be checked before spending credits.
2. **Tripo** (studio.tripo3d.ai, free plan). Multi-view image-to-3D, quad topology. About 265 credits
   left; 35 per model with "H3.1 Best Quality" (30 otherwise). With quad topology the export has no
   texture and no UV map. Do not have him spend credits on Texture, Rig, Retopo or Smart UV. The
   one-time "Generate in Parts" trial is used up, so the next models arrive as a single piece.
3. **Colour, free, in Blender.** `tools/blender/project_texture.py <model.glb> <ref_dir> <out_dir>`
   projects the four reference pictures onto the model and bakes a 2048 texture. `ref_dir` needs
   `front.png`, `back.png`, `right.png`, `left.png`; "right" shows the character's own right side
   (he faces the right edge of the picture). The model faces -Y in Blender and the character's right
   is -X. `render_views.py` and `check_mesh.py` render and inspect a model.

## What exists

- `assets/player/player_textured.glb`: the coloured player (48,654 triangles, one object "Player",
  2048 texture, 3.9 MB). `player_textured.blend` is the same as a Blender file.
- `assets/player/preview.png`: five-angle check render he has seen and accepted.
- `assets/player/reference/`: his four view images.
- The two untextured Tripo exports (parts and single-piece).

Known weak spots of the player, already explained to him: areas no picture could see (inner arms,
between the legs, top of head and shoulders, between fingers) have borrowed, smoother colour, and
the face is slightly soft. It has no skeleton and no animation. Its parts are open shells that meet
at their edges, so small gaps may open when it bends. The garlic braid and the sash are separate
parts and should follow the hips.

## Animation plan (not started)

- Human-shaped characters (player, aswang, tikbalang): Mixamo for motion-captured movement. Free,
  but it needs his own Adobe login: Claude converts GLB to FBX, he uploads, places the markers and
  downloads the animations, Claude merges them back into one trimmed GLB.
- Non-human ones (manananggal wings and hover, kapre breathing and cigar): rigged and animated by
  script in Blender.

He was last asked whether to animate the player next or do the aswang first, and had not answered.
A transformed-aswang concept prompt has already been given to him; he may arrive with those images.

## How he works

Short messages, often with a screenshot or a file path. Plain-language explanations, honest reports
of what was and wasn't checked, and renders he can look at. His GitHub user is santopapa20; plain
`git push` works, the GitHub CLI is not installed, and creating a repo needs him to do it in his
browser. Nothing in this folder is under git or pushed yet.

## First piece of work for the game chat

1. Greet him briefly, confirm what is in this folder, and ask the open question: animate the player
   now, or wait for the aswang model first.
2. Inspect the player in headless Blender (vertex groups `part_NN`, where the parts meet, whether
   the A-pose is clean enough to rig).
3. Prepare the Mixamo route: export an FBX Mixamo will accept into `assets/player/mixamo/`, and give
   him a short step-by-step (markers; animations to download: idle, walk, run, sneak, a frightened
   look-around, a fall or "caught" reaction; "in place" where offered).
4. Build a simple test rig in Blender and pose a few walk frames to check how the mesh deforms: gaps
   between parts at shoulders, elbows, hips and knees; the garlic and sash stretching. Render a sheet
   and show it with an honest verdict. This is a deformation test, not the final animation.
5. Put the folder under git on `main` with a `.gitignore` and a short `README.md`. Commit locally;
   do not push.
6. Do not start coding the game until the engine and scope are agreed with him.
