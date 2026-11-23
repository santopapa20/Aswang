# Turns a coloured character model into one that can be rigged and animated:
#   1. closes the surface (welds part seams, removes loose specks, patches small holes)
#   2. cuts the hanging props (garlic braid, sash tails) loose as their own closed pieces, instead of
#      leaving them fused to the trousers, and patches the hole each one leaves behind
#   3. saves the rig-ready .blend, and optionally a Mixamo-ready FBX
# The props are listed in the character's rig_landmarks.json ("props": {name: {"parts": [...], "side": "L"|"R"}}).
#
# Which vertices belong to a prop comes from one of two places:
#   - the model's own vertex groups part_NN (a Tripo "generate in parts" model), or
#   - --labels-from <parts.blend>: another model of the same character that has those groups; each
#     point of this model takes the label of the nearest point on that one. This is how a
#     single-piece Tripo-textured model is combined with the parts model.
#
# usage: blender -b --factory-startup --python prepare_for_rig.py -- <model.blend> <rig_landmarks.json> <out.blend>
#            [--fbx mixamo.fbx] [--height 1.65] [--labels-from parts.blend] [--keep-fused]
#   --keep-fused  with --labels-from: only mark which vertices are props, do not cut them loose. A cut
#                 made from borrowed labels is ragged, so a single-piece model usually looks better fused,
#                 with the props following the body through their skin weights.
import bpy, bmesh, sys, json, os
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, LMK, OUT = argv[0], argv[1], argv[2]
opt = lambda flag: argv[argv.index(flag) + 1] if flag in argv else None
FBX = opt("--fbx")
HEIGHT = float(opt("--height")) if opt("--height") else None
LABELS = opt("--labels-from")
KEEP_FUSED = "--keep-fused" in argv
cfg = json.load(open(LMK))
props = cfg.get("props", {})
prop_names = list(props)

bpy.ops.wm.open_mainfile(filepath=SRC)
ob = next(o for o in bpy.context.scene.objects if o.type == "MESH")
me = ob.data

# ---- colour lookup (to pick a flat colour for each patch)
nt = me.materials[0].node_tree
colour_node = next(n for n in nt.nodes if n.type == "TEX_IMAGE" and n.image and
                   any(l.to_socket.name == "Base Color" for l in n.outputs[0].links))
nt.nodes.active = colour_node
img = colour_node.image
W, H = img.size
px = np.empty(W * H * 4, dtype=np.float32); img.pixels.foreach_get(px); px = px.reshape(H, W, 4)
def lum(uv):
    c = px[min(H - 1, max(0, int(uv.y * H))), min(W - 1, max(0, int(uv.x * W)))]
    return float(0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2])

bm = bmesh.new(); bm.from_mesh(me)
uvl = bm.loops.layers.uv.active
tag = bm.verts.layers.int.new("prop")           # 0 = body, 1.. = props
open_before = sum(1 for e in bm.edges if e.is_boundary)

def remove_specks():
    # loose specks left over from generation
    seen = set(); specks = []
    for v in bm.verts:
        if v in seen: continue
        stack = [v]; comp = []
        while stack:
            x = stack.pop()
            if x in seen: continue
            seen.add(x); comp.append(x); stack.extend(e.other_vert(x) for e in x.link_edges)
        if len(comp) < 200: specks += comp
    bmesh.ops.delete(bm, geom=specks, context="VERTS")
    print("CLEAN removed %d loose speck vertices" % len(specks))

if not LABELS:
    # parts model: seams are duplicated vertices, so welding body and props separately keeps them apart
    dl = bm.verts.layers.deform.verify()
    gindex = {g.name: g.index for g in ob.vertex_groups}
    part_to_prop = {gindex[p]: i + 1 for i, n in enumerate(prop_names) for p in props[n]["parts"]}
    for v in bm.verts:
        v[tag] = max([part_to_prop.get(g, 0) for g, w in v[dl].items() if w > 0.5] or [0])
    for t in range(len(prop_names) + 1):
        bmesh.ops.remove_doubles(bm, verts=[v for v in bm.verts if v[tag] == t], dist=1e-4)
    remove_specks()
