# Rigs and animates the sigbin entirely by script: it goes on four legs, so Mixamo cannot do it.
# Builds a skeleton (hips, spine, chest, neck, head, four tail bones, three bones per fore leg and four
# per hind leg), skins the mesh, then writes the clips as hand-made motion. Each paw follows a target
# on the ground (inverse kinematics), so planted feet stay planted; the result is baked to plain bone
# rotations, which is all the game needs.
#   idle   breathing, head and tail swaying
#   walk   a stalking walk, 0.97 m/s at full size (the game plays it backwards: the sigbin walks tail-first)
#   run    a bounding run, 2.4 m/s at full size
#   feed   head down at the ground, lapping
# Output: <out>.glb with named clips, and <out>.blend.
#
# usage: blender -b --factory-startup --python rig_sigbin.py -- <model.blend> <rig_landmarks.json> <out.glb>
import bpy, bmesh, sys, json, math, os
from mathutils import Vector, Quaternion, Matrix

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, LMK, OUT = argv[0], argv[1], argv[2]
NAME = os.path.splitext(os.path.basename(OUT))[0]
cfg = json.load(open(LMK))

bpy.ops.wm.open_mainfile(filepath=SRC)
scene = bpy.context.scene
scene.render.fps = 30
ob = next(o for o in scene.objects if o.type == "MESH")
for o in list(scene.objects):
    if o is not ob: bpy.data.objects.remove(o)
me = ob.data
me.transform(ob.matrix_world); ob.matrix_world = Matrix.Identity(4)
me.validate(verbose=False)
for g in list(ob.vertex_groups): ob.vertex_groups.remove(g)

V = lambda p, sx=1: Vector((p[0] * sx, p[1], p[2]))

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
bone("Hips", V(cfg["hips"]), V(cfg["spine"]))
bone("Spine", V(cfg["spine"]), V(cfg["chest"]), "Hips", True)
bone("Chest", V(cfg["chest"]), V(cfg["neck"]), "Spine", True)
bone("Neck", V(cfg["neck"]), V(cfg["head"]), "Chest", True)
bone("Head", V(cfg["head"]), V(cfg["head_end"]), "Neck", True)
tail = cfg["tail"]
for i in range(len(tail) - 1):
    bone("Tail%d" % (i + 1), V(tail[i]), V(tail[i + 1]), "Hips" if i == 0 else "Tail%d" % i, i > 0)
FORE = ["UpperArm", "ForeArm", "ForePaw"]
HIND = ["Thigh", "Shin", "Hock", "HindPaw"]
for s, sx in (("L", 1), ("R", -1)):
    for i, n in enumerate(FORE):
        bone(n + "." + s, V(cfg["fore"][i], sx), V(cfg["fore"][i + 1], sx), "Chest" if i == 0 else FORE[i - 1] + "." + s, i > 0)
    for i, n in enumerate(HIND):
        bone(n + "." + s, V(cfg["hind"][i], sx), V(cfg["hind"][i + 1], sx), "Hips" if i == 0 else HIND[i - 1] + "." + s, i > 0)
bpy.ops.object.mode_set(mode="OBJECT")
print("SKELETON bones", len(arm_data.bones))

# ---- skin: automatic weights, worked out on a rebuilt stand-in surface if the model itself defeats them
def unweighted(o): return sum(1 for v in o.data.vertices if not any(g.weight > 0 for g in v.groups))
def auto(o):
    bpy.ops.object.select_all(action="DESELECT")
    o.select_set(True); arm.select_set(True)
    bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
