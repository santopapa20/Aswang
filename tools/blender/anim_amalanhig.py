# The amalanhig's motions, written by hand on the skeleton from rig_humanoid.py. The legend is a corpse
# whose joints have set: it cannot bend, so it walks with locked knees, swinging each straight leg from
# the hip and rocking its body over it, arms held out in front. Ready-made motions bend every joint, so
# these are made here:
#   idle   standing hunched, swaying, the head twitching now and then
#   walk   the stiff-legged shamble (the game sets its rate from how fast the planted foot moves)
#   grab   rears back with both arms up, then lunges and closes them (played once)
#   hit    struck by the whip: snaps back, then settles into its hunch again (played once)
# Rising out of the grave and falling down when beaten are done by the game, tipping the whole body
# about its feet like a plank, which is how the stories tell it.
# Rotations are given in its own axes: X across (+ its left), Y front to back (it faces -Y), Z up.
# About X, + leans or nods forward (and swings a hanging arm or leg backward).
# usage: blender -b --factory-startup --python anim_amalanhig.py -- <amalanhig_rigged.blend> <out.glb>
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
def mix(a, b, t): t = max(0.0, min(1.0, t)); t = t * t * (3 - 2 * t); return a + (b - a) * t
def pulse(t, at, width=0.04): return math.exp(-((t - at) / width) ** 2)

def arms(lift, inward=12, fore=-12, hand=18, swing=0.0):
    """Both arms held out in front: lift is how far forward and up (degrees from hanging)."""
    set_rot("LeftArm", [("Y", inward), ("X", -lift - swing)])
    set_rot("RightArm", [("Y", -inward), ("X", -lift + swing)])
    set_rot("LeftForeArm", [("X", fore)]); set_rot("RightForeArm", [("X", fore)])
    set_rot("LeftHand", [("X", hand)]); set_rot("RightHand", [("X", hand)])

def hunch(spine1=7, spine2=7, neck=-8, head=0, head_turn=0, roll=0, yaw=0):
    set_rot("Spine", [("Y", roll), ("Z", yaw)])
    set_rot("Spine1", [("X", spine1)])
    set_rot("Spine2", [("X", spine2)])
    set_rot("Neck", [("X", neck)])
    set_rot("Head", [("X", head), ("Z", head_turn)])

def idle(t):
    sway = math.sin(t * TAU)
    twitch = pulse(t, 0.32) - 0.8 * pulse(t, 0.36) + 0.9 * pulse(t, 0.74, 0.03)
    hunch(spine1=7 + 1.5 * math.sin(t * TAU * 2), roll=3.5 * sway, head=4 * pulse(t, 0.55, 0.08), head_turn=22 * twitch)
    arms(22 + 3 * math.sin(t * TAU + 0.8), swing=2 * sway)

def walk(t):
    s = math.sin(t * TAU)
    swing = 17 * s                                        # + : its left leg forward
    set_rot("LeftUpLeg", [("X", -swing)]); set_rot("RightUpLeg", [("X", swing)])
    set_rot("LeftFoot", [("X", 0.85 * swing)]); set_rot("RightFoot", [("X", -0.85 * swing)])
    # the knees never bend; the body rocks over the leg it stands on and turns with the stride
    hunch(spine1=9, spine2=7, neck=-12, roll=7 * math.cos(t * TAU), yaw=-8 * s, head=3 * abs(s), head_turn=4 * s)
    arms(48, swing=5 * s)

def grab(t):
    rear = mix(0, 1, t / 0.32) * (1 - mix(0, 1, (t - 0.32) / 0.2))      # rears back and up
    lunge = mix(0, 1, (t - 0.32) / 0.2)                                  # throws itself forward
    close = mix(0, 1, (t - 0.5) / 0.25)                                  # and closes its arms
    hunch(spine1=7 - 14 * rear + 22 * lunge, spine2=7 - 6 * rear + 10 * lunge, neck=-8 - 10 * rear - 6 * lunge, head=8 * lunge)
    arms(40 + 75 * rear + 45 * lunge, inward=12 + 26 * close, fore=-12 - 20 * close, hand=18 + 20 * close)

def hit(t):
    snap = mix(0, 1, t / 0.12) * (1 - mix(0, 1, (t - 0.25) / 0.6))
    hunch(spine1=7 - 26 * snap, spine2=7 - 12 * snap, neck=-8 - 10 * snap, head=-24 * snap, head_turn=18 * snap, roll=-6 * snap)
    arms(22 - 30 * snap, inward=12 - 30 * snap, fore=-12 + 8 * snap)

CLIPS = [("idle", idle, 90), ("walk", walk, 40), ("grab", grab, 30), ("hit", hit, 24)]
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

arm.name = "amalanhig"; mesh.name = "amalanhig_mesh"
for m in mesh.data.materials: m.name = "amalanhig"
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.object.select_all(action="DESELECT"); arm.select_set(True); mesh.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format="GLB", use_selection=True,
                          export_image_format="WEBP", export_image_quality=88,
                          export_animations=True, export_animation_mode="NLA_TRACKS",
                          export_force_sampling=True, export_skins=True, export_def_bones=False, export_yup=True)
print("SAVED %s (%.1f MB)" % (OUT, os.path.getsize(OUT) / 1e6))
