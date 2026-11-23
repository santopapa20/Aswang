# Reports what a character file contains before rigging: objects, transforms, materials, and for
# every vertex group "part_NN" its size, position, open edges and how far its open edges are from
# the nearest other part (the width of the seam that may open when the character bends).
# usage: blender -b --factory-startup --python inspect_parts.py -- <model.blend|model.glb>
import bpy, bmesh, sys
from mathutils import Vector
from mathutils.kdtree import KDTree

src = sys.argv[sys.argv.index("--") + 1]
if src.lower().endswith(".blend"):
    bpy.ops.wm.open_mainfile(filepath=src)
else:
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.gltf(filepath=src)

for o in bpy.context.scene.objects:
    print("OBJECT", o.name, o.type, "loc", [round(v, 4) for v in o.location],
          "rot", [round(v, 4) for v in o.rotation_euler], "scale", [round(v, 4) for v in o.scale],
          "parent", o.parent.name if o.parent else None,
          "modifiers", [m.type for m in o.modifiers] if o.type == "MESH" else "")

for o in [o for o in bpy.context.scene.objects if o.type == "MESH"]:
    me = o.data
    mw = o.matrix_world
    print("MESH", o.name, "verts", len(me.vertices), "polys", len(me.polygons),
          "tris", sum(len(p.vertices) - 2 for p in me.polygons),
          "uv", [u.name for u in me.uv_layers], "materials", [m.name if m else None for m in me.materials],
          "shape_keys", bool(me.shape_keys), "color_attrs", [a.name for a in me.color_attributes])
    for m in me.materials:
        if m and m.use_nodes:
            for n in m.node_tree.nodes:
                if n.type == "TEX_IMAGE" and n.image:
                    print("  IMAGE", n.image.name, list(n.image.size), n.image.filepath, "packed", bool(n.image.packed_file))
    co = [mw @ v.co for v in me.vertices]
    lo = Vector(map(min, *[tuple(c) for c in co])); hi = Vector(map(max, *[tuple(c) for c in co]))
    print("  BBOX lo", [round(v, 3) for v in lo], "hi", [round(v, 3) for v in hi], "size", [round(v, 3) for v in hi - lo])

    groups = {g.index: g.name for g in o.vertex_groups}
    vgroup = {}
    multi = 0
    for v in me.vertices:
        gs = [g.group for g in v.groups if g.weight > 0.5]
        if len(gs) > 1: multi += 1
        vgroup[v.index] = gs[0] if gs else -1
    print("  GROUPS", len(groups), "verts in >1 group", multi, "verts in no group", sum(1 for g in vgroup.values() if g == -1))

    bm = bmesh.new(); bm.from_mesh(me)
    bm.verts.ensure_lookup_table()
    boundary = {}
    for e in bm.edges:
        if len(e.link_faces) == 1:
            for v in e.verts:
                boundary.setdefault(vgroup[v.index], set()).add(v.index)
    allb = [(gi, vi) for gi, s in boundary.items() for vi in s]
    kd = KDTree(len(allb))
    for i, (gi, vi) in enumerate(allb):
        kd.insert(co[vi], i)
    kd.balance()

    for gi in sorted(groups):
        vs = [i for i, g in vgroup.items() if g == gi]
        if not vs:
            print("  PART", groups[gi], "EMPTY"); continue
        pc = [co[i] for i in vs]
        plo = Vector(map(min, *[tuple(c) for c in pc])); phi = Vector(map(max, *[tuple(c) for c in pc]))
        b = boundary.get(gi, set())
        # distance from each open-edge vertex of this part to the nearest open-edge vertex of another part
        gaps = []; neigh = {}
        for vi in b:
            best = None
            for (c, idx, d) in kd.find_n(co[vi], 24):
                if allb[idx][0] != gi:
                    best = (d, allb[idx][0]); break
            if best:
                gaps.append(best[0]); neigh[best[1]] = neigh.get(best[1], 0) + 1
        gaps.sort()
        gstat = ("gap mm median %.1f p90 %.1f max %.1f" % (gaps[len(gaps) // 2] * 1000, gaps[int(len(gaps) * 0.9)] * 1000, gaps[-1] * 1000)) if gaps else "no neighbour"
        print("  PART", groups[gi], "verts", len(vs), "centre", [round(v, 3) for v in (plo + phi) / 2],
              "size", [round(v, 3) for v in phi - plo], "open_verts", len(b), gstat,
              "touches", {groups.get(k, "none"): n for k, n in sorted(neigh.items(), key=lambda kv: -kv[1])[:4]})
    bm.free()
