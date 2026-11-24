# Measures the hut where the game will fit things to it: the front wall, the porch railing, the side walls
# and the porch floor, all in game metres (the hut 4.4 m tall, centred, standing on the ground; +Z is the
# front). Rays are cast at the model from outside and the first surface they meet is reported.
# usage: blender -b --factory-startup --python measure_hut.py -- <hut.blend>
import bpy, sys
from mathutils import Vector
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1:]
bpy.ops.wm.open_mainfile(filepath=argv[0])
ob = next(o for o in bpy.context.scene.objects if o.type == "MESH")
dg = bpy.context.evaluated_depsgraph_get()
bvh = BVHTree.FromObject(ob, dg)
mw = ob.matrix_world
pts = [mw @ v.co for v in ob.data.vertices]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
k = 4.4 / (hi.z - lo.z)
cx, cy = (lo.x + hi.x) / 2, (lo.y + hi.y) / 2
# the BVH is in the object's own space
inv = mw.inverted()
def to_model(gx, gy, gz): return inv @ Vector((gx / k + cx, -gz / k + cy, gy / k + lo.z))
def to_game(p):
    w = mw @ p
    return ((w.x - cx) * k, (w.z - lo.z) * k, -(w.y - cy) * k)
def ray(origin, direction):
    o = to_model(*origin)
    e = to_model(*(origin[i] + direction[i] for i in range(3)))
    hit = bvh.ray_cast(o, (e - o).normalized(), 50)
    return None if hit[0] is None else tuple(round(c, 3) for c in to_game(hit[0]))

print("SCALE game metres per model unit", round(k, 4))
print("-- straight in from the front (first surface met), by height, at several x")
for x in (-1.3, -0.9, -0.6, -0.27, 0.0, 0.3, 0.7, 1.0, 1.3):
    row = []
    for y in (0.5, 0.75, 0.9, 1.0, 1.15, 1.3, 1.45, 1.6, 1.75, 1.9, 2.1, 2.3, 2.5, 2.7):
        h = ray((x, y, 6), (0, 0, -1))
        row.append("%.2f" % h[2] if h else " -- ")
    print("x %+.2f:" % x, " ".join(row))
print("   heights: 0.50 0.75 0.90 1.00 1.15 1.30 1.45 1.60 1.75 1.90 2.10 2.30 2.50 2.70")
print("-- the front wall itself, behind the railing (second surface)")
for x in (-0.6, -0.27, 0.0):
    for y in (1.15, 1.6):
        h = ray((x, y, 6), (0, 0, -1))
        if h:
            h2 = ray((x, y, h[2] - 0.02), (0, 0, -1))
            print("x %+.2f y %.2f: first z %.3f, then z %s" % (x, y, h[2], h2[2] if h2 else None))
print("-- side walls (from +x and -x), by height, at several z")
for z in (-1.0, -0.6, -0.2, 0.2, 0.6):
    r = [ray((6, y, z), (-1, 0, 0)) for y in (1.0, 1.4, 1.8, 2.2, 2.5)]
    l = [ray((-6, y, z), (1, 0, 0)) for y in (1.0, 1.4, 1.8, 2.2, 2.5)]
    print("z %+.2f  east x:" % z, " ".join("%.2f" % h[0] if h else " -- " for h in r), "  west x:", " ".join("%.2f" % h[0] if h else " -- " for h in l))
print("-- porch floor and ground under it (straight down)")
for z in (0.95, 1.1, 1.25, 1.4, 1.55):
    print("z %.2f:" % z, " ".join(("x %+.1f y %.2f" % (x, ray((x, 5, z), (0, -1, 0))[1])) if ray((x, 5, z), (0, -1, 0)) else "x %+.1f --" % x for x in (-0.9, -0.27, 0.4)))
print("-- under the roof, straight down at the door (roof, then what is below it)")
h = ray((-0.27, 8, 1.2), (0, -1, 0)); print("first", h)
if h: print("then", ray((-0.27, h[1] - 0.02, 1.2), (0, -1, 0)))

def hits(origin, direction, n=4):
    out, o = [], list(origin)
    for _ in range(n):
        h = ray(tuple(o), direction)
        if not h: break
        out.append(h)
        o = [h[i] + direction[i] * 0.02 for i in range(3)]
    return out
print("-- where the side walls end toward the front (east side, from outside, at height 1.4)")
for z in (0.0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6):
    h = ray((6, 1.4, z), (-1, 0, 0)); h2 = ray((6, 2.2, z), (-1, 0, 0))
    print("z %.1f: east first x at y1.4 %s, at y2.2 %s" % (z, h[0] if h else None, h2[0] if h2 else None))
print("-- surfaces straight down (all), at x -0.27 and x 1.0, by z")
for z in (-0.8, -0.2, 0.3, 0.7, 1.0, 1.3, 1.5, 1.7):
    print("z %.1f:" % z, [round(h[1], 2) for h in hits((-0.27, 4.0, z), (0, -1, 0), 5)], [round(h[1], 2) for h in hits((1.0, 4.0, z), (0, -1, 0), 5)])
print("-- from inside the house toward the back, at x -0.27, by height")
for y in (0.9, 1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3.0):
    h = ray((-0.27, y, 0.6), (0, 0, -1)); print("y %.1f back z %s" % (y, h[2] if h else None))
print("-- the back wall's extent at z -1.1 (from the front, inside): left and right edges at height 1.8")
for x in (-1.6, -1.5, -1.45, -1.4, 1.4, 1.45, 1.5, 1.6):
    h = ray((x, 1.8, 0.6), (0, 0, -1)); print("x %.2f -> z %s" % (x, h[2] if h else None))
print("-- front corner posts: scan x at z 1.45, height 1.5, from the east")
for z in (1.3, 1.4, 1.5, 1.6):
    print("z %.1f" % z, [round(h[0], 2) for h in hits((6, 1.5, z), (-1, 0, 0), 4)])
