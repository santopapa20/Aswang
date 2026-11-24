# Nong Kadyo's motions, written by hand on the skeleton from rig_humanoid.py. He keeps the pose he was
# modelled in (stick in his right hand, lantern held up in his left), so ready-made motions, which assume
# arms held out, would bend the stick and swing the lantern through him. These keep the pose and move only
# what an old man standing at his door moves:
#   idle   breathing, a slow sway, the lantern drifting a little in his raised hand
#   talk   nodding as he speaks, leaning in, the lantern lifted to see by
# The game turns his head toward the player on top of these.
# Rotations are given in his own axes: X across (+ his left), Y front to back (he faces -Y), Z up.
# About X, + leans or nods forward; about Z, + turns toward his left.
# usage: blender -b --factory-startup --python anim_kadyo.py -- <kadyo_rigged.blend> <out.glb>
import bpy, sys, math, os
from mathutils import Quaternion, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
bpy.ops.wm.open_mainfile(filepath=SRC)
scene = bpy.context.scene
scene.render.fps = 30
arm = next(o for o in scene.objects if o.type == "ARMATURE")
mesh = next(o for o in scene.objects if o.type == "MESH")
AX = {"X": Vector((1, 0, 0)), "Y": Vector((0, 1, 0)), "Z": Vector((0, 0, 1))}
P = "mixamorig:"

def set_rot(name, rots):
    q = Quaternion()
    for axis, deg in rots: q = Quaternion(AX[axis], math.radians(deg)) @ q
    R = arm.data.bones[P + name].matrix_local.to_3x3()
    pb = arm.pose.bones[P + name]
    pb.rotation_mode = "QUATERNION"
    pb.rotation_quaternion = (R.inverted() @ q.to_matrix() @ R).to_quaternion()

TAU = 2 * math.pi
def idle(t):
    breath = math.sin(t * TAU * 2)                       # two slow breaths a loop
    sway = math.sin(t * TAU)
    set_rot("Hips", [("Y", 0.5 * sway)])
    set_rot("Spine1", [("X", -0.9 * breath)])
    set_rot("Spine2", [("X", -0.7 * breath)])
    set_rot("Neck", [("Z", 3.0 * math.sin(t * TAU - 0.6)), ("X", 0.8 * breath)])
    set_rot("Head", [("X", 1.2 * math.sin(t * TAU * 2 + 0.5)), ("Y", 1.5 * sway)])
    set_rot("LeftShoulder", [("Y", 1.2 * breath)])
    set_rot("RightShoulder", [("Y", -0.8 * breath)])
    set_rot("LeftArm", [("Y", 1.6 * math.sin(t * TAU + 1.0))])
    set_rot("LeftForeArm", [("X", 1.8 * math.sin(t * TAU + 2.0))])

def talk(t):
    nod = math.sin(t * TAU * 2)
    set_rot("Hips", [("Y", 0.4 * math.sin(t * TAU))])
    set_rot("Spine1", [("X", 1.5 + 0.6 * math.sin(t * TAU * 2 + 1.0))])
    set_rot("Spine2", [("X", 2.0 + 0.8 * nod)])
    set_rot("Neck", [("X", 3.0 + 3.0 * nod), ("Z", 2.5 * math.sin(t * TAU))])
    set_rot("Head", [("X", 2.5 * math.sin(t * TAU * 3 + 0.7)), ("Y", 3.0 * math.sin(t * TAU + 0.3))])
    set_rot("LeftShoulder", [("Y", 2.0 + 1.5 * math.sin(t * TAU))])
    set_rot("LeftArm", [("Y", 3.0 + 2.5 * math.sin(t * TAU))])          # lifts the lantern to see your face by
    set_rot("LeftForeArm", [("X", -3.0 * math.sin(t * TAU + 0.8))])

CLIPS = [("idle", idle, 150), ("talk", talk, 90)]
ad = arm.animation_data_create()
for pb in arm.pose.bones: pb.rotation_mode = "QUATERNION"
made = []
for name, fn, frames in CLIPS:
    act = bpy.data.actions.new(name); act.use_fake_user = True
    ad.action = act
    for f in range(frames + 1):
        for pb in arm.pose.bones: pb.rotation_quaternion = Quaternion()
        fn(f / frames)
        for pb in arm.pose.bones: pb.keyframe_insert("rotation_quaternion", frame=f + 1)
    made.append((name, act))
    print("CLIP %-5s %d frames (%.1f s)" % (name, frames, frames / 30))
ad.action = None
for pb in arm.pose.bones: pb.rotation_quaternion = Quaternion()
for name, act in made:
    tr = ad.nla_tracks.new(); tr.name = name
    tr.strips.new(name, 1, act); tr.mute = True

arm.name = "kadyo"; mesh.name = "kadyo_mesh"
for m in mesh.data.materials: m.name = "kadyo"
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.object.select_all(action="DESELECT"); arm.select_set(True); mesh.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format="GLB", use_selection=True,
                          export_image_format="WEBP", export_image_quality=88,
                          export_animations=True, export_animation_mode="NLA_TRACKS",
                          export_force_sampling=True, export_skins=True, export_def_bones=False, export_yup=True)
print("SAVED %s (%.1f MB)" % (OUT, os.path.getsize(OUT) / 1e6))
