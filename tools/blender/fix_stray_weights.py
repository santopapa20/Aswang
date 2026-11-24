# Automatic skin weights sometimes tie loose rags hanging by the hips to an arm, because in the rest
# pose the hand hangs close beside them. When the arm lifts, those rags stretch out after it in long
# spikes. This takes away any arm weight (shoulder, upper arm, forearm, hand) from a vertex that lies
# further than LIMIT from that bone, gives the rest of its weight the whole say, and hands a vertex left
# with nothing to the nearest bone that is not part of an arm.
# usage: blender -b --factory-startup --python fix_stray_weights.py -- <rigged.blend> [limit_m=0.16] [smooth_passes=4]
import bpy, sys
from mathutils import Vector
from mathutils.geometry import intersect_point_line

argv = sys.argv[sys.argv.index("--") + 1:]
SRC = argv[0]
LIMIT = float(argv[1]) if len(argv) > 1 else 0.16
SMOOTH = int(argv[2]) if len(argv) > 2 else 4
bpy.ops.wm.open_mainfile(filepath=SRC)
arm = next(o for o in bpy.context.scene.objects if o.type == "ARMATURE")
ob = next(o for o in bpy.context.scene.objects if o.type == "MESH")
ARM_PARTS = ("Shoulder", "Arm", "ForeArm", "Hand")
seg = {}
for b in arm.data.bones:
    seg[b.name] = (arm.matrix_world @ b.head_local, arm.matrix_world @ b.tail_local)
def dist(p, name):
    a, b = seg[name]
    q, t = intersect_point_line(p, a, b)
    q = a if t < 0 else b if t > 1 else q
    return (p - q).length
is_arm = {g.index: any(g.name.endswith(side + part) for side in ("Left", "Right") for part in ARM_PARTS) for g in ob.vertex_groups}
cut = moved = 0
mw = ob.matrix_world
for v in ob.data.vertices:
    p = mw @ v.co
    stray = [g for g in v.groups if is_arm[g.group] and g.weight > 0 and dist(p, ob.vertex_groups[g.group].name) > LIMIT]
    if not stray: continue
    cut += 1
    for g in stray: ob.vertex_groups[g.group].remove([v.index])
    rest = [g for g in v.groups if g.weight > 0]
    total = sum(g.weight for g in rest)
    if total > 1e-4:
        for g in rest: g.weight /= total
    else:
        best = min((n for n in seg if n in ob.vertex_groups and not is_arm[ob.vertex_groups[n].index]), key=lambda n: dist(p, n))
        ob.vertex_groups[best].add([v.index], 1.0, "REPLACE"); moved += 1
print("FIXED %d vertices lost their arm weight (%d handed to the nearest body bone)" % (cut, moved))
# soften the new edge between arm and body, so the skin there bends instead of tearing into a sliver
bpy.ops.object.select_all(action="DESELECT")
ob.select_set(True); bpy.context.view_layer.objects.active = ob
bpy.ops.object.mode_set(mode="WEIGHT_PAINT")
bpy.ops.object.vertex_group_smooth(group_select_mode="ALL", factor=0.5, repeat=SMOOTH)
bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=4)
bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL", lock_active=False)
bpy.ops.object.mode_set(mode="OBJECT")
print("SMOOTHED the weights %d times" % SMOOTH)
bpy.ops.wm.save_as_mainfile(filepath=SRC)
print("SAVED", SRC)
