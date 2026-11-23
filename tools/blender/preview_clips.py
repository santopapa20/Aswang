# Renders every animation clip inside a GLB so the motion can be checked: numbered frames per clip
# in <out_dir>/<clip>/ (turn them into a video or a contact sheet with ffmpeg).
# usage: blender -b --factory-startup --python preview_clips.py -- <model.glb> <out_dir> [max_frames_per_clip=120]
import bpy, sys, os, math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT = argv[0], argv[1]
MAXF = int(argv[2]) if len(argv) > 2 else 120

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
scene = bpy.context.scene
arm = next(o for o in scene.objects if o.type == "ARMATURE")
mesh = next(o for o in scene.objects if o.type == "MESH")
ad = arm.animation_data or arm.animation_data_create()
for t in ad.nla_tracks: t.mute = True
actions = sorted(bpy.data.actions, key=lambda a: a.name)
print("GLB clips:", [(a.name, round(a.frame_range[1] - a.frame_range[0] + 1)) for a in actions],
      "| bones", len(arm.data.bones), "| tris", sum(len(p.vertices) - 2 for p in mesh.data.polygons))

scene.render.engine = "BLENDER_WORKBENCH"
sh = scene.display.shading
sh.light = "STUDIO"; sh.color_type = "TEXTURE"; sh.show_cavity = True; sh.cavity_type = "WORLD"
sh.show_shadows = True; sh.shadow_intensity = 0.35
scene.view_settings.view_transform = "Standard"
scene.render.resolution_x = 400; scene.render.resolution_y = 480
scene.world = bpy.data.worlds.new("w"); scene.world.color = (0.33, 0.34, 0.37)
arm.hide_render = True
# a floor so the feet and the shadow read
bpy.ops.mesh.primitive_plane_add(size=30)
floor = bpy.context.active_object
fm = bpy.data.materials.new("floor"); fm.diffuse_color = (0.42, 0.43, 0.46, 1); floor.data.materials.append(fm)
cd = bpy.data.cameras.new("cam"); cd.type = "ORTHO"
cam = bpy.data.objects.new("cam", cd); scene.collection.objects.link(cam); scene.camera = cam

def bounds(frames):
    lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
    for f in frames:
        scene.frame_set(f)
        dg = bpy.context.evaluated_depsgraph_get()
        ev = mesh.evaluated_get(dg)
        for c in ev.bound_box:
            w = ev.matrix_world @ Vector(c)
            lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    return lo, hi

for act in actions:
    ad.action = act
    try:
        if act.slots: ad.action_slot = act.slots[0]
    except Exception:
        pass
    f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
    n = f1 - f0 + 1
    step = max(1, math.ceil(n / MAXF))
    frames = list(range(f0, f1 + 1, step))
    lo, hi = bounds(frames[::max(1, len(frames) // 8)] + [frames[-1]])
    centre = (lo + hi) / 2; size = hi - lo
    cd.ortho_scale = max(size.z * 1.15, max(size.x, size.y) * 1.25, 2.0)
    a = math.radians(-35); e = math.radians(12)
    cam.location = centre + Vector((math.sin(a) * math.cos(e), -math.cos(a) * math.cos(e), math.sin(e))) * 12
    cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
    d = os.path.join(OUT, act.name); os.makedirs(d, exist_ok=True)
    hips = arm.pose.bones[0]
    travel = []
    for i, f in enumerate(frames):
        scene.frame_set(f)
        travel.append((arm.matrix_world @ hips.matrix).translation.copy())
        scene.render.filepath = os.path.join(d, "f_%04d.png" % i)
        bpy.ops.render.render(write_still=True)
    drift = max((p - travel[0]).length for p in travel)
    print("CLIP %-8s frames %d, rendered %d (every %d), hips move at most %.2f m from the start" % (act.name, n, len(frames), step, drift))
