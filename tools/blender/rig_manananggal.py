# Rigs and animates the manananggal entirely by script, because Mixamo cannot do wings or flying.
# Builds a skeleton (spine, neck, head, two arms, and for each wing a wing-arm plus four finger
# bones that carry the membrane), skins the mesh with Blender's automatic weights, then writes the
# clips as hand-made motion: hover, fly, dive, shriek. The wings beat forward and back, not up and down. Output: <out>.glb with named clips and <out>.blend.
#
# usage: blender -b --factory-startup --python rig_manananggal.py -- <model.blend> <landmarks.json> <out.glb>
import bpy, sys, json, math, os
from mathutils import Vector, Quaternion

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, LMK, OUT = argv[0], argv[1], argv[2]
NAME = os.path.splitext(os.path.basename(OUT))[0]
cfg = json.load(open(LMK))

bpy.ops.wm.open_mainfile(filepath=SRC)
scene = bpy.context.scene
scene.render.fps = 30
ob = next(o for o in scene.objects if o.type == "MESH")
me = ob.data
co = [v.co.copy() for v in me.vertices]

def depth(x, z, r=0.03):
    """Middle of the mesh in depth (y) around a point seen from the front."""
    ys = [c.y for c in co if abs(c.x - x) < r and abs(c.z - z) < r]
    return (min(ys) + max(ys)) / 2 if ys else 0.0
def P(key, side=1, idx=None):
    x, z = cfg[key] if idx is None else cfg[key][idx]
    y = (depth(x, z) + depth(-x, z)) / 2          # keep the skeleton symmetrical
    return Vector((x * side, y, z))

# ---- skeleton
arm_data = bpy.data.armatures.new(NAME + "_rig")
arm = bpy.data.objects.new(NAME, arm_data)
scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
def bone(name, head, tail, parent=None, connect=False):
    b = arm_data.edit_bones.new(name)
    b.head, b.tail = head, tail
    if parent: b.parent = arm_data.edit_bones[parent]; b.use_connect = connect
bone("Spine", P("spine"), P("chest"))
bone("Chest", P("chest"), P("neck"), "Spine", True)
bone("Neck", P("neck"), P("head"), "Chest", True)
bone("Head", P("head"), P("head_top"), "Neck", True)
for s, sx in (("L", 1), ("R", -1)):
    bone("Shoulder." + s, P("chest") + Vector((0.03 * sx, 0, 0.02)), P("shoulder", sx), "Chest")
    bone("UpperArm." + s, P("shoulder", sx), P("elbow", sx), "Shoulder." + s, True)
    bone("ForeArm." + s, P("elbow", sx), P("wrist", sx), "UpperArm." + s, True)
    bone("Hand." + s, P("wrist", sx), P("hand_tip", sx), "ForeArm." + s, True)
    bone("Wing." + s, P("wing_root", sx), P("wing_hub", sx), "Chest")
    for i in range(len(cfg["wing_tips"])):
        bone("WingFinger%d.%s" % (i + 1, s), P("wing_hub", sx), P("wing_tips", sx, i), "Wing." + s)
bpy.ops.object.mode_set(mode="OBJECT")
print("SKELETON bones", len(arm_data.bones))

# ---- skin
bpy.ops.object.select_all(action="DESELECT")
ob.select_set(True); arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type="ARMATURE_AUTO")
unweighted = sum(1 for v in me.vertices if not any(g.weight > 0 for g in v.groups))
print("SKIN vertices with no weight: %d of %d" % (unweighted, len(me.vertices)))
if unweighted > len(me.vertices) * 0.2:
    print("ERROR automatic weights failed"); sys.exit(1)

# ---- motion. Rotations are given in her own axes: X across, Y front-to-back, Z up.
AX = {"X": Vector((1, 0, 0)), "Y": Vector((0, 1, 0)), "Z": Vector((0, 0, 1))}
def set_rot(name, rots):
    q = Quaternion()
    for axis, deg in rots: q = Quaternion(AX[axis], math.radians(deg)) @ q
    R = arm.data.bones[name].matrix_local.to_3x3()
    pb = arm.pose.bones[name]
    pb.rotation_mode = "QUATERNION"
    pb.rotation_quaternion = (R.inverted() @ q.to_matrix() @ R).to_quaternion()
def set_lift(dz, dy=0.0):
    R = arm.data.bones["Spine"].matrix_local.to_3x3()
    arm.pose.bones["Spine"].location = R.inverted() @ Vector((0, dy, dz))

def wings(beat, lag, spread=0.0, lift=0.0):
    """
    beat: degrees the wings swing forward (+) or back (-), like oars. This is the main stroke.
    lag: the same for the outer wing, which trails behind the wing arm.
    spread: fans the fingers apart (+) or together (-). lift: raises (-) or lowers (+) the whole wing.
    """
    for s, sx in (("L", 1), ("R", -1)):
        set_rot("Wing." + s, [("Y", lift * sx), ("Z", -beat * sx), ("X", beat * 0.55)])
        for i in range(4):
            outer = lag * (0.6 + 0.2 * i)
            fan = (i - 1.5) * spread
            set_rot("WingFinger%d.%s" % (i + 1, s), [("Y", fan * sx), ("Z", -outer * sx), ("X", outer * 0.4)])

