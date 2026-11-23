# Gives a plain tree model a proper bark texture, painted by rule and baked into its existing
# texture layout: vertical bark streaks and furrows, darker creases where branches and roots meet,
# moss on the upward-facing parts, a damp dark base, and a matching bumpy normal map.
# The model's own (pale) texture is kept underneath as soft variation.
#
# usage: blender -b --factory-startup --python enrich_bark.py -- <model.blend> <out_dir> <name> [colour_px=2048] [normal_px=1024]
import bpy, sys, os

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, OUT, NAME = argv[0], argv[1], argv[2]
PX = int(argv[3]) if len(argv) > 3 else 2048
NPX = int(argv[4]) if len(argv) > 4 else 1024

bpy.ops.wm.open_mainfile(filepath=SRC)
scene = bpy.context.scene
ob = next(o for o in scene.objects if o.type == "MESH")
mat = ob.data.materials[0]
nt = mat.node_tree
N, L = nt.nodes, nt.links
bsdf = next(n for n in N if n.type == "BSDF_PRINCIPLED")
height = max(v.co.z for v in ob.data.vertices) - min(v.co.z for v in ob.data.vertices)

def linked_image(socket_name):
    s = bsdf.inputs[socket_name]
    node = s.links[0].from_node if s.links else None
    while node and node.type != "TEX_IMAGE":
        nxt = next((i.links[0].from_node for i in node.inputs if i.links), None)
        node = nxt
    return node
old_colour = linked_image("Base Color")
old_normal = linked_image("Normal")
normal_map = bsdf.inputs["Normal"].links[0].from_node if bsdf.inputs["Normal"].links else None

def node(kind, **props):
    n = N.new(kind)
    for k, v in props.items(): setattr(n, k, v)
    return n
def ramp(stops):
    r = node("ShaderNodeValToRGB")
    el = r.color_ramp.elements
    el[0].position, el[0].color = stops[0][0], (*stops[0][1], 1)
    el[1].position, el[1].color = stops[-1][0], (*stops[-1][1], 1)
    for pos, col in stops[1:-1]:
        e = el.new(pos); e.color = (*col, 1)
    return r
def mix(mode, fac, a, b):
    m = node("ShaderNodeMix", data_type="RGBA", blend_type=mode)
    for sock, val in ((m.inputs[0], fac), (m.inputs[6], a), (m.inputs[7], b)):
        if hasattr(val, "links"): L.new(val, sock)
        else: sock.default_value = val if isinstance(val, float) else (*val, 1)
    return m.outputs[2]

coords = node("ShaderNodeTexCoord")
obj = coords.outputs["Object"]

# bark fibres: fine noise stretched along the trunk
m1 = node("ShaderNodeMapping"); m1.inputs["Scale"].default_value = (42 / height, 42 / height, 7 / height)
L.new(obj, m1.inputs["Vector"])
fibres = node("ShaderNodeTexNoise"); fibres.inputs["Scale"].default_value = 1.0; fibres.inputs["Detail"].default_value = 9; fibres.inputs["Roughness"].default_value = 0.62
L.new(m1.outputs["Vector"], fibres.inputs["Vector"])
bark = ramp([(0.28, (0.035, 0.024, 0.016)), (0.5, (0.17, 0.125, 0.085)), (0.72, (0.36, 0.31, 0.25))])
L.new(fibres.outputs["Fac"], bark.inputs["Fac"])

# deep furrows: broad ridged noise, also stretched upward
m2 = node("ShaderNodeMapping"); m2.inputs["Scale"].default_value = (16 / height, 16 / height, 2.2 / height)
L.new(obj, m2.inputs["Vector"])
furrow = node("ShaderNodeTexVoronoi", feature="DISTANCE_TO_EDGE"); furrow.inputs["Scale"].default_value = 1.0
L.new(m2.outputs["Vector"], furrow.inputs["Vector"])
furrow_ramp = ramp([(0.0, (0.0, 0.0, 0.0)), (0.09, (1, 1, 1))])
L.new(furrow.outputs["Distance"], furrow_ramp.inputs["Fac"])
col = mix("MULTIPLY", 0.85, bark.outputs["Color"], furrow_ramp.outputs["Color"])

# large patches of colour so no two branches look the same
m3 = node("ShaderNodeMapping"); m3.inputs["Scale"].default_value = (3.2 / height,) * 3
L.new(obj, m3.inputs["Vector"])
patches = node("ShaderNodeTexNoise"); patches.inputs["Scale"].default_value = 1.0; patches.inputs["Detail"].default_value = 3
L.new(m3.outputs["Vector"], patches.inputs["Vector"])
patch_ramp = ramp([(0.35, (0.62, 0.55, 0.5)), (0.65, (1.15, 1.08, 0.98))])
L.new(patches.outputs["Fac"], patch_ramp.inputs["Fac"])
col = mix("MULTIPLY", 1.0, col, patch_ramp.outputs["Color"])

# keep a little of the model's own texture as variation
if old_colour:
    col = mix("OVERLAY", 0.35, col, old_colour.outputs["Color"])

# creases: darker where surfaces crowd together
ao = node("ShaderNodeAmbientOcclusion", samples=12); ao.inputs["Distance"].default_value = height * 0.035
ao_ramp = ramp([(0.3, (0.12, 0.1, 0.09)), (0.85, (1, 1, 1))])
L.new(ao.outputs["AO"], ao_ramp.inputs["Fac"])
col = mix("MULTIPLY", 1.0, col, ao_ramp.outputs["Color"])

