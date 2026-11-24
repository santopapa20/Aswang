# The gallery hut is a shelter open at the front. This gives it a front wall with a doorway, a woven door,
# a window with a propped shutter at the front and one on each side, and a ladder up to the porch, all made
# from the hut's own pieces so they match: the walls are copies of its woven back wall, the frames, bars and
# ladder are copies of its corner post bent to new lengths. The door and the three shutters are separate
# objects, hinged where they meet the wall, so the game can open and close them per house:
#   door        hinge vertical, at the doorway's left edge     (game: rotation.y, negative swings it out)
#   shutter_f   hinge along the window's top edge, front wall  (game: rotation.x, negative props it out)
#   shutter_w   west wall                                      (game: rotation.z, negative props it out)
#   shutter_e   east wall                                      (game: rotation.z, positive props it out)
# Nothing reaches outside the hut's original bounds, so the game places it exactly as before.
# Measurements come from tools/blender/measure_hut.py, in game metres (4.4 m tall, centred, +Z the front).
# usage: blender -b --factory-startup --python fit_hut.py -- <hut_open.blend> <out.blend> <out.glb>
import bpy, bmesh, sys, math
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT_BLEND, OUT_GLB = argv

# ---- where things go (game metres) -----------------------------------------------------------------
FLOOR = 0.80                      # top of the floor planks
WALL_Z = 1.00                     # the new front wall (the west wall already reaches here)
WALL_TOP = 2.74                   # just under the front eave beam
WALL_X = (-1.60, 1.57)            # between the side walls
BACK_Z = -1.13                    # the woven back wall's inner face
DOOR = (-0.64, 0.10, FLOOR, 2.44)             # x0, x1, y0, y1
WIN_F = (0.46, 1.10, 1.64, 2.20)              # x0, x1, y0, y1 (front)
WIN_S = (-0.52, 0.22, 1.58, 2.14)             # z0, z1, y0, y1 (both sides)
SIDE_X = {"w": -1.605, "e": 1.565}            # side wall planes (measured)
LADDER = (-0.27, 1.78, 1.56)                  # x, foot z, top z (at the floor's front edge)

bpy.ops.wm.open_mainfile(filepath=SRC)
ob = bpy.data.objects["hut"]
me = ob.data
mw = ob.matrix_world.copy()
pts = [mw @ v.co for v in me.vertices]
lo = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
K = 4.4 / (hi.z - lo.z)
CX, CY = (lo.x + hi.x) / 2, (lo.y + hi.y) / 2
# model -> game: x' = (x-CX)K, y' = (z-loz)K, z' = -(y-CY)K
G = Matrix(((K, 0, 0, -CX * K), (0, 0, K, -lo.z * K), (0, -K, 0, CY * K), (0, 0, 0, 1))) @ mw
GI = G.inverted()
print("BOUNDS before (model)", tuple(round(c, 4) for c in lo), tuple(round(c, 4) for c in hi))

bm = bmesh.new(); bm.from_mesh(me)
bmesh.ops.transform(bm, matrix=G, verts=bm.verts)          # work in game metres
bm.normal_update()
part = bm.faces.layers.int.new("part")                     # 0 hut, 1 door, 2..4 shutters
PARTS = {"door": 1, "shutter_f": 2, "shutter_w": 3, "shutter_e": 4}

def centre(f): return f.calc_center_median()
def copy_faces(faces):
    ret = bmesh.ops.duplicate(bm, geom=list(faces))
    return [g for g in ret["geom"] if isinstance(g, bmesh.types.BMFace)]
def verts_of(faces): return list({v for f in faces for v in f.verts})

# ---- the front wall: the back wall's woven inner face, copied forward -------------------------------
# the outside face of the back wall: the straw-coloured weave the side walls show
src = [f for f in bm.faces if -1.40 < centre(f).z < -1.0 and f.normal.z < -0.3 and WALL_X[0] - 0.05 < centre(f).x < 1.42 and FLOOR - 0.05 < centre(f).y < WALL_TOP + 0.05]
print("BACK WALL faces facing out the back:", len(src))
front = copy_faces(src)
fv = verts_of(front)
x0s, x1s = min(v.co.x for v in fv), max(v.co.x for v in fv)
zmean = sum(v.co.z for v in fv) / len(fv)
for v in fv:
    v.co.z = WALL_Z + (zmean - v.co.z)                     # turned round to face the front, keeping the weave's relief
    v.co.x = WALL_X[0] + (v.co.x - x0s) / (x1s - x0s) * (WALL_X[1] - WALL_X[0])
bmesh.ops.reverse_faces(bm, faces=front)
FRONT = set(front)

