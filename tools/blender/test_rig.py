# Deformation test, NOT the final animation. Takes the output of prepare_for_rig.py, builds a plain
# humanoid skeleton from measured joint positions, skins the mesh with Blender's automatic weights,
# puts it in a few hand-set poses (walk, run, crouch, arms up) and renders them, so we can see how
# the mesh bends before spending time in Mixamo. It also prints how much the surface stretches.
#
# usage: blender -b --factory-startup --python test_rig.py -- <model_rigready.blend> <landmarks.json> <out_dir> <mode> [weights_from.blend]
#   weights_from  another rig-ready model of the same character with a cleaner surface. Blender's automatic
#                 weights are worked out on that one and copied across by nearest point. Use it when the
#                 automatic weights fail on the model itself (they need a clean, closed surface).
#   mode  auto    automatic weights untouched
#         rigid   hanging props (garlic, sash tails) follow the hip bone only
#         follow  hanging props follow the hips at the top and the thigh on their side at the bottom
import bpy, bmesh, sys, json, math, os
from mathutils import Vector, Quaternion, Matrix

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, LMK, OUT, MODE = argv[0], argv[1], argv[2], argv[3]
WFROM = argv[4] if len(argv) > 4 else None
os.makedirs(OUT, exist_ok=True)
L = json.load(open(LMK))
P = lambda k, side=1: Vector((L[k][0] * side, L[k][1], L[k][2]))

bpy.ops.wm.open_mainfile(filepath=SRC)
scene = bpy.context.scene
ob = next(o for o in scene.objects if o.type == "MESH")
me = ob.data

# ---- 1. remember which vertices belong to which hanging prop
gname = {g.index: g.name for g in ob.vertex_groups}
prop_of = {}
for v in me.vertices:
    for g in v.groups:
        if gname[g.group].startswith("prop_") and g.weight > 0.5: prop_of[v.index] = gname[g.group][5:]
print("MESH verts %d tris %d, prop vertices %d" % (len(me.vertices), len(me.polygons), len(prop_of)))

# ---- 2. skeleton
arm_data = bpy.data.armatures.new("TestRig")
arm = bpy.data.objects.new("TestRig", arm_data)
scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
def bone(name, head, tail, parent=None, connect=False):
    b = arm_data.edit_bones.new(name)
    b.head, b.tail = head, tail
    if parent: b.parent = arm_data.edit_bones[parent]; b.use_connect = connect
    return b
bone("Hips", P("hips"), P("spine"))
bone("Spine", P("spine"), P("chest"), "Hips", True)
bone("Chest", P("chest"), P("neck"), "Spine", True)
bone("Neck", P("neck"), P("head"), "Chest", True)
bone("Head", P("head"), P("head_top"), "Neck", True)
for s, sx in (("L", 1), ("R", -1)):
    bone("Clavicle." + s, P("clavicle", sx), P("shoulder", sx), "Chest")
    bone("UpperArm." + s, P("shoulder", sx), P("elbow", sx), "Clavicle." + s, True)
    bone("ForeArm." + s, P("elbow", sx), P("wrist", sx), "UpperArm." + s, True)
    bone("Hand." + s, P("wrist", sx), P("hand_tip", sx), "ForeArm." + s, True)
    bone("Thigh." + s, P("hip", sx), P("knee", sx), "Hips")
    bone("Shin." + s, P("knee", sx), P("ankle", sx), "Thigh." + s, True)
    bone("Foot." + s, P("ankle", sx), P("toe", sx), "Shin." + s, True)
    bone("Toe." + s, P("toe", sx), P("toe_tip", sx), "Foot." + s, True)
bpy.ops.object.mode_set(mode="OBJECT")

# ---- 3. automatic weights
for g in list(ob.vertex_groups): ob.vertex_groups.remove(g)      # props are remembered in prop_of
skin = ob
if WFROM:
    with bpy.data.libraries.load(os.path.abspath(WFROM)) as (lib_src, lib_dst):
        lib_dst.objects = list(lib_src.objects)
    skin = next(o for o in lib_dst.objects if o and o.type == "MESH")
    scene.collection.objects.link(skin)
    for g in list(skin.vertex_groups): skin.vertex_groups.remove(g)
bpy.ops.object.select_all(action="DESELECT")
skin.select_set(True); arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type="ARMATURE_AUTO")
if WFROM:
    mod = ob.modifiers.new("copy_weights", "DATA_TRANSFER")
    mod.object = skin; mod.use_vert_data = True; mod.data_types_verts = {"VGROUP_WEIGHTS"}
    mod.vert_mapping = "POLYINTERP_NEAREST"
    mod.layers_vgroup_select_src = "ALL"; mod.layers_vgroup_select_dst = "NAME"
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.datalayout_transfer(modifier=mod.name)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    ob.parent = arm
    ob.modifiers.new("Armature", "ARMATURE").object = arm
    skin_me = skin.data
    bpy.data.objects.remove(skin); bpy.data.meshes.remove(skin_me)
    print("WEIGHTS copied from", os.path.basename(WFROM))
