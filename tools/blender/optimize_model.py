# Makes a textured Tripo model light enough for the game: joins vertices that were only split for
# the texture, reduces the triangle count, shrinks the textures, and writes
#   <out_dir>/<name>.blend  (textures packed inside, used by the later rigging steps)
#   <out_dir>/<name>.glb    (WebP textures, for the game / viewing)
# usage: blender -b --factory-startup --python optimize_model.py -- <tripo.glb> <out_dir> <name> [target_tris=45000] [colour_px=2048] [other_px=1024] [seams=keep|free]
#   seams  keep (default) never merges across texture seams, which is safest but cannot shrink a model
#          that is made of very many small texture islands. free ignores seams and reaches the target;
#          use it for props when keep stops far above the target, and check the render afterwards.
import bpy, bmesh, sys, os

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT, NAME = argv[0], argv[1], argv[2]
TARGET = int(argv[3]) if len(argv) > 3 else 45000
COLOUR_PX = int(argv[4]) if len(argv) > 4 else 2048
OTHER_PX = int(argv[5]) if len(argv) > 5 else 1024
SEAMS = argv[6] if len(argv) > 6 else "keep"
os.makedirs(OUT, exist_ok=True)

bpy.ops.wm.read_factory_settings(use_empty=True)
if SRC.lower().endswith(".fbx"):
    bpy.ops.import_scene.fbx(filepath=SRC)          # textures are picked up from the folder beside it
else:
    bpy.ops.import_scene.gltf(filepath=SRC, merge_vertices=True)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]
bpy.ops.object.select_all(action="DESELECT")
for o in meshes: o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1: bpy.ops.object.join()
ob = bpy.context.view_layer.objects.active
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
ob.name = NAME; ob.data.name = NAME
me = ob.data

def stats(tag):
    bm = bmesh.new(); bm.from_mesh(me)
    op = sum(1 for e in bm.edges if e.is_boundary)
    tris = sum(len(f.verts) - 2 for f in bm.faces)
    print(tag, "verts", len(bm.verts), "tris", tris, "open edges", op)
    bm.free(); return tris

before = stats("BEFORE")
if SEAMS == "free":
    # some gallery models are a soup of loose fragments; weld touching vertices so they can be reduced
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=max(ob.dimensions) * 2e-5)
    bm.to_mesh(me); bm.free(); me.update()
    before = stats("WELDED")
if before > TARGET:
    mod = ob.modifiers.new("decimate", "DECIMATE")
    mod.decimate_type = "COLLAPSE"
    mod.ratio = TARGET / before
    if SEAMS == "keep": mod.delimit = {"UV"}  # keep texture seams where they are
    mod.use_collapse_triangulate = True
    bpy.ops.object.modifier_apply(modifier=mod.name)
after = stats("AFTER ")
for p in me.polygons: p.use_smooth = True

for m in me.materials:
    m.name = NAME
    for n in m.node_tree.nodes:
        if n.type == "TEX_IMAGE" and n.image:
            img = n.image
            is_colour = any(l.to_socket.name == "Base Color" for l in n.outputs[0].links)
            px = COLOUR_PX if is_colour else OTHER_PX
            old = list(img.size)
            if img.size[0] > px: img.scale(px, px)
            img.name = NAME + ("_colour" if is_colour else "_" + img.name.split("-")[0].split("_")[-1].lower())
            img.pack()
            print("TEXTURE", img.name, old, "->", list(img.size))

blend = os.path.abspath(os.path.join(OUT, NAME + ".blend"))
bpy.ops.wm.save_as_mainfile(filepath=blend)
glb = os.path.abspath(os.path.join(OUT, NAME + ".glb"))
bpy.ops.object.select_all(action="DESELECT"); ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True,
                          export_image_format="WEBP", export_image_quality=88, export_animations=False)
print("SAVED %s (%.1f MB) and %s (%.1f MB)" % (blend, os.path.getsize(blend) / 1e6, glb, os.path.getsize(glb) / 1e6))
