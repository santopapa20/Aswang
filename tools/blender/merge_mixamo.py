# Merges Mixamo downloads into one game-ready GLB: the skinned character from the clip that was
# downloaded "With Skin", plus every other .fbx in the folder as a named animation clip (the clip
# name is the file name). The character's material is replaced by the full one from our own .blend
# (Mixamo drops the roughness map), and textures are written as WebP.
#
# Important: a "Without Skin" download carries a T-pose skeleton (arms straight out), while the
# skinned character is rigged in the pose it was uploaded in (arms down). The same numbers mean a
# different arm position on each, so every animation-only clip is retargeted: each frame is played
# on its own skeleton and the resulting joint placements are copied onto the character's skeleton.
#
# usage: blender -b --factory-startup --python merge_mixamo.py -- <downloads_dir> <material_source.blend> <out.glb> [--pronate DEG] [--arms-in DEG]
#   --pronate  for a model that was made with its palms facing forward. Mixamo expects palms facing the
#              thighs, so such a model hangs its hands palm-forward. This reshapes the model itself:
#              each forearm is turned about its own length, 0 degrees at the elbow rising smoothly to
#              DEG at the wrist, and the hand turns with it. Usually 90. The animations are untouched.
#   --arms-in  brings both upper arms DEG closer to the body in every clip. Mixamo leaves a model that was
#              rigged in an A-pose holding its arms slightly away from its sides; 6 to 10 looks natural.
import bpy, sys, os, glob, math
from mathutils import Quaternion

argv = sys.argv[sys.argv.index("--") + 1:]
DIR, MATSRC, OUT = argv[0], argv[1], argv[2]
NAME = os.path.splitext(os.path.basename(OUT))[0]
PRONATE = float(argv[argv.index("--pronate") + 1]) if "--pronate" in argv else 0.0
ARMS_IN = float(argv[argv.index("--arms-in") + 1]) if "--arms-in" in argv else 0.0

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30

def import_fbx(path):
    before_obj = set(bpy.data.objects); before_act = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False)
    return [o for o in bpy.data.objects if o not in before_obj], [a for a in bpy.data.actions if a not in before_act]

def has_mesh_objects(path_objs): return any(o.type == "MESH" for o in path_objs)

def remove_objects(objs):
    for o in objs:
        data = o.data
        bpy.data.objects.remove(o)
        if data and data.users == 0:
            (bpy.data.armatures if isinstance(data, bpy.types.Armature) else bpy.data.meshes).remove(data)