def pose_hover(t):                       # t goes 0..1 round the loop
    a = math.sin(t * 2 * math.pi); b = math.sin(t * 2 * math.pi - 0.9)
    wings(30 * a, 18 * b, spread=2 * a, lift=5 * math.sin(t * 4 * math.pi))
    set_lift(0.018 * math.sin(t * 2 * math.pi - 1.6))
    set_rot("Spine", [("X", 4 + 2 * a)]); set_rot("Chest", [("X", 3 * b)])
    set_rot("Head", [("X", -6 + 2 * b), ("Z", 5 * math.sin(t * 2 * math.pi * 0.5))])
    for s, sx in (("L", 1), ("R", -1)):
        set_rot("UpperArm." + s, [("Y", (10 + 5 * b) * sx), ("X", -8 + 4 * a)])
        set_rot("ForeArm." + s, [("X", -22 + 6 * b)])
        set_rot("Hand." + s, [("X", -12 + 8 * a)])

def pose_fly(t):
    a = math.sin(t * 2 * math.pi); b = math.sin(t * 2 * math.pi - 1.0)
    wings(34 * a - 10, 20 * b, spread=3 * a, lift=-6)
    set_lift(0.014 * math.sin(t * 2 * math.pi - 1.6))
    set_rot("Spine", [("X", 38)]); set_rot("Chest", [("X", 6 + 3 * b)])
    set_rot("Neck", [("X", -18)]); set_rot("Head", [("X", -22)])
    for s, sx in (("L", 1), ("R", -1)):
        set_rot("UpperArm." + s, [("Y", 22 * sx), ("X", 30 + 5 * b)])
        set_rot("ForeArm." + s, [("X", -18 + 5 * a)])
        set_rot("Hand." + s, [("X", -10)])

def pose_dive(t):                        # plays once: fold, plunge, claws forward
    k = min(1.0, t / 0.35); k = k * k * (3 - 2 * k)
    shake = math.sin(t * 2 * math.pi * 5) * (1 - k) * 2
    wings(-44 * k + shake, -16 * k, spread=-5 * k, lift=-22 * k)
    set_lift(-0.03 * k, -0.04 * k)
    set_rot("Spine", [("X", 62 * k)]); set_rot("Chest", [("X", 10 * k)])
    set_rot("Neck", [("X", -30 * k)]); set_rot("Head", [("X", -32 * k)])
    for s, sx in (("L", 1), ("R", -1)):
        set_rot("UpperArm." + s, [("Y", -6 * k * sx), ("X", -105 * k)])
        set_rot("ForeArm." + s, [("X", -24 * k)])
        set_rot("Hand." + s, [("X", -26 * k)])

def pose_shriek(t):                      # plays once: rear back, wings wide, then settle
    env = math.sin(min(1.0, t / 0.9) * math.pi) ** 0.6
    tremble = math.sin(t * 2 * math.pi * 9) * env
    wings(16 * env + 3 * tremble, 8 * env, spread=6 * env, lift=-18 * env)
    set_lift(0.03 * env)
    set_rot("Spine", [("X", -14 * env)]); set_rot("Chest", [("X", -10 * env)])
    set_rot("Neck", [("X", -16 * env)]); set_rot("Head", [("X", -20 * env + 2 * tremble), ("Z", 4 * tremble)])
    for s, sx in (("L", 1), ("R", -1)):
        set_rot("UpperArm." + s, [("Y", -34 * env * sx), ("X", 14 * env)])
        set_rot("ForeArm." + s, [("X", -38 * env)])
        set_rot("Hand." + s, [("X", -30 * env + 6 * tremble)])

CLIPS = [("hover", pose_hover, 36), ("fly", pose_fly, 24), ("dive", pose_dive, 30), ("shriek", pose_shriek, 48)]
ad = arm.animation_data_create()
made = []
for clip, fn, frames in CLIPS:
    act = bpy.data.actions.new(clip); act.use_fake_user = True
    ad.action = act
    for f in range(frames + 1):
        for pb in arm.pose.bones:
            pb.rotation_mode = "QUATERNION"; pb.rotation_quaternion = Quaternion(); pb.location = (0, 0, 0)
        fn(f / frames)
        for pb in arm.pose.bones:
            pb.keyframe_insert("rotation_quaternion", frame=f + 1)
        arm.pose.bones["Spine"].keyframe_insert("location", frame=f + 1)
    made.append((clip, act))
    print("CLIP %-7s %d frames (%.1f s)" % (clip, frames, frames / 30))
ad.action = None
for pb in arm.pose.bones:
    pb.rotation_quaternion = Quaternion(); pb.location = (0, 0, 0)
for clip, act in made:
    track = ad.nla_tracks.new(); track.name = clip
    track.strips.new(clip, 1, act); track.mute = True

# ---- real-world size, standing height unchanged in shape
s = float(cfg.get("scale_to_metres", 1.0))
arm.scale = (s, s, s)
bpy.context.view_layer.update()
print("SIZE wing span %.2f m, waist to crown %.2f m" % ((max(c.x for c in co) - min(c.x for c in co)) * s, (cfg["head_top"][1] - cfg["spine"][1]) * s))

for m in me.materials: m.name = NAME
arm.name = NAME; ob.name = NAME + "_mesh"
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
blend = os.path.splitext(os.path.abspath(OUT))[0] + ".blend"
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=blend)
bpy.ops.object.select_all(action="DESELECT"); arm.select_set(True); ob.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format="GLB", use_selection=True,
                          export_image_format="WEBP", export_image_quality=88,
                          export_animations=True, export_animation_mode="NLA_TRACKS",
                          export_force_sampling=True, export_skins=True, export_def_bones=False, export_yup=True)
print("SAVED %s (%.1f MB) and %s (%.1f MB)" % (OUT, os.path.getsize(OUT) / 1e6, blend, os.path.getsize(blend) / 1e6))