else:
    # single-piece model: borrow the labels from the parts model, then cut along the border
    with bpy.data.libraries.load(os.path.abspath(LABELS)) as (src_lib, dst_lib):
        dst_lib.objects = [n for n in src_lib.objects]
    ref = next(o for o in dst_lib.objects if o and o.type == "MESH")
    rgi = {g.name: g.index for g in ref.vertex_groups}
    part_to_prop = {rgi[p]: i + 1 for i, n in enumerate(prop_names) for p in props[n]["parts"]}
    rbm = bmesh.new(); rbm.from_mesh(ref.data); rbm.faces.ensure_lookup_table()
    rdl = rbm.verts.layers.deform.verify()
    face_label = [max(part_to_prop.get(g, 0) for g, w in f.verts[0][rdl].items()) if f.verts[0][rdl].items() else 0 for f in rbm.faces]
    bvh = BVHTree.FromBMesh(rbm)
    dists = []
    for v in bm.verts:
        loc, nrm, idx, d = bvh.find_nearest(v.co)
        v[tag] = face_label[idx]; dists.append(d)
    dists.sort()
    print("LABELS from %s: surfaces differ by median %.1f mm, 90%% within %.1f mm" % (os.path.basename(LABELS), dists[len(dists) // 2] * 1000, dists[int(len(dists) * 0.9)] * 1000))
    rbm.free()
    for _ in range(3):                           # tidy the border: a vertex takes the label most of its neighbours have
        new = {}
        for v in bm.verts:
            votes = [e.other_vert(v)[tag] for e in v.link_edges]
            if votes:
                best = max(set(votes), key=votes.count)
                if votes.count(best) * 2 > len(votes): new[v] = best
        for v, t in new.items(): v[tag] = t
    remove_specks()
    if not KEEP_FUSED:
        # a face belongs to a prop when most of its corners do; cut the mesh along the border
        ftag = {}
        for f in bm.faces:
            votes = [v[tag] for v in f.verts]
            ftag[f] = max(set(votes), key=votes.count)
        border = [e for e in bm.edges if len({ftag[f] for f in e.link_faces}) > 1]
        bmesh.ops.split_edges(bm, edges=border)
        for f in bm.faces:
            for v in f.verts: v[tag] = ftag[f]
        for i, n in enumerate(prop_names):
            print("CUT", n, "faces", sum(1 for t in ftag.values() if t == i + 1))

open_welded = sum(1 for e in bm.edges if e.is_boundary)

# ---- patch every open loop, each with one flat colour taken from the surface a few edges away
cap_count = 0
for t in range(len(prop_names) + 1):
    is_t = lambda e: e.is_boundary and e.verts[0][tag] == t
    rim = [e for e in bm.edges if is_t(e)]
    if not rim: continue
    new = bmesh.ops.holes_fill(bm, edges=rim, sides=0)["faces"]
    left = [e for e in bm.edges if is_t(e)]                 # loops that touch each other need a second pass
    if left: new += bmesh.ops.holes_fill(bm, edges=left, sides=0)["faces"]
    left = set(e for e in bm.edges if is_t(e))              # anything it still refused: fan each loop to its centre
    while left:
        stack = [left.pop()]; loop = []
        while stack:
            e = stack.pop(); loop.append(e)
            for v in e.verts:
                for e2 in v.link_edges:
                    if e2 in left: left.discard(e2); stack.append(e2)
        mid = sum((v.co for e in loop for v in e.verts), Vector()) / (2 * len(loop))
        centre = bm.verts.new(mid, loop[0].verts[0])        # second argument copies weights and tags
        for e in loop:
            a, b = e.verts
            la = next(l for l in e.link_faces[0].loops if l.vert == a)
            if la.link_loop_next.vert == b: a, b = b, a     # wind opposite to the neighbouring face
            new.append(bm.faces.new((a, b, centre)))
    new_set = set(new)
    # group the new faces into separate patches
    todo = set(new); patches = []
    while todo:
        stack = [todo.pop()]; comp = []
        while stack:
            f = stack.pop(); comp.append(f)
            for v in f.verts:
                for g in v.link_faces:
                    if g in todo: todo.discard(g); stack.append(g)
        patches.append(comp)
    for comp in patches:
        rim_verts = {v for f in comp for v in f.verts}
        ring, seen_v = set(rim_verts), set(rim_verts)
        pool = set()
        for step in range(7):                               # texels right at a rim are smeared, so walk away from it
            ring = {e.other_vert(v) for v in ring for e in v.link_edges} - seen_v
            seen_v |= ring
            if step >= 3: pool |= ring
        pool = pool or rim_verts
        near = sorted(((lum(l[uvl].uv), l[uvl].uv.copy()) for v in pool for l in v.link_loops if l.face not in new_set), key=lambda x: x[0])
        uv = near[int(len(near) * 0.2)][1]
        for f in comp:
            for l in f.loops: l[uvl].uv = uv
            for e in f.edges: e.smooth = False              # crisp edge so the patch does not shade the surface
    tri = bmesh.ops.triangulate(bm, faces=new, ngon_method="BEAUTY")["faces"]
    for f in tri: f.smooth = True
    cap_count += len(tri)
    print("PATCH", "body" if t == 0 else prop_names[t - 1], "open edges", len(rim), "patches", len(patches), "new triangles", len(tri))

bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
open_after = sum(1 for e in bm.edges if e.is_boundary)
nonman = sum(1 for e in bm.edges if len(e.link_faces) > 2)

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
if LABELS:
    for o in list(bpy.data.objects):
        if o is not ob and o.type == "MESH": bpy.data.objects.remove(o)

print("RESULT open edges: source %d, after weld/cut %d, patched %d | edges shared by 3+ faces %d | pieces %s | verts %d tris %d (patches added %d)"
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