# moss: on parts that face the sky, broken up by noise
geo = node("ShaderNodeNewGeometry")
sep = node("ShaderNodeSeparateXYZ"); L.new(geo.outputs["Normal"], sep.inputs["Vector"])
up = node("ShaderNodeMapRange"); up.inputs["From Min"].default_value = 0.25; up.inputs["From Max"].default_value = 0.85
L.new(sep.outputs["Z"], up.inputs["Value"])
m4 = node("ShaderNodeMapping"); m4.inputs["Scale"].default_value = (11 / height,) * 3
L.new(obj, m4.inputs["Vector"])
moss_noise = node("ShaderNodeTexNoise"); moss_noise.inputs["Scale"].default_value = 1.0; moss_noise.inputs["Detail"].default_value = 6
L.new(m4.outputs["Vector"], moss_noise.inputs["Vector"])
moss_break = ramp([(0.42, (0, 0, 0)), (0.62, (1, 1, 1))])
L.new(moss_noise.outputs["Fac"], moss_break.inputs["Fac"])
moss_mask = node("ShaderNodeMath", operation="MULTIPLY")
L.new(up.outputs["Result"], moss_mask.inputs[0]); L.new(moss_break.outputs["Color"], moss_mask.inputs[1])
moss_col = ramp([(0.3, (0.035, 0.07, 0.02)), (0.75, (0.16, 0.24, 0.07))])
L.new(fibres.outputs["Fac"], moss_col.inputs["Fac"])
col = mix("MIX", moss_mask.outputs["Value"], col, moss_col.outputs["Color"])

# damp, dark base where the roots meet the ground
posz = node("ShaderNodeSeparateXYZ"); L.new(obj, posz.inputs["Vector"])
base = node("ShaderNodeMapRange"); base.inputs["From Min"].default_value = 0.0; base.inputs["From Max"].default_value = height * 0.16
base.inputs["To Min"].default_value = 0.45; base.inputs["To Max"].default_value = 1.0
L.new(posz.outputs["Z"], base.inputs["Value"])
damp = node("ShaderNodeMixRGB", blend_type="MULTIPLY"); damp.inputs["Fac"].default_value = 1.0
L.new(col, damp.inputs["Color1"]); L.new(base.outputs["Result"], damp.inputs["Color2"])
col = damp.outputs["Color"]

# ---- bake the colour
scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 16
emit = node("ShaderNodeEmission"); L.new(col, emit.inputs["Color"])
out = next(n for n in N if n.type == "OUTPUT_MATERIAL")
L.new(emit.outputs["Emission"], out.inputs["Surface"])
img_c = bpy.data.images.new(NAME + "_colour", PX, PX, alpha=False)
tex_c = node("ShaderNodeTexImage", image=img_c)
N.active = tex_c
bpy.ops.object.select_all(action="DESELECT"); ob.select_set(True); bpy.context.view_layer.objects.active = ob
scene.render.bake.margin = 8
bpy.ops.object.bake(type="EMIT")
print("BAKED colour", PX)

# ---- bake a bumpier normal map: the old one plus bark relief
L.new(bsdf.outputs["BSDF"], out.inputs["Surface"])
relief = node("ShaderNodeMath", operation="ADD")
L.new(fibres.outputs["Fac"], relief.inputs[0]); L.new(furrow_ramp.outputs["Color"], relief.inputs[1])
bump = node("ShaderNodeBump"); bump.inputs["Strength"].default_value = 0.55; bump.inputs["Distance"].default_value = height * 0.006
L.new(relief.outputs["Value"], bump.inputs["Height"])
if normal_map: L.new(normal_map.outputs["Normal"], bump.inputs["Normal"])
L.new(bump.outputs["Normal"], bsdf.inputs["Normal"])
img_n = bpy.data.images.new(NAME + "_normal", NPX, NPX, alpha=False)
img_n.colorspace_settings.name = "Non-Color"
tex_n = node("ShaderNodeTexImage", image=img_n)
N.active = tex_n
scene.cycles.samples = 4
bpy.ops.object.bake(type="NORMAL")
print("BAKED normal", NPX)

# ---- rebuild a plain game material from the two baked maps
for n in list(N):
    if n not in (bsdf, out, tex_c, tex_n): N.remove(n)
nm = node("ShaderNodeNormalMap"); nm.inputs["Strength"].default_value = 1.2
L.new(tex_c.outputs["Color"], bsdf.inputs["Base Color"])
L.new(tex_n.outputs["Color"], nm.inputs["Color"]); L.new(nm.outputs["Normal"], bsdf.inputs["Normal"])
bsdf.inputs["Roughness"].default_value = 0.92
bsdf.inputs["Metallic"].default_value = 0.0
N.active = tex_c
for im in list(bpy.data.images):
    if im.users == 0: bpy.data.images.remove(im)
img_c.pack(); img_n.pack()
mat.name = NAME

os.makedirs(OUT, exist_ok=True)
blend = os.path.abspath(os.path.join(OUT, NAME + ".blend"))
bpy.ops.wm.save_as_mainfile(filepath=blend)
glb = os.path.abspath(os.path.join(OUT, NAME + ".glb"))
bpy.ops.export_scene.gltf(filepath=glb, export_format="GLB", use_selection=True,
                          export_image_format="WEBP", export_image_quality=88, export_animations=False)
print("SAVED %s (%.1f MB) and %s (%.1f MB)" % (blend, os.path.getsize(blend) / 1e6, glb, os.path.getsize(glb) / 1e6))