def retarget(src, src_act, clip):
    """Play src_act on its own skeleton and bake the same joint placements onto the character's skeleton."""
    new = bpy.data.actions.new(clip)
    ad = arm.animation_data or arm.animation_data_create()
    ad.action = new
    f0, f1 = int(src_act.frame_range[0]), int(src_act.frame_range[1])
    last = {}
    worst = 0.0
    for f in range(f0, f1 + 1):
        scene.frame_set(f)
        P = {pb.name: pb.matrix.copy() for pb in src.pose.bones}
        for pb in arm.pose.bones:                           # parents come before children
            if pb.name not in P: continue
            R = pb.bone.matrix_local
            if pb.parent and pb.parent.name in P:
                basis = (pb.parent.bone.matrix_local.inverted() @ R).inverted() @ (P[pb.parent.name].inverted() @ P[pb.name])
            else:
                basis = R.inverted() @ P[pb.name]
            q = basis.to_quaternion()
            if pb.name in last and last[pb.name].dot(q) < 0: q.negate()      # keep rotations continuous
            last[pb.name] = q
            pb.rotation_mode = "QUATERNION"
            pb.rotation_quaternion = q
            pb.keyframe_insert("rotation_quaternion", frame=f)
            if not pb.parent:
                pb.location = basis.to_translation()
                pb.keyframe_insert("location", frame=f)
        if f in (f0, (f0 + f1) // 2, f1):                   # check: do the joints land where the source put them?
            bpy.context.view_layer.update()
            for pb in arm.pose.bones:
                if pb.name in P: worst = max(worst, (pb.matrix.translation - P[pb.name].translation).length)
    ad.action = None
    for pb in arm.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
    print("RETARGET %-8s frames %d, largest joint mismatch %.1f mm" % (clip, f1 - f0 + 1, worst * 1000))
    return new

files = sorted(glob.glob(os.path.join(DIR, "*.fbx")))
arm = mesh = None
clips = []
pending = []                                                # animation-only clips, retargeted once the character is known
for f in files:
    clip = os.path.splitext(os.path.basename(f))[0]
    objs, acts = import_fbx(f)
    if len(acts) != 1:
        print("WARNING", clip, "has", len(acts), "actions")
    if has_mesh_objects(objs) and arm is None:
        arm = next(o for o in objs if o.type == "ARMATURE")
        mesh = next(o for o in objs if o.type == "MESH")
        acts[0].name = clip
        acts[0].use_fake_user = True
        clips.append((clip, acts[0]))
    else:
        acts[0].name = "src_" + clip
        pending.append((clip, objs, acts[0]))
if arm is None:
    print("ERROR no clip in", DIR, "contains the skinned character (download one With Skin)"); sys.exit(1)
for clip, objs, act in pending:
    src = next(o for o in objs if o.type == "ARMATURE")
    new = retarget(src, act, clip)
    new.use_fake_user = True
    clips.append((clip, new))
    remove_objects(objs)
    bpy.data.actions.remove(act)
clips.sort(key=lambda c: c[0])

if PRONATE:
    def bone_like(part):
        return next((b for b in arm.data.bones if b.name.replace(":", "").replace("mixamorig", "").lower() == part.lower()), None)
    me = mesh.data
    to_arm = arm.matrix_world.inverted() @ mesh.matrix_world      # mesh space -> skeleton space
    to_mesh = to_arm.inverted()
    moved = 0
    for side, sign in (("Left", 1.0), ("Right", -1.0)):
        fore, hand = bone_like(side + "ForeArm"), bone_like(side + "Hand")
        if not fore or not hand: continue
        elbow, wrist = fore.head_local.copy(), hand.head_local.copy()
        axis = (wrist - elbow); length = axis.length; axis.normalize()
        groups = {mesh.vertex_groups[b.name].index for b in [fore, hand] + list(hand.children_recursive) if b.name in mesh.vertex_groups}
        for v in me.vertices:
            w = sum(g.weight for g in v.groups if g.group in groups)
            if w <= 0.0: continue
            pos = to_arm @ v.co
            t = max(0.0, min(1.0, (pos - elbow).dot(axis) / length))
            t = t * t * (3 - 2 * t)                                # ease in and out along the forearm
            angle = math.radians(PRONATE * sign * t * min(1.0, w))
            if abs(angle) < 1e-5: continue
            on_axis = elbow + axis * (pos - elbow).dot(axis)
            v.co = to_mesh @ (on_axis + Quaternion(axis, angle) @ (pos - on_axis))
            moved += 1
    me.update()
    print("PRONATE forearms turned %.0f degrees at the wrist, %d vertices reshaped" % (PRONATE, moved))

if ARMS_IN:
    # the skeleton's own axes: Y is up, +X is its left, +Z is forward. Turning an upper arm about the
    # forward axis swings the hand towards (or away from) the body.
    from mathutils import Vector
    upper = [(b.name, -1.0 if "Left" in b.name else 1.0) for b in arm.data.bones
             if b.name.replace(":", "").replace("mixamorig", "") in ("LeftArm", "RightArm")]
    ad1 = arm.animation_data or arm.animation_data_create()
    for clip, act in clips:
        ad1.action = act
        try:
            if act.slots: ad1.action_slot = act.slots[0]
        except Exception:
            pass
        for f in range(int(act.frame_range[0]), int(act.frame_range[1]) + 1):
            scene.frame_set(f)
            for name, sign in upper:
                pb = arm.pose.bones[name]
                M = pb.matrix.to_3x3().to_quaternion()            # where the arm points now, in skeleton space
                Q = Quaternion(Vector((0, 0, 1)), math.radians(ARMS_IN * sign))
                pb.rotation_mode = "QUATERNION"
                pb.rotation_quaternion = pb.rotation_quaternion @ (M.conjugated() @ Q @ M)
                pb.keyframe_insert("rotation_quaternion", frame=f)
    ad1.action = None
    for pb in arm.pose.bones:
        pb.rotation_quaternion = (1, 0, 0, 0); pb.location = (0, 0, 0)
    print("ARMS IN upper arms brought %.0f degrees closer to the body in %d clips" % (ARMS_IN, len(clips)))

arm.name = NAME; arm.data.name = NAME + "_rig"
mesh.name = NAME + "_mesh"; mesh.data.name = NAME + "_mesh"
print("CHARACTER bones %d, verts %d, tris %d, height %.3f m" % (
    len(arm.data.bones), len(mesh.data.vertices), sum(len(p.vertices) - 2 for p in mesh.data.polygons),
    max((mesh.matrix_world @ v.co).z for v in mesh.data.vertices) - min((mesh.matrix_world @ v.co).z for v in mesh.data.vertices)))

# our own material (colour + normal + roughness) instead of Mixamo's reduced one
with bpy.data.libraries.load(os.path.abspath(MATSRC)) as (src, dst):
    dst.materials = list(src.materials)
mat = next(m for m in dst.materials if m)
old = list(mesh.data.materials)
mesh.data.materials.clear(); mesh.data.materials.append(mat)
for m in old:
    if m.users == 0: bpy.data.materials.remove(m)
for im in list(bpy.data.images):
    if im.users == 0: bpy.data.images.remove(im)
mat.name = NAME                                  # drop the ".001" Blender adds when names clash on import
for n in mat.node_tree.nodes:
    if n.type == "TEX_IMAGE" and n.image:
        colour = any(l.to_socket.name == "Base Color" for l in n.outputs[0].links)
        normal = any(l.to_node.type == "NORMAL_MAP" for l in n.outputs[0].links)
        n.image.name = NAME + ("_colour" if colour else "_normal" if normal else "_roughness")
print("MATERIAL", mat.name, [(n.image.name, list(n.image.size)) for n in mat.node_tree.nodes if n.type == "TEX_IMAGE" and n.image])

# one NLA track per clip: the exporter writes each track as its own named animation
ad = arm.animation_data or arm.animation_data_create()
ad.action = None
for clip, act in clips:
    track = ad.nla_tracks.new(); track.name = clip
    strip = track.strips.new(clip, int(act.frame_range[0]), act)
    track.mute = True
    print("CLIP %-8s frames %d (%.1f s)" % (clip, act.frame_range[1] - act.frame_range[0] + 1, (act.frame_range[1] - act.frame_range[0]) / 30))

os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
blend = os.path.splitext(os.path.abspath(OUT))[0] + ".blend"
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=blend)
bpy.ops.object.select_all(action="DESELECT")
arm.select_set(True); mesh.select_set(True)
bpy.ops.export_scene.gltf(filepath=os.path.abspath(OUT), export_format="GLB", use_selection=True,
                          export_image_format="WEBP", export_image_quality=88,
                          export_animations=True, export_animation_mode="NLA_TRACKS",
                          export_force_sampling=True, export_optimize_animation_size=True,
                          export_skins=True, export_def_bones=False, export_yup=True)
print("SAVED %s (%.1f MB) and %s (%.1f MB)" % (OUT, os.path.getsize(OUT) / 1e6, blend, os.path.getsize(blend) / 1e6))