unweighted = sum(1 for v in me.vertices if not any(g.weight > 0 for g in v.groups))
print("AUTO WEIGHTS groups %d, vertices with no weight %d of %d" % (len(ob.vertex_groups), unweighted, len(me.vertices)))
if unweighted > len(me.vertices) * 0.5:
    print("AUTO WEIGHTS FAILED"); sys.exit(1)

def set_weights(vi, weights):
    for g in ob.vertex_groups: g.remove([vi])
    for name, w in weights.items():
        if w > 0: ob.vertex_groups[name].add([vi], w, "REPLACE")

if MODE in ("rigid", "follow"):
    for pname, pcfg in L["props"].items():
        side = pcfg["side"]
        vs = [vi for vi, n in prop_of.items() if n == pname]
        top = max(me.vertices[vi].co.z for vi in vs); bot = min(me.vertices[vi].co.z for vi in vs)
        for vi in vs:
            if MODE == "rigid":
                set_weights(vi, {"Hips": 1.0})
            else:
                t = (top - me.vertices[vi].co.z) / (top - bot)
                t = max(0.0, min(1.0, (t - 0.15) / 0.85)) * 0.85
                set_weights(vi, {"Hips": 1.0 - t, "Thigh." + side: t})

# ---- 4. poses. Each entry: bone -> list of (axis, degrees), axes are the character's own:
# X = across the body (negative swings a limb forward), Y = front-to-back, Z = up.
AX = {"X": Vector((1, 0, 0)), "Y": Vector((0, 1, 0)), "Z": Vector((0, 0, 1))}
POSES = [
    ("rest", {}, 0.0),
    ("walk-contact", {"Thigh.R": [("X", -30)], "Shin.R": [("X", 8)], "Foot.R": [("X", -12)],
                      "Thigh.L": [("X", 22)], "Shin.L": [("X", 18)], "Foot.L": [("X", 20)],
                      "UpperArm.L": [("Y", 28), ("X", -25)], "ForeArm.L": [("X", -25)],
                      "UpperArm.R": [("Y", -28), ("X", 22)], "ForeArm.R": [("X", -12)],
                      "Chest": [("Z", -6)], "Hips": [("Z", 5)]}, -0.012),
    ("walk-passing", {"Thigh.R": [("X", -38)], "Shin.R": [("X", 68)], "Foot.R": [("X", 10)],
                      "Thigh.L": [("X", 4)], "Shin.L": [("X", 4)],
                      "UpperArm.L": [("Y", 28), ("X", -5)], "ForeArm.L": [("X", -18)],
                      "UpperArm.R": [("Y", -28), ("X", 5)], "ForeArm.R": [("X", -18)]}, 0.0),
    ("run", {"Hips": [("X", 8)], "Spine": [("X", 6)], "Chest": [("Z", -12)],
             "Thigh.R": [("X", -68)], "Shin.R": [("X", 85)],
             "Thigh.L": [("X", 28)], "Shin.L": [("X", 45)], "Foot.L": [("X", 30)],
             "UpperArm.L": [("Y", 30), ("X", -45)], "ForeArm.L": [("X", -90)],
             "UpperArm.R": [("Y", -30), ("X", 45)], "ForeArm.R": [("X", -80)]}, 0.0),
    ("crouch", {"Hips": [("X", 18)], "Spine": [("X", 12)], "Chest": [("X", 8)], "Neck": [("X", -20)],
                "Thigh.R": [("X", -95)], "Shin.R": [("X", 110)], "Foot.R": [("X", -25)],
                "Thigh.L": [("X", -70)], "Shin.L": [("X", 105)], "Foot.L": [("X", -30)],
                "UpperArm.L": [("Y", 20), ("X", -30)], "ForeArm.L": [("X", -60)],
                "UpperArm.R": [("Y", -20), ("X", -30)], "ForeArm.R": [("X", -60)]}, -0.17),
    ("arms-up", {"UpperArm.L": [("Y", -85)], "ForeArm.L": [("Y", -55)],
                 "UpperArm.R": [("X", -95), ("Y", 10)], "ForeArm.R": [("X", -70)],
                 "Head": [("Z", 35)], "Chest": [("Z", 12), ("X", -8)],
                 "Thigh.L": [("Y", -12)], "Thigh.R": [("X", 12)], "Shin.R": [("X", 15)]}, 0.0),
]
def apply_pose(spec, drop):
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"; pb.rotation_quaternion = Quaternion(); pb.location = (0, 0, 0)
    for name, rots in spec.items():
        q = Quaternion()
        for axis, deg in rots:
            q = Quaternion(AX[axis], math.radians(deg)) @ q
        R = arm.data.bones[name].matrix_local.to_3x3()
        arm.pose.bones[name].rotation_quaternion = (R.inverted() @ q.to_matrix() @ R).to_quaternion()
    Rh = arm.data.bones["Hips"].matrix_local.to_3x3()
    arm.pose.bones["Hips"].location = Rh.inverted() @ Vector((0, 0, drop))
    bpy.context.view_layer.update()