auto(ob)
if unweighted(ob) > 0:
    print("SKIN automatic weights failed on the model itself; using a rebuilt stand-in surface")
    for g in list(ob.vertex_groups): ob.vertex_groups.remove(g)
    for m in list(ob.modifiers): ob.modifiers.remove(m)
    ob.parent = None; ob.matrix_world = Matrix.Identity(4)
    proxy = ob.copy(); proxy.data = me.copy(); proxy.name = "stand_in"
    scene.collection.objects.link(proxy)
    bpy.ops.object.select_all(action="DESELECT")
    proxy.select_set(True); bpy.context.view_layer.objects.active = proxy
    proxy.data.remesh_voxel_size = max(ob.dimensions) / 260
    proxy.data.remesh_voxel_adaptivity = 0.0
    bpy.ops.object.voxel_remesh()
    auto(proxy)
    bad = [v.index for v in proxy.data.vertices if not any(g.weight > 0 for g in v.groups)]
    if len(bad) > len(proxy.data.vertices) * 0.02:
        print("ERROR automatic weights failed on the stand-in too (%d vertices)" % len(bad)); sys.exit(1)
    if bad:
        bm = bmesh.new(); bm.from_mesh(proxy.data); bm.verts.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[bm.verts[i] for i in bad], context="VERTS")
        bm.to_mesh(proxy.data); bm.free()
    mod = ob.modifiers.new("copy_weights", "DATA_TRANSFER")
    mod.object = proxy; mod.use_vert_data = True; mod.data_types_verts = {"VGROUP_WEIGHTS"}
    mod.vert_mapping = "POLYINTERP_NEAREST"
    mod.layers_vgroup_select_src = "ALL"; mod.layers_vgroup_select_dst = "NAME"
    bpy.ops.object.select_all(action="DESELECT")
    ob.select_set(True); bpy.context.view_layer.objects.active = ob
    bpy.ops.object.datalayout_transfer(modifier=mod.name)
    bpy.ops.object.modifier_apply(modifier=mod.name)
    ob.parent = arm
    ob.modifiers.new("Armature", "ARMATURE").object = arm
    pm = proxy.data
    bpy.data.objects.remove(proxy); bpy.data.meshes.remove(pm)
bpy.ops.object.select_all(action="DESELECT")
ob.select_set(True); bpy.context.view_layer.objects.active = ob
bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=4)
bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL", lock_active=False)
print("SKIN vertices following nothing: %d of %d" % (unweighted(ob), len(me.vertices)))

# ---- paw controls: each leg reaches for a target, and the paw keeps the target's tilt
feet = {}
for s in ("L", "R"):
    for kind, reach, paw, chain in (("F", "ForeArm." + s, "ForePaw." + s, 2), ("H", "Hock." + s, "HindPaw." + s, 3)):
        e = bpy.data.objects.new("ctl_" + kind + s, None)
        scene.collection.objects.link(e)
        e.rotation_mode = "QUATERNION"
        c = arm.pose.bones[reach].constraints.new("IK"); c.target = e; c.chain_count = chain; c.use_stretch = False
        c2 = arm.pose.bones[paw].constraints.new("COPY_ROTATION"); c2.target = e
        feet[kind + s] = (e, arm.data.bones[paw].head_local.copy(), arm.data.bones[paw].matrix_local.to_quaternion())
def foot(key, dy=0.0, dz=0.0, pitch=0.0):
    """Move a paw from where it stands: dy back (+) or forward (-), dz up, pitch toes-down in degrees."""
    e, home, rq = feet[key]
    e.location = home + Vector((0, dy, dz))
    e.rotation_quaternion = Quaternion((1, 0, 0), math.radians(pitch)) @ rq
def step(a, duty, stride, lift):
    """One leg's cycle. On the ground for `duty` of it, sliding back under the body; then lifted forward."""
    a %= 1.0
    if a < duty: return -stride / 2 + stride * (a / duty), 0.0, 0.0
    s = (a - duty) / (1 - duty)
    return stride / 2 - stride * (0.5 - 0.5 * math.cos(math.pi * s)), lift * math.sin(math.pi * s), 26 * math.sin(math.pi * s)

