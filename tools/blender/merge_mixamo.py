# Merges Mixamo downloads into one game-ready GLB: the skinned character from the clip that was
# downloaded "With Skin", plus every other .fbx in the folder as a named animation clip (the clip
# name is the file name). The character's material is replaced by the full one from our own .blend
# (Mixamo drops the roughness map), and textures are written as WebP.
#
# usage: blender -b --factory-startup --python merge_mixamo.py -- <downloads_dir> <material_source.blend> <out.glb>
import bpy, sys, os, glob

argv = sys.argv[sys.argv.index("--") + 1:]
DIR, MATSRC, OUT = argv[0], argv[1], argv[2]
NAME = os.path.splitext(os.path.basename(OUT))[0]

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = 30

def import_fbx(path):
    before_obj = set(bpy.data.objects); before_act = set(bpy.data.actions)
    bpy.ops.import_scene.fbx(filepath=path, automatic_bone_orientation=False)
    return [o for o in bpy.data.objects if o not in before_obj], [a for a in bpy.data.actions if a not in before_act]

files = sorted(glob.glob(os.path.join(DIR, "*.fbx")))
arm = mesh = None
clips = []
pending = []
for f in files:
    clip = os.path.splitext(os.path.basename(f))[0]
    objs, acts = import_fbx(f)
    has_mesh = any(o.type == "MESH" for o in objs)
    if has_mesh and arm is None:
        arm = next(o for o in objs if o.type == "ARMATURE")
        mesh = next(o for o in objs if o.type == "MESH")
    else:
        for o in objs:
            data = o.data
            bpy.data.objects.remove(o)
            if data and data.users == 0:
                (bpy.data.armatures if isinstance(data, bpy.types.Armature) else bpy.data.meshes).remove(data)
    if len(acts) != 1:
        print("WARNING", clip, "has", len(acts), "actions")
    acts[0].name = clip
    acts[0].use_fake_user = True
    clips.append((clip, acts[0]))
if arm is None:
    print("ERROR no clip in", DIR, "contains the skinned character (download one With Skin)"); sys.exit(1)

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
