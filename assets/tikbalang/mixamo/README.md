# Tikbalang and Mixamo

Mixamo's auto-rigger refuses this body. Six tries (markers re-placed, chin moved, no fingers, symmetry
off) all ended in "Unknown error while generating motion". Blender's own automatic skinning failed on
the raw surface too, so the likely cause is the mesh itself (inner shells or folds from the AI
generator), not the horse head.

So the skeleton is built here instead:

1. `tools/blender/rig_humanoid.py` builds a 22-bone skeleton with Mixamo's bone names from the joints
   in `../rig_landmarks.json`, and skins the model through a rebuilt stand-in surface.
   Result: `../tikbalang_rigged.blend` (2.3 m tall). No finger bones: each hand moves as one piece.
2. The motions in `downloads/` are ordinary Mixamo clips, downloaded "Without Skin" while the aswang's
   human form was the active character (any rigged character works):

   | clip   | Mixamo motion  | notes    |
   |--------|----------------|----------|
   | idle   | Orc Idle       |          |
   | walk   | Orc Walk       | In Place |
   | run    | Mutant Run     | In Place |
   | attack | Mutant Swiping |          |
   | roar   | Mutant Roaring |          |

3. `tools/blender/merge_mixamo.py ... --character ../tikbalang_rigged.blend` carries each motion onto
   the tikbalang's own skeleton and writes `../game/tikbalang.glb`.

`tikbalang_for_mixamo.fbx` is the file that was uploaded to Mixamo. It is kept only as a record.