def clean_rect(faces, axis_a, a0, a1, b0, b1, axis_b="y"):
    """Cuts faces exactly along a rectangle's four edges; returns (inside, outside)."""
    for value, ax in ((a0, axis_a), (a1, axis_a), (b0, axis_b), (b1, axis_b)):
        co = Vector((0, 0, 0)); no = Vector((0, 0, 0))
        setattr(co, ax, value); setattr(no, ax, 1)
        geom = list(faces) + list({e for f in faces for e in f.edges}) + verts_of(faces)
        ret = bmesh.ops.bisect_plane(bm, geom=geom, dist=1e-5, plane_co=co, plane_no=no)
        faces = {f for f in faces if f.is_valid} | {g for g in ret["geom"] if isinstance(g, bmesh.types.BMFace)}
        # faces split in two keep one half in place and add the other: find all faces sharing their verts
        vs = {v for f in faces for v in f.verts}
        faces = {f for v in vs for f in v.link_faces}
    inside, outside = [], []
    for f in faces:
        c = centre(f)
        a, b = getattr(c, axis_a), getattr(c, axis_b)
        (inside if a0 < a < a1 and b0 < b < b1 else outside).append(f)
    return inside, outside

# trim the copied wall to a clean rectangle between the side walls, floor and eave
inside, outside = clean_rect(list(FRONT), "x", WALL_X[0], WALL_X[1], FLOOR, WALL_TOP)
bmesh.ops.delete(bm, geom=[f for f in outside if f not in set(src)], context="FACES")
front = inside
# the doorway and the front window: their faces become the door and the shutter
door_faces, rest = clean_rect(front, "x", DOOR[0], DOOR[1], DOOR[2] + 0.001, DOOR[3])
win_faces, rest = clean_rect(rest, "x", WIN_F[0], WIN_F[1], WIN_F[2], WIN_F[3])
for f in door_faces: f[part] = PARTS["door"]
for f in win_faces: f[part] = PARTS["shutter_f"]
print("FRONT WALL faces", len(rest), "door", len(door_faces), "front shutter", len(win_faces))

# ---- the east wall stops short of the front: extend it with a copy of its own last stretch ------------
east = [f for f in bm.faces if centre(f).x > 1.45 and 0.02 < centre(f).z < 0.52 and FLOOR - 0.05 < centre(f).y < WALL_TOP + 0.05 and abs(f.normal.x) > 0.5 and f[part] == 0]
ext = copy_faces(east)
for v in verts_of(ext): v.co.z += 0.47
ext_in, ext_out = clean_rect(ext, "z", 0.5, WALL_Z + 0.03, FLOOR, WALL_TOP)
bmesh.ops.delete(bm, geom=ext_out, context="FACES")
print("EAST WALL extension faces", len(ext_in))

# ---- side windows: the wall faces inside the opening become the shutter -----------------------------
for side, x in SIDE_X.items():
    wall = [f for f in bm.faces if abs(centre(f).x - x) < 0.12 and WIN_S[0] - 0.4 < centre(f).z < WIN_S[1] + 0.4 and WIN_S[2] - 0.4 < centre(f).y < WIN_S[3] + 0.4 and f[part] == 0 and abs(f.normal.x) > 0.5]
    inner, _ = clean_rect(wall, "z", WIN_S[0], WIN_S[1], WIN_S[2], WIN_S[3])
    inner = [f for f in inner if abs(centre(f).x - x) < 0.12]          # only the wall itself, nothing that touches it
    for f in inner: f[part] = PARTS["shutter_" + side]
    print("SIDE", side, "wall faces", len(wall), "shutter", len(inner))

# ---- poles: the front-left corner post, copied and bent to any length -------------------------------
post = [f for f in bm.faces if math.hypot(centre(f).x + 1.58, centre(f).z - 1.45) < 0.16 and 1.0 < centre(f).y < 2.3 and f[part] == 0]
pv = verts_of(post)
pcx = sum(v.co.x for v in pv) / len(pv); pcz = sum(v.co.z for v in pv) / len(pv)
py0, py1 = min(v.co.y for v in pv), max(v.co.y for v in pv)
pr = max(math.hypot(v.co.x - pcx, v.co.z - pcz) for v in pv)
print("POST faces", len(post), "radius %.3f length %.2f" % (pr, py1 - py0))
def pole(a, b, r, tag=0):
    a, b = Vector(a), Vector(b)
    d = (b - a); L = d.length; d.normalize()
    u = Vector((0, 0, 1)) if abs(d.z) < 0.9 else Vector((1, 0, 0))
    u = (u - d * u.dot(d)).normalized()
    w = u.cross(d)
    faces = copy_faces(post)
    for v in verts_of(faces):
        lx, ly, lz = (v.co.x - pcx) / pr, (v.co.y - py0) / (py1 - py0), (v.co.z - pcz) / pr
        v.co = a + d * (ly * L) + u * (lx * r) + w * (lz * r)
    for f in faces: f[part] = tag
    return faces

