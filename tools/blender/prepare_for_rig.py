# Turns a coloured Tripo "parts" model into one that can be rigged and animated:
#   1. welds the seams between the body parts into one continuous surface (so no gaps open at joints)
#   2. keeps the hanging props (garlic braid, sash tails) as their own closed pieces instead of fusing
#      them to the trousers, and patches the hole each one leaves behind
#   3. saves <name>_rigready.blend next to the source, and optionally a Mixamo-ready FBX
# The props are listed in the character's rig_landmarks.json ("props": {name: {"parts": [...], "side": "L"|"R"}}).
#
# usage: blender -b --factory-startup --python prepare_for_rig.py -- <model_textured.blend> <rig_landmarks.json> <out.blend> [mixamo.fbx] [height_m]
import bpy, bmesh, sys, json, os
import numpy as np
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, LMK, OUT = argv[0], argv[1], argv[2]
FBX = argv[3] if len(argv) > 3 else None
HEIGHT = float(argv[4]) if len(argv) > 4 else None
cfg = json.load(open(LMK))
props = cfg.get("props", {})

bpy.ops.wm.open_mainfile(filepath=SRC)
ob = next(o for o in bpy.context.scene.objects if o.type == "MESH")
me = ob.data
gindex = {g.name: g.index for g in ob.vertex_groups}
prop_names = list(props)
part_to_prop = {gindex[p]: i + 1 for i, n in enumerate(prop_names) for p in props[n]["parts"]}

img = next(n.image for n in me.materials[0].node_tree.nodes if n.type == "TEX_IMAGE" and n.image)
W, H = img.size
px = np.empty(W * H * 4, dtype=np.float32); img.pixels.foreach_get(px); px = px.reshape(H, W, 4)
def lum(uv):
    c = px[min(H - 1, max(0, int(uv.y * H))), min(W - 1, max(0, int(uv.x * W)))]
    return float(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2])

bm = bmesh.new(); bm.from_mesh(me)
dl = bm.verts.layers.deform.verify()
uvl = bm.loops.layers.uv.active
tag = bm.verts.layers.int.new("prop")
for v in bm.verts:
    v[tag] = max([part_to_prop.get(g, 0) for g, w in v[dl].items() if w > 0.5] or [0])

open_before = sum(1 for e in bm.edges if e.is_boundary)
for t in range(len(prop_names) + 1):                       # 0 = body, then each prop on its own
    bmesh.ops.remove_doubles(bm, verts=[v for v in bm.verts if v[tag] == t], dist=1e-4)
open_welded = sum(1 for e in bm.edges if e.is_boundary)

cap_count = 0
for t in range(len(prop_names) + 1):
    rim = [e for e in bm.edges if e.is_boundary and e.verts[0][tag] == t]
    if not rim: continue
    rim_verts = {v for e in rim for v in e.verts}
    # one flat colour for the patch. Texels right at the rim are smeared with the neighbour's colour, so
    # walk a few edges away first (body), or take a shadowed texel from the whole prop (props).
    if t == 0:
        ring, seen_v = set(rim_verts), set(rim_verts)
        for _ in range(7):
            ring = {e.other_vert(v) for v in ring for e in v.link_edges} - seen_v
            seen_v |= ring
        pool = ring
    else:
        pool = [v for v in bm.verts if v[tag] == t]
    near = sorted(((lum(l[uvl].uv), l[uvl].uv.copy()) for v in pool for l in v.link_loops), key=lambda x: x[0])
    uv = near[int(len(near) * (0.25 if t == 0 else 0.08))][1]
    new = bmesh.ops.holes_fill(bm, edges=rim, sides=0)["faces"]
    left = [e for e in bm.edges if e.is_boundary and e.verts[0][tag] == t]      # loops that touch each other need a second pass
    if left: new += bmesh.ops.holes_fill(bm, edges=left, sides=0)["faces"]
    left = [e for e in bm.edges if e.is_boundary and e.verts[0][tag] == t]      # anything it still refused: fan to a centre point
    if left:
        mid = sum((v.co for e in left for v in e.verts), Vector()) / (2 * len(left))
        centre = bm.verts.new(mid, left[0].verts[0])           # second argument copies weights and tags
        for e in left:
            a, b = e.verts
            la = next(l for l in e.link_faces[0].loops if l.vert == a)
            if la.link_loop_next.vert == b: a, b = b, a        # wind opposite to the neighbouring face
            new.append(bm.faces.new((a, b, centre)))
        print("  fan-filled", len(left), "leftover open edges")
    for f in new:
        for l in f.loops: l[uvl].uv = uv
        for e in f.edges: e.smooth = False                 # crisp edge so the patch does not shade the surface
    tri = bmesh.ops.triangulate(bm, faces=new, ngon_method="BEAUTY")["faces"]
    for f in tri:
        f.smooth = True
        for e in f.edges:
            if all(ff in tri for ff in e.link_faces): e.smooth = True
    cap_count += len(tri)
    print("PATCH", "body" if t == 0 else prop_names[t - 1], "rim edges", len(rim), "new triangles", len(tri))

bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
open_after = sum(1 for e in bm.edges if e.is_boundary)
nonman = sum(1 for e in bm.edges if len(e.link_faces) > 2)

# count separate pieces
seen = set(); pieces = []
for v in bm.verts:
    if v in seen: continue
    stack = [v]; n = 0
    while stack:
        x = stack.pop()
        if x in seen: continue
        seen.add(x); n += 1; stack.extend(e.other_vert(x) for e in x.link_edges)
    pieces.append(n)

prop_verts = {n: [v.index for v in bm.verts if v[tag] == i + 1] for i, n in enumerate(prop_names)}
bm.verts.layers.int.remove(tag)
bm.to_mesh(me); bm.free(); me.update()
for p in me.polygons: p.use_smooth = True
for n, vs in prop_verts.items():
    g = ob.vertex_groups.get("prop_" + n) or ob.vertex_groups.new(name="prop_" + n)
    g.add(vs, 1.0, "REPLACE")

print("RESULT open edges: source %d, welded %d, patched %d | edges shared by 3+ faces %d | pieces %s | verts %d tris %d (patches added %d)"
      % (open_before, open_welded, open_after, nonman, sorted(pieces, reverse=True), len(me.vertices), len(me.polygons), cap_count))

bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(OUT))
print("SAVED", OUT)

if FBX:
    # Mixamo wants: one mesh, no skeleton, transforms applied, standing on the floor, facing forward.
    os.makedirs(os.path.dirname(os.path.abspath(FBX)), exist_ok=True)
    if HEIGHT:
        zs = [v.co.z for v in me.vertices]
        s = HEIGHT / (max(zs) - min(zs))
        for v in me.vertices: v.co *= s
        me.update()
        print("SCALED x%.4f to %.2f m tall" % (s, HEIGHT))
    for g in list(ob.vertex_groups): ob.vertex_groups.remove(g)
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.export_scene.fbx(filepath=os.path.abspath(FBX), use_selection=True, object_types={"MESH"},
                             apply_scale_options="FBX_SCALE_ALL", axis_forward="-Z", axis_up="Y",
                             mesh_smooth_type="FACE", use_mesh_modifiers=False, add_leaf_bones=False,
                             bake_anim=False, path_mode="COPY", embed_textures=True)
    print("FBX", FBX, os.path.getsize(FBX), "bytes")