# ---- 5. stretch report + renders
rest_len = [(me.vertices[e.vertices[0]].co - me.vertices[e.vertices[1]].co).length for e in me.edges]
REGIONS = {"shoulders": lambda c: c.z > 0.72 and 0.06 < abs(c.x) < 0.15,
           "elbows": lambda c: 0.13 < abs(c.x) < 0.19 and 0.62 < c.z < 0.71,
           "hips+crotch": lambda c: 0.34 < c.z < 0.58 and abs(c.x) < 0.13,
           "knees": lambda c: 0.22 < c.z < 0.33}
rest_co = [v.co.copy() for v in me.vertices]
def stretch_report(name):
    dg = bpy.context.evaluated_depsgraph_get()
    ev = ob.evaluated_get(dg).to_mesh()
    out = []
    for rname, test in REGIONS.items():
        ratios = []
        for i, e in enumerate(me.edges):
            a, b = e.vertices
            if rest_len[i] > 1e-5 and test(rest_co[a]) and test(rest_co[b]):
                ratios.append((ev.vertices[a].co - ev.vertices[b].co).length / rest_len[i])
        ratios.sort()
        over = sum(1 for r in ratios if r > 1.5)
        out.append("%s p99 x%.2f max x%.1f (>1.5x: %d of %d)" % (rname, ratios[int(len(ratios) * 0.99)], ratios[-1], over, len(ratios)))
    ratios = sorted((ev.vertices[e.vertices[0]].co - ev.vertices[e.vertices[1]].co).length / rest_len[i]
                    for i, e in enumerate(me.edges)
                    if rest_len[i] > 1e-5 and e.vertices[0] in prop_of and e.vertices[1] in prop_of)
    out.append("garlic+sash tails p99 x%.2f max x%.1f" % (ratios[int(len(ratios) * 0.99)], ratios[-1]))
    ob.evaluated_get(dg).to_mesh_clear()
    print("STRETCH", MODE, name, "|", " | ".join(out))

scene.render.engine = "BLENDER_WORKBENCH"
sh = scene.display.shading
sh.light = "STUDIO"; sh.color_type = "TEXTURE"; sh.show_cavity = True; sh.cavity_type = "WORLD"
sh.show_backface_culling = False; sh.show_shadows = False
scene.render.resolution_x = 520; scene.render.resolution_y = 760
scene.render.film_transparent = False
if not scene.world: scene.world = bpy.data.worlds.new("w")
scene.world.color = (0.33, 0.34, 0.37)
scene.view_settings.view_transform = "Standard"
cam_data = bpy.data.cameras.new("cam"); cam_data.type = "ORTHO"
cam = bpy.data.objects.new("cam", cam_data); scene.collection.objects.link(cam); scene.camera = cam
arm.hide_render = True

def shoot(path, angle_deg, centre, scale, elev=8):
    a = math.radians(angle_deg); e = math.radians(elev)
    cam_data.ortho_scale = scale
    cam.location = centre + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * 5
    cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True)

VIEWS = [("front", -25), ("side", -90), ("back", 155)]          # the garlic side (his right) faces the camera
for name, spec, drop in POSES:
    apply_pose(spec, drop)
    stretch_report(name)
    c = Vector((0, 0, 0.49 + drop * 0.5))
    for vname, ang in VIEWS:
        shoot(os.path.join(OUT, "%s_%s_%s.png" % (MODE, name, vname)), ang, c, 1.12)
    if name in ("walk-contact", "run", "crouch"):
        scene.render.resolution_x = 760
        shoot(os.path.join(OUT, "%s_%s_closeup.png" % (MODE, name)), -40, Vector((0, -0.02, 0.47 + drop)), 0.5, elev=5)
        scene.render.resolution_x = 520

if MODE == "follow":
    apply_pose({}, 0.0)
    bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "test_rig.blend"))
print("DONE", MODE)
