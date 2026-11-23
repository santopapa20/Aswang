# Makes the manananggal's abandoned lower half for free: cuts a standing character model at the
# waist, keeps the hips, skirt and legs, and closes the cut with a dark raw-flesh cap.
# usage: blender -b --factory-startup --python make_lower_half.py -- <character.blend> <out.glb> [cut=0.6]
#   cut  height of the cut as a fraction of the character's height
import bpy, bmesh, sys, os
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
CUT = float(argv[2]) if len(argv) > 2 else 0.6

bpy.ops.wm.open_mainfile(filepath=SRC)
ob = next(o for o in bpy.context.scene.objects if o.type == "MESH")
me = ob.data
zs = [v.co.z for v in me.vertices]
zc = min(zs) + (max(zs) - min(zs)) * CUT

bm = bmesh.new(); bm.from_mesh(me)
res = bmesh.ops.bisect_plane(bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:], plane_co=Vector((0, 0, zc)),
                             plane_no=Vector((0, 0, 1)), clear_outer=True)
rim = [e for e in res["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
# arms hang below the waist in an A-pose: drop every piece that is not connected to the feet
seen = set(); pieces = []
for v in bm.verts:
    if v in seen: continue
    stack = [v]; comp = []
    while stack:
        x = stack.pop()
        if x in seen: continue
        seen.add(x); comp.append(x); stack.extend(e.other_vert(x) for e in x.link_edges)
    pieces.append(comp)
floor = min(v.co.z for v in bm.verts)
keep = max(pieces, key=len)
extra = [v for comp in pieces if comp is not keep and min(x.co.z for x in comp) > floor + 0.05 for v in comp]
bmesh.ops.delete(bm, geom=extra, context="VERTS")
rim = [e for e in bm.edges if e.is_boundary]
cap = bmesh.ops.holes_fill(bm, edges=rim, sides=0)["faces"]
cap = bmesh.ops.triangulate(bm, faces=cap)["faces"]

flesh = bpy.data.materials.new("raw_flesh")
flesh.use_nodes = True
b = next(n for n in flesh.node_tree.nodes if n.type == "BSDF_PRINCIPLED")
b.inputs["Base Color"].default_value = (0.16, 0.012, 0.012, 1)
b.inputs["Roughness"].default_value = 0.35
me.materials.append(flesh)
for f in cap: f.material_index = len(me.materials) - 1
print("LOWER HALF cut at %.0f%% of height, removed %d loose vertices (arms), cap triangles %d, kept triangles %d" % (CUT * 100, len(extra), len(cap), len(bm.faces)))
bm.to_mesh(me); bm.free(); me.update()
ob.name = "lower_half"

os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.object.select_all(action="DESELECT"); ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format="GLB", use_selection=True,
                          export_image_format="WEBP", export_image_quality=85, export_animations=False)
print("SAVED %s (%.1f MB)" % (OUT, os.path.getsize(OUT) / 1e6))
