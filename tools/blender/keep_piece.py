# Keeps one of the separate pieces of a model that holds several things side by side (a set of fence
# panels), counted from -X or -Y along the axis they are lined up on, and stands it on the origin: centred in X and Y, its base at
# Z = 0. The texture is kept, shrunk to `tex` pixels. Where keep_one.py looks for copies in a picture, this
# goes by the mesh's own loose parts, so it needs the pieces to be truly apart.
# usage: blender -b --factory-startup --python keep_piece.py -- <in.glb> <out.glb> [which=0] [tex=1024]
import bpy, bmesh, sys, os
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
WHICH = int(argv[2]) if len(argv) > 2 else 0
TEX = int(argv[3]) if len(argv) > 3 else 1024

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1: bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
bpy.ops.mesh.separate(type="LOOSE")
bpy.ops.object.mode_set(mode="OBJECT")

# a panel is many loose parts (each stake, each lashing): group them by where they overlap along X
parts = [o for o in bpy.context.scene.objects if o.type == "MESH"]
def box(o):
    ws = [o.matrix_world @ v.co for v in o.data.vertices]
    return Vector((min(w.x for w in ws), min(w.y for w in ws), min(w.z for w in ws))), Vector((max(w.x for w in ws), max(w.y for w in ws), max(w.z for w in ws)))
# by each part's centre (a splinter or a rope end can reach across the gap, but its middle stays home),
# along whichever ground axis the pieces are lined up on: the one that splits into the most groups
def split(axis):
    mids = sorted(((getattr(box(o)[0], axis) + getattr(box(o)[1], axis)) / 2, i, o) for i, o in enumerate(parts))
    width = mids[-1][0] - mids[0][0]
    out = []
    for c, _, o in mids:
        if out and c - out[-1][1] < width * 0.04: out[-1][1] = c; out[-1][2].append(o)
        else: out.append([c, c, [o]])
    return [g for g in out if sum(len(o.data.vertices) for o in g[2]) > 50]
AXIS = max("xy", key=lambda a: len(split(a)))
groups = split(AXIS)
groups = [g for g in groups if sum(len(o.data.vertices) for o in g[2]) > 50]       # crumbs are not panels
print("PIECES", len(parts), "PANELS", len(groups), "along", AXIS, [(round(g[0], 3), round(g[1], 3)) for g in groups])
chosen = groups[WHICH % len(groups)][2]
for o in parts:
    if o not in chosen: bpy.data.objects.remove(o)
keep = chosen[0]
bpy.ops.object.select_all(action="DESELECT")
rest = [o for o in bpy.context.scene.objects if o.type == "MESH"]
for o in rest: o.select_set(True)
bpy.context.view_layer.objects.active = keep
if len(rest) > 1: bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
lo, hi = box(ob)
shift = Vector(((lo.x + hi.x) / 2, (lo.y + hi.y) / 2, lo.z))
for v in ob.data.vertices: v.co -= shift
for img in bpy.data.images:
    if img.size[0] > TEX: img.scale(TEX, TEX)
lo, hi = box(ob)
print("KEPT", WHICH, "tris", sum(len(p.vertices) - 2 for p in ob.data.polygons), "size", [round(v, 3) for v in (hi - lo)])
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format="GLB", export_image_format="WEBP", export_apply=True)
print("SAVED", OUT, "%.2f MB" % (os.path.getsize(OUT) / 1e6))