# ---- motion. Rotations are given in its own axes: X across, Y nose-to-tail (the nose is at -Y), Z up.
# About X, a positive angle lowers the head (and lifts the tail); about Z it turns side to side.
AX = {"X": Vector((1, 0, 0)), "Y": Vector((0, 1, 0)), "Z": Vector((0, 0, 1))}
def set_rot(name, rots):
    q = Quaternion()
    for axis, deg in rots: q = Quaternion(AX[axis], math.radians(deg)) @ q
    R = arm.data.bones[name].matrix_local.to_3x3()
    pb = arm.pose.bones[name]
    pb.rotation_mode = "QUATERNION"
    pb.rotation_quaternion = (R.inverted() @ q.to_matrix() @ R).to_quaternion()
def set_lift(dz, dy=0.0, dx=0.0):
    R = arm.data.bones["Hips"].matrix_local.to_3x3()
    arm.pose.bones["Hips"].location = R.inverted() @ Vector((dx, dy, dz))
TAU = 2 * math.pi
def tail_sway(t, amount, speed=1.0, lift=0.0):
    for i in range(1, 5):
        set_rot("Tail%d" % i, [("Z", amount * (0.5 + 0.3 * i) * math.sin(t * TAU * speed - i * 0.7)), ("X", lift)])

def pose_idle(t):
    b = math.sin(t * TAU)
    set_lift(0.006 * b)
    set_rot("Spine", [("X", 1.0 * b)]); set_rot("Chest", [("X", -1.2 * b)])
    set_rot("Neck", [("Z", 7 * math.sin(t * TAU)), ("X", 2 * math.sin(t * TAU * 2))])
    set_rot("Head", [("Z", 5 * math.sin(t * TAU - 0.8)), ("X", 3 * math.sin(t * TAU * 2 - 0.5))])
    tail_sway(t, 9)
    for k in feet: foot(k)

def pose_walk(t):
    # a stalking walk, one paw at a time: left hind, left fore, right hind, right fore
    for k, ph in (("HL", 0.0), ("FL", 0.25), ("HR", 0.5), ("FR", 0.75)):
        dy, dz, pitch = step(t + ph, 0.62, 0.26, 0.05)
        foot(k, dy, dz, pitch)
    set_lift(-0.012 + 0.004 * math.sin(t * TAU * 2), dx=-0.010 * math.sin((t - 0.56) * TAU))
    set_rot("Hips", [("Z", 3 * math.sin(t * TAU))])
    set_rot("Spine", [("Z", -3 * math.sin(t * TAU))]); set_rot("Chest", [("Z", -3 * math.sin(t * TAU))])
    set_rot("Neck", [("Z", 3 * math.sin(t * TAU)), ("X", 2 * math.sin(t * TAU * 2))])
    set_rot("Head", [("X", 3 + 2 * math.sin(t * TAU * 2 - 0.6))])
    tail_sway(t, 11)

def pose_run(t):
    # a bounding run: the hind pair drives, a moment in the air, the fore pair lands, the back flexing between
    for k, ph in (("HL", 0.0), ("HR", 0.07), ("FL", 0.48), ("FR", 0.55)):
        dy, dz, pitch = step(t + ph, 0.36, 0.30, 0.09)
        foot(k, dy + (0.03 if k[0] == "F" else 0.0), dz, pitch * 1.5)
    tip = -6 * math.cos((t - 0.18) * TAU)                 # nose up as the hind legs push, down as the fore legs land
    arch = 6 * math.sin((t - 0.43) * TAU)
    set_lift(0.004 + 0.022 * math.cos((t - 0.44) * TAU * 2), dy=-0.012 * math.cos((t - 0.3) * TAU))
    set_rot("Hips", [("X", tip)])
    set_rot("Spine", [("X", arch)]); set_rot("Chest", [("X", arch * 0.6)])
    set_rot("Neck", [("X", -(tip + arch * 1.6) * 0.55 - 5)]); set_rot("Head", [("X", -(tip + arch) * 0.3 - 3)])
    tail_sway(t, 4, lift=7 + 4 * math.sin((t - 0.2) * TAU))

