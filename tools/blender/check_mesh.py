# Reports, per object: triangles, open (boundary) edges, loose islands, and UV layers.
# usage: blender -b --factory-startup --python check_mesh.py -- <model.glb>
import bpy, bmesh, sys
src = sys.argv[sys.argv.index("--") + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
tot = {"tris": 0, "open": 0, "closed_parts": 0, "parts": 0}
rows = []
for o in bpy.context.scene.objects:
    if o.type != "MESH":
        continue
    bm = bmesh.new(); bm.from_mesh(o.data)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    open_edges = sum(1 for e in bm.edges if len(e.link_faces) == 1)
    nonman = sum(1 for e in bm.edges if len(e.link_faces) > 2)
    seen = set(); islands = 0
    for v in bm.verts:
        if v.index in seen: continue
        islands += 1; stack = [v]
        while stack:
            x = stack.pop()
            if x.index in seen: continue
            seen.add(x.index)
            stack.extend(e.other_vert(x) for e in x.link_edges)
    tris = len(bm.faces)
    tot["tris"] += tris; tot["open"] += open_edges; tot["parts"] += 1; tot["closed_parts"] += 1 if open_edges == 0 else 0
    rows.append((o.name, tris, open_edges, nonman, islands, len(o.data.uv_layers), [round(d, 3) for d in o.dimensions]))
    bm.free()
for r in sorted(rows, key=lambda r: -r[1]):
    print("PART", r)
print("TOTAL", tot)
