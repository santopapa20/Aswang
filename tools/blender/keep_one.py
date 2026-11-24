# Some gallery models hold several copies of the same thing side by side (a "four views" picture turned
# into four birds). This keeps one of them: it looks at the model face-on, groups the mesh into the
# separate copies it can see, and deletes all but the chosen one.
# usage: blender -b --factory-startup --python keep_one.py -- <in.glb> <out.glb> [which=0]
#   which  0 keeps the largest copy, 1 the next largest, and so on
import bpy, sys
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
WHICH = int(argv[2]) if len(argv) > 2 else 0

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1: bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
me = ob.data
co = np.empty(len(me.vertices) * 3, dtype=np.float32)
me.vertices.foreach_get("co", co)
co = co.reshape(-1, 3)
print("VERTS", len(co), "SIZE", (co.max(0) - co.min(0)).round(3))

# look at the model face-on along its two widest directions, mark which squares of a grid hold any mesh,
# and group touching squares: each group is one copy
order = np.argsort(-(co.max(0) - co.min(0)))[:2]
flat = co[:, order]
lo, hi = flat.min(0), flat.max(0)
N = 160
cell = np.minimum(((flat - lo) / (hi - lo) * N).astype(np.int32), N - 1)
grid = np.zeros((N, N), dtype=bool)
grid[cell[:, 0], cell[:, 1]] = True
label = np.zeros((N, N), dtype=np.int32)
sizes = []
for i in range(N):
    for j in range(N):
        if not grid[i, j] or label[i, j]: continue
        n = len(sizes) + 1
        stack, count = [(i, j)], 0
        label[i, j] = n
        while stack:
            a, b = stack.pop(); count += 1
            for da, db in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                x, y = a + da, b + db
                if 0 <= x < N and 0 <= y < N and grid[x, y] and not label[x, y]:
                    label[x, y] = n; stack.append((x, y))
        sizes.append(count)
ranked = [k + 1 for k in np.argsort(-np.array(sizes)) if sizes[k] > N * N * 0.01]
print("COPIES", len(ranked), "squares each", [sizes[k - 1] for k in ranked])
keep = label[cell[:, 0], cell[:, 1]] == ranked[WHICH % len(ranked)]
print("KEEPING", int(keep.sum()), "of", len(co))

for seq in (me.polygons, me.edges): seq.foreach_set("select", np.zeros(len(seq), dtype=bool))
me.vertices.foreach_set("select", ~keep)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_mode(type="VERT")
bpy.ops.mesh.delete(type="VERT")
bpy.ops.object.mode_set(mode="OBJECT")
bpy.ops.object.select_all(action="DESELECT"); ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format="GLB", use_selection=True, export_yup=True)
print("SAVED", OUT, len(ob.data.vertices), "vertices")
