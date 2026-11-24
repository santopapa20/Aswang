# Cuts a model into thin horizontal slabs and reports the separate pieces in each one (a leg, an arm, a
# stick), with their extent and centre, in the model's own units. Used to place a skeleton's joints inside
# a body that is not standing symmetrically.
# usage: blender -b --factory-startup --python slice_model.py -- <model.blend> <z,z,...> [thickness=0.012]
import bpy, sys
import numpy as np

argv = sys.argv[sys.argv.index("--") + 1:]
SRC = argv[0]
ZS = [float(z) for z in argv[1].split(",")]
T = float(argv[2]) if len(argv) > 2 else 0.012
bpy.ops.wm.open_mainfile(filepath=SRC)
ob = next(o for o in bpy.context.scene.objects if o.type == "MESH")
co = np.empty(len(ob.data.vertices) * 3, dtype=np.float64)
ob.data.vertices.foreach_get("co", co)
co = co.reshape(-1, 3) @ np.array(ob.matrix_world)[:3, :3].T + np.array(ob.matrix_world)[:3, 3]
print("SIZE", co.min(0).round(3), co.max(0).round(3))
CELL = 0.008
for z in ZS:
    pts = co[np.abs(co[:, 2] - z) < T / 2]
    if not len(pts): print("z %.3f: nothing" % z); continue
    cells = {}
    for i, (x, y) in enumerate(pts[:, :2]):
        cells.setdefault((int(np.floor(x / CELL)), int(np.floor(y / CELL))), []).append(i)
    seen, groups = set(), []
    for c in cells:
        if c in seen: continue
        stack, members = [c], []
        seen.add(c)
        while stack:
            a = stack.pop(); members += cells[a]
            for dx in (-1, 0, 1):
                for dy in (-1, 0, 1):
                    n = (a[0] + dx, a[1] + dy)
                    if n in cells and n not in seen: seen.add(n); stack.append(n)
        groups.append(pts[members])
    groups.sort(key=lambda g: g[:, 0].mean())
    out = []
    for g in groups:
        if len(g) < 6: continue
        lo, hi = g.min(0), g.max(0)
        out.append("x %+.3f..%+.3f y %+.3f..%+.3f (c %+.3f,%+.3f)" % (lo[0], hi[0], lo[1], hi[1], (lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2))
    print("z %.3f: %s" % (z, "  |  ".join(out)))
