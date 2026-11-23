# Renders front and three-quarter views of a GLB with Blender's workbench engine.
# usage: blender -b --factory-startup --python render_views.py -- <model.glb> <out_prefix> <single|random>
import bpy, sys, math
from mathutils import Vector

argv = sys.argv[sys.argv.index("--") + 1:]
src, out, colour = argv[0], argv[1], argv[2]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
meshes = [o for o in bpy.context.scene.objects if o.type == "MESH"]

lo = Vector((1e9, 1e9, 1e9)); hi = Vector((-1e9, -1e9, -1e9))
for o in meshes:
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
centre = (lo + hi) / 2
size = hi - lo
print("BBOX", [round(v, 3) for v in lo], [round(v, 3) for v in hi], "objects", len(meshes))

scene = bpy.context.scene
scene.render.engine = "BLENDER_WORKBENCH"
sh = scene.display.shading
sh.light = "STUDIO"
sh.color_type = "RANDOM" if colour == "random" else "SINGLE"
sh.single_color = (0.78, 0.76, 0.72)
sh.show_cavity = True
sh.cavity_type = "BOTH"
sh.show_shadows = False
scene.render.resolution_x = 700
scene.render.resolution_y = 1000
scene.render.film_transparent = False
scene.world = bpy.data.worlds.new("w")
scene.world.color = (0.16, 0.16, 0.18)

cam_data = bpy.data.cameras.new("cam")
cam_data.type = "ORTHO"
cam_data.ortho_scale = max(size.z, size.x) * 1.12
cam = bpy.data.objects.new("cam", cam_data)
scene.collection.objects.link(cam)
scene.camera = cam

def shoot(name, angle_deg):
    a = math.radians(angle_deg)
    d = 5.0
    cam.location = centre + Vector((math.sin(a) * d, -math.cos(a) * d, 0.0))
    direction = centre - cam.location
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = out + "-" + name + ".png"
    bpy.ops.render.render(write_still=True)

shoot("front", 0)
shoot("quarter", 40)
shoot("side", 90)
shoot("back", 180)