def pose_feed(t):
    # forequarters crouched, head right down at the ground, lapping; the tail quivering
    lap = math.sin(t * TAU * 6)
    set_lift(-0.014 + 0.002 * math.sin(t * TAU))
    set_rot("Spine", [("X", 3)]); set_rot("Chest", [("X", 5)])
    set_rot("Neck", [("X", 10 + 1.5 * lap), ("Z", 4 * math.sin(t * TAU))])
    set_rot("Head", [("X", 6 + 4 * lap)])
    tail_sway(t, 3, speed=4, lift=-3)
    for k in feet: foot(k)

CLIPS = [("idle", pose_idle, 48), ("walk", pose_walk, 22), ("run", pose_run, 18), ("feed", pose_feed, 40)]
names = [b.name for b in arm.data.bones]
def capture():
    """Where every bone ended up once the legs have reached for their targets."""
    bpy.context.view_layer.update()
    ev = arm.evaluated_get(bpy.context.evaluated_depsgraph_get())
    return {n: ev.pose.bones[n].matrix.copy() for n in names}
def at_rest():
    for pb in arm.pose.bones:
        pb.rotation_mode = "QUATERNION"; pb.rotation_quaternion = Quaternion(); pb.location = (0, 0, 0)
    for k in feet: foot(k)
captured = []
worst = 0.0
for clip, fn, frames in CLIPS:
    shots = []
    for f in range(frames + 1):
        at_rest(); fn(f / frames)
        shots.append(capture())
        for k, (e, home, rq) in feet.items():      # how far each paw ended up from its target
            paw = ("ForePaw." if k[0] == "F" else "HindPaw.") + k[1]
            worst = max(worst, (shots[-1][paw].translation - e.location).length)
    captured.append((clip, shots))
print("REACH furthest a paw fell short of its target: %.3f" % worst)

# bake: drop the controls and write what they produced as plain rotations
for pb in arm.pose.bones:
    for c in list(pb.constraints): pb.constraints.remove(c)
for e, _, _ in feet.values(): bpy.data.objects.remove(e)
REST = {b.name: (b.parent.matrix_local.inverted() @ b.matrix_local) if b.parent else b.matrix_local.copy() for b in arm.data.bones}
PARENT = {b.name: b.parent.name if b.parent else None for b in arm.data.bones}
ad = arm.animation_data_create()
made = []
for clip, shots in captured:
    act = bpy.data.actions.new(clip); act.use_fake_user = True
    ad.action = act
    last = {}
    for f, M in enumerate(shots):
        for n in names:
            local = REST[n].inverted() @ ((M[PARENT[n]].inverted() @ M[n]) if PARENT[n] else M[n])
            q = local.to_quaternion()
            if n in last: q.make_compatible(last[n])
            last[n] = q.copy()
            pb = arm.pose.bones[n]
            pb.rotation_quaternion = q
            pb.keyframe_insert("rotation_quaternion", frame=f + 1)
            if n == "Hips":
                pb.location = local.translation
                pb.keyframe_insert("location", frame=f + 1)
    made.append((clip, act))
    print("CLIP %-5s %d frames (%.1f s)" % (clip, len(shots) - 1, (len(shots) - 1) / 30))
ad.action = None
for pb in arm.pose.bones:
    pb.rotation_quaternion = Quaternion(); pb.location = (0, 0, 0)
for clip, act in made:
    track = ad.nla_tracks.new(); track.name = clip
    track.strips.new(clip, 1, act); track.mute = True

# ---- real-world size
s = float(cfg.get("scale_to_metres", 1.0))
arm.scale = (s, s, s)
bpy.context.view_layer.update()
print("SIZE nose to tail tip %.2f m, height at the rump %.2f m" % ((cfg["tail"][-1][1] - cfg["head_end"][1]) * s, max(v.co.z for v in me.vertices) * s))

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