R = 0.042
# doorway and front window frames, standing just proud of the wall
zf = WALL_Z + 0.03
pole((DOOR[0] - R, FLOOR - 0.02, zf), (DOOR[0] - R, DOOR[3] + 0.1, zf), R)
pole((DOOR[1] + R, FLOOR - 0.02, zf), (DOOR[1] + R, DOOR[3] + 0.1, zf), R)
pole((DOOR[0] - 0.12, DOOR[3] + R, zf), (DOOR[1] + 0.12, DOOR[3] + R, zf), R)
pole((DOOR[0] - 0.08, FLOOR + 0.01, zf + 0.01), (DOOR[1] + 0.08, FLOOR + 0.01, zf + 0.01), R * 0.9)          # threshold
def window_frame(x0, x1, y0, y1, plane, at):
    """Four sides and two bamboo bars around an opening in a wall. plane 'z' (front) or 'x' (sides)."""
    P = (lambda a, y: (a, y, at)) if plane == "z" else (lambda a, y: (at, y, a))
    pole(P(x0 - R, y0 - 0.06), P(x0 - R, y1 + 0.06), R)
    pole(P(x1 + R, y0 - 0.06), P(x1 + R, y1 + 0.06), R)
    pole(P(x0 - 0.1, y1 + R), P(x1 + 0.1, y1 + R), R)
    pole(P(x0 - 0.12, y0 - R), P(x1 + 0.12, y0 - R), R * 1.1)                                    # sill
    for t in (1 / 3, 2 / 3):
        a = x0 + (x1 - x0) * t
        pole(P(a, y0 - 0.02), P(a, y1 + 0.02), R * 0.45)                                        # bars
window_frame(WIN_F[0], WIN_F[1], WIN_F[2], WIN_F[3], "z", zf)
window_frame(WIN_S[0], WIN_S[1], WIN_S[2], WIN_S[3], "x", SIDE_X["w"] - 0.03)
window_frame(WIN_S[0], WIN_S[1], WIN_S[2], WIN_S[3], "x", SIDE_X["e"] + 0.03)
# the ladder up to the porch: two rails and four rungs, inside the hut's footprint
lx, fz, tz = LADDER
for s in (-0.26, 0.26):
    pole((lx + s, 0.0, fz), (lx + s, FLOOR + 0.22, tz), 0.038)
for i in range(4):
    t = (i + 1) / 5
    y = t * (FLOOR + 0.22); z = fz + (tz - fz) * t
    pole((lx - 0.3, y, z), (lx + 0.3, y, z), 0.026)
# a bar across the inside of the door to hang the mat-door from (seen when it stands open)
print("POLES added")

# ---- back to the model's own space, write, separate the moving parts ---------------------------------
bmesh.ops.transform(bm, matrix=GI, verts=bm.verts)
bm.normal_update()
bm.to_mesh(me); bm.free()
me.update()

bpy.context.view_layer.objects.active = ob
ob.select_set(True)
mat = me.materials[0]
leaf = mat.copy(); leaf.name = "hut_leaf"; leaf.use_backface_culling = False        # doors and shutters are seen from both sides
me.materials.append(leaf)
HINGES = {
    "door": (DOOR[0], (DOOR[2] + DOOR[3]) / 2, WALL_Z),
    "shutter_f": ((WIN_F[0] + WIN_F[1]) / 2, WIN_F[3], WALL_Z),
    "shutter_w": (SIDE_X["w"], WIN_S[3], (WIN_S[0] + WIN_S[1]) / 2),
    "shutter_e": (SIDE_X["e"], WIN_S[3], (WIN_S[0] + WIN_S[1]) / 2),
}
for name, tag in PARTS.items():
    bpy.ops.object.select_all(action="DESELECT"); ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.select_all(action="DESELECT"); bpy.ops.object.mode_set(mode="OBJECT")
    layer = me.attributes["part"]
    n = 0
    for p in me.polygons:
        p.select = layer.data[p.index].value == tag
        n += p.select
    if not n: print("NO FACES for", name); continue
    bpy.ops.object.mode_set(mode="EDIT"); bpy.ops.mesh.separate(type="SELECTED"); bpy.ops.object.mode_set(mode="OBJECT")
    new = [o for o in bpy.context.selected_objects if o is not ob][0]
    new.name = name; new.data.name = name
    new.data.materials.clear(); new.data.materials.append(leaf)
    # the hinge becomes the object's origin
    hinge = GI @ Vector(HINGES[name])
    bpy.context.scene.cursor.location = mw @ hinge
    bpy.ops.object.select_all(action="DESELECT"); new.select_set(True); bpy.context.view_layer.objects.active = new
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    print("PART", name, n, "faces, hinge (game)", HINGES[name])
for o in bpy.context.scene.objects:
    if o.type == "MESH" and "part" in o.data.attributes: o.data.attributes.remove(o.data.attributes["part"])

pts = [o.matrix_world @ v.co for o in bpy.context.scene.objects if o.type == "MESH" for v in o.data.vertices]
lo2 = Vector((min(p.x for p in pts), min(p.y for p in pts), min(p.z for p in pts)))
hi2 = Vector((max(p.x for p in pts), max(p.y for p in pts), max(p.z for p in pts)))
print("BOUNDS after  (model)", tuple(round(c, 4) for c in lo2), tuple(round(c, 4) for c in hi2))
print("TRIS", sum(len(p.vertices) - 2 for o in bpy.context.scene.objects if o.type == "MESH" for p in o.data.polygons))
bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.export_scene.gltf(filepath=OUT_GLB, export_format="GLB", use_selection=True, export_image_format="WEBP", export_image_quality=88, export_animations=False)
print("SAVED", OUT_BLEND, OUT_GLB)
