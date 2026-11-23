# Reports what is inside a GLB (objects, triangles, textures, skeleton, animations, open edges) and
# renders it with its own texture from five angles, flat-lit so the colours can be judged.
# usage: blender -b --factory-startup --python render_textured.py -- <model.glb> <out_prefix>
import bpy, bmesh, sys, math
from mathutils import Vector

src, out = sys.argv[sys.argv.index("--") + 1:][:2]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
scene = bpy.context.scene
meshes = [o for o in scene.objects if o.type == "MESH"]

lo = Vector((1e9,) * 3); hi = Vector((-1e9,) * 3)
total = 0
for o in scene.objects:
    if o.type != "MESH":
        print("OBJECT", o.name, o.type, "bones", len(o.data.bones) if o.type == "ARMATURE" else "")
        continue
    me = o.data
    tris = sum(len(p.vertices) - 2 for p in me.polygons); total += tris
    quads = sum(1 for p in me.polygons if len(p.vertices) == 4)
    bm = bmesh.new(); bm.from_mesh(me)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-6)
    open_edges = sum(1 for e in bm.edges if len(e.link_faces) == 1)
    seen = set(); pieces = 0
    for v in bm.verts:
        if v.index in seen: continue
        pieces += 1; stack = [v]
        while stack:
            x = stack.pop()
            if x.index in seen: continue
            seen.add(x.index); stack.extend(e.other_vert(x) for e in x.link_edges)
    bm.free()
    for c in o.bound_box:
        w = o.matrix_world @ Vector(c)
        lo = Vector(map(min, lo, w)); hi = Vector(map(max, hi, w))
    print("MESH", o.name, "verts", len(me.vertices), "tris", tris, "quads", quads, "uv", [u.name for u in me.uv_layers],
          "open_edges", open_edges, "pieces", pieces, "vertex_groups", len(o.vertex_groups),
          "parent", o.parent.name if o.parent else None, "scale", [round(s, 3) for s in o.scale])
    for m in me.materials:
        if not m: continue
        for n in m.node_tree.nodes:
            if n.type == "TEX_IMAGE" and n.image:
                used = [l.to_socket.name for l in n.outputs[0].links]
                print("  TEXTURE", m.name, n.image.name, list(n.image.size), "->", used)
        b = next((n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED"), None)
        if b: print("  MATERIAL", m.name, "metallic", round(b.inputs["Metallic"].default_value, 2), "roughness", round(b.inputs["Roughness"].default_value, 2))
print("TOTAL tris", total, "objects", len(meshes), "bbox", [round(v, 3) for v in lo], [round(v, 3) for v in hi], "size", [round(v, 3) for v in hi - lo])
print("ANIMATIONS", [(a.name, [round(f) for f in a.frame_range]) for a in bpy.data.actions])

centre = (lo + hi) / 2; size = hi - lo
scene.render.engine = "BLENDER_WORKBENCH"
sh = scene.display.shading
sh.light = "FLAT"; sh.color_type = "TEXTURE"; sh.show_backface_culling = False
scene.view_settings.view_transform = "Standard"
scene.render.resolution_x = 640; scene.render.resolution_y = 960
scene.world = bpy.data.worlds.new("w"); scene.world.color = (0.35, 0.35, 0.37)
for o in scene.objects:
    if o.type == "ARMATURE": o.hide_render = True
cd = bpy.data.cameras.new("cam"); cd.type = "ORTHO"; cd.ortho_scale = max(size.z, size.x * 1.5, size.y * 1.5) * 1.1
cam = bpy.data.objects.new("cam", cd); scene.collection.objects.link(cam); scene.camera = cam
def shoot(name, angle, studio=False):
    sh.light = "STUDIO" if studio else "FLAT"
    a = math.radians(angle)
    cam.location = centre + Vector((math.sin(a) * 6, -math.cos(a) * 6, 0))
    cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = out + "-" + name + ".png"
    bpy.ops.render.render(write_still=True)
for name, ang in (("1front", 0), ("2quarter", 40), ("3right", -90), ("4back", 180), ("5left", 90)):
    shoot(name, ang)
shoot("6shape", 40, studio=True)
# close-up of the head, to judge the face
centre = Vector((centre.x, centre.y, hi.z - size.z * 0.09)); cd.ortho_scale = size.z * 0.3
scene.render.resolution_y = 640
shoot("7face", 20)
