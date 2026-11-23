# Paints an untextured character from four orthographic reference images (front, back, right, left).
#
# usage: blender -b --factory-startup --python project_texture.py -- <model.glb> <ref_dir> <out_dir>
#   ref_dir holds front.png, back.png, right.png, left.png: the figure on a plain grey background.
#   "right" shows the character's own right side (he faces the right edge of the picture).
#
# Steps: join the parts (remembering which part each vertex came from), unwrap one texture atlas,
# line each picture up with the model's outline from that side, work out for every vertex which
# cameras can actually see it, blend the pictures by that, and bake the result into the atlas.
import bpy, sys, os, math
import numpy as np
from mathutils import Vector, Matrix
from mathutils.bvhtree import BVHTree

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, REF, OUT = argv[0], argv[1], argv[2]
ATLAS = 2048
VIEWS = ["front", "back", "right", "left"]

bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=SRC)
scene = bpy.context.scene

# ── one object, transforms applied, part membership kept as vertex groups ──
parts = [o for o in scene.objects if o.type == "MESH"]
parts.sort(key=lambda o: o.name)
for i, o in enumerate(parts):
    mw = o.matrix_world.copy()
    o.parent = None
    o.data.transform(mw)
    o.matrix_world = Matrix.Identity(4)
    o.data.materials.clear()
    g = o.vertex_groups.new(name="part_%02d" % i)
    g.add(list(range(len(o.data.vertices))), 1.0, "REPLACE")
for o in scene.objects:
    o.select_set(o.type == "MESH")
bpy.context.view_layer.objects.active = parts[0]
if len(parts) > 1:
    bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active
obj.name = "Player"
me = obj.data
for o in [o for o in scene.objects if o.type != "MESH"]:
    bpy.data.objects.remove(o)
for p in me.polygons:
    p.use_smooth = True

# ── texture atlas ──
bpy.ops.object.mode_set(mode="EDIT")
bpy.ops.mesh.select_all(action="SELECT")
# A wide angle limit keeps the pieces few and large. Many tiny pieces bleed into their neighbours
# in the texture, which showed up as pale patches on the skin.
bpy.ops.uv.smart_project(angle_limit=math.radians(89), island_margin=0.012)
bpy.ops.object.mode_set(mode="OBJECT")
me.uv_layers[0].name = "atlas"

nv = len(me.vertices)
co = np.empty(nv * 3, dtype=np.float32); me.vertices.foreach_get("co", co); co = co.reshape(nv, 3)
no = np.empty(nv * 3, dtype=np.float32); me.vertices.foreach_get("normal", no); no = no.reshape(nv, 3)
lo, hi = co.min(axis=0), co.max(axis=0)
print("MODEL bbox", lo.round(3), hi.round(3), "verts", nv)

# Each camera: the direction from the model toward the camera, and which model axis runs to the
# right of the picture (and its sign). The character faces -Y; his right side is -X.
CAM = {
    "front": {"to_cam": (0, -1, 0), "axis": 0, "sign": 1},
    "back": {"to_cam": (0, 1, 0), "axis": 0, "sign": -1},
    "right": {"to_cam": (-1, 0, 0), "axis": 1, "sign": -1},
    "left": {"to_cam": (1, 0, 0), "axis": 1, "sign": 1},
}


def load(name):
    img = bpy.data.images.load(os.path.join(REF, name + ".png"))
    w, h = img.size
    px = np.empty(w * h * 4, dtype=np.float32)
    img.pixels.foreach_get(px)
    return img, px.reshape(h, w, 4), w, h  # row 0 is the bottom of the picture


def figure_mask(px):
    """True where the picture shows the figure, not the grey backdrop."""
    h, w, _ = px.shape
    corners = np.concatenate([px[:20, :20, :3].reshape(-1, 3), px[:20, -20:, :3].reshape(-1, 3), px[-20:, :20, :3].reshape(-1, 3), px[-20:, -20:, :3].reshape(-1, 3)])
    bg = np.median(corners, axis=0)
    return np.abs(px[:, :, :3] - bg).max(axis=2) > 0.085


def bleed(px, mask, rounds=140):
    """Spread the figure's edge colours outward over the backdrop, so a sample that lands just
    outside the outline picks up cloth or skin instead of grey."""
    rgb = px[:, :, :3].copy()
    filled = mask.copy()
    for _ in range(rounds):
        if filled.all():
            break
        acc = np.zeros_like(rgb); cnt = np.zeros(filled.shape, dtype=np.float32)
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            f = np.roll(filled, (dy, dx), axis=(0, 1)); c = np.roll(rgb, (dy, dx), axis=(0, 1))
            if dy == 1: f[0, :] = False
            if dy == -1: f[-1, :] = False
            if dx == 1: f[:, 0] = False
            if dx == -1: f[:, -1] = False
            acc += c * f[:, :, None]; cnt += f
        new = (~filled) & (cnt > 0)
        rgb[new] = acc[new] / cnt[new][:, None]
        filled |= new
    out = px.copy(); out[:, :, :3] = rgb; out[:, :, 3] = 1.0
    return out


def shrink(mask, px=5):
    """Pull the outline in by a few pixels. The outermost ring of the figure is a soft mix of the
    figure and the grey backdrop; if the colours are spread outward from that ring, everything near
    the outline turns pale."""
    m = mask.copy()
    for _ in range(px):
        n = m.copy()
        n[1:, :] &= m[:-1, :]; n[:-1, :] &= m[1:, :]; n[:, 1:] &= m[:, :-1]; n[:, :-1] &= m[:, 1:]
        m = n
    return m


def bbox(mask):
    rows = np.where(mask.sum(axis=1) > 4)[0]
    cols = np.where(mask.sum(axis=0) > 4)[0]
    return cols[0], cols[-1] + 1, rows[0], rows[-1] + 1  # x0, x1, y0 (bottom), y1 (top)


images = {}
uv_of = {}
pix_of = {}
for name in VIEWS:
    img, px, w, h = load(name)
    mask = figure_mask(px)
    x0, x1, y0, y1 = bbox(mask)
    print("REF", name, "figure box px", x0, x1, y0, y1, "of", w, h)
    filled = bleed(px, shrink(mask))
    img.pixels.foreach_set(filled.reshape(-1))
    img.pack()
    images[name] = img
    pix_of[name] = filled[:, :, :3]
    cam = CAM[name]
    a = cam["axis"]
    side = co[:, a] * cam["sign"]
    s_lo, s_hi = (lo[a], hi[a]) if cam["sign"] > 0 else (-hi[a], -lo[a])
    u = (x0 + (side - s_lo) / (s_hi - s_lo) * (x1 - x0)) / w
    v = (y0 + (co[:, 2] - lo[2]) / (hi[2] - lo[2]) * (y1 - y0)) / h
    uv_of[name] = np.stack([u, v], axis=1)

# ── which cameras see each vertex ──
depsgraph = bpy.context.evaluated_depsgraph_get()
tree = BVHTree.FromObject(obj, depsgraph)
facing = np.zeros((nv, 4), dtype=np.float32)
seen = np.zeros((nv, 4), dtype=np.float32)
for k, name in enumerate(VIEWS):
    d = Vector(CAM[name]["to_cam"])
    facing[:, k] = np.clip(no @ np.array(d, dtype=np.float32), 0, 1)
    for i in range(nv):
        if facing[i, k] <= 0.02:
            continue
        origin = Vector(co[i]) + Vector(no[i]) * 0.0015 + d * 0.0015
        hit = tree.ray_cast(origin, d)
        seen[i, k] = 0.0 if hit[0] is not None else 1.0

# The side pictures show the arms hanging straight down, the model holds them out, so trust the
# side views a little less than the front and back.
trust = np.array([1.0, 1.0, 0.7, 0.7], dtype=np.float32)
wts = (facing ** 3) * seen * trust
# Only trust a picture where the surface faces its camera fairly squarely. At a glancing angle the
# sample slides off the outline (the model's arms are not at exactly the pictured angle) and picks
# up whatever is next to it, so those areas borrow colour from their neighbours instead.
confidence = (facing * seen * trust).max(axis=1)
blind = confidence < 0.5
wts[blind] = 0.0
print("VERTS hidden from all cameras:", int(blind.sum()), "of", nv)


def sample(pix, uv):
    """Colour of a picture at each uv (bilinear)."""
    h, w, _ = pix.shape
    x = np.clip(uv[:, 0] * w - 0.5, 0, w - 1.001); y = np.clip(uv[:, 1] * h - 0.5, 0, h - 1.001)
    x0 = np.floor(x).astype(np.int32); y0 = np.floor(y).astype(np.int32)
    fx = (x - x0)[:, None]; fy = (y - y0)[:, None]
    return (pix[y0, x0] * (1 - fx) + pix[y0, x0 + 1] * fx) * (1 - fy) + (pix[y0 + 1, x0] * (1 - fx) + pix[y0 + 1, x0 + 1] * fx) * fy


# A vertex no camera can see (inner arms, between the fingers, inside folds) must not be coloured
# by looking straight through the body. It takes its colour from the visible surface next to it
# on the same part instead: the colour spreads along the mesh, and parts are not connected.
vcol = np.zeros((nv, 3), dtype=np.float32)
norm = np.maximum(wts.sum(axis=1, keepdims=True), 1e-6)
for k, name in enumerate(VIEWS):
    vcol += sample(pix_of[name], uv_of[name]) * (wts[:, k:k + 1] / norm)
edges = np.empty(len(me.edges) * 2, dtype=np.int32); me.edges.foreach_get("vertices", edges); edges = edges.reshape(-1, 2)
known = ~blind
for _ in range(400):
    if known.all():
        break
    acc = np.zeros((nv, 3), dtype=np.float32); cnt = np.zeros(nv, dtype=np.float32)
    for p, q in ((0, 1), (1, 0)):
        src = known[edges[:, q]]
        np.add.at(acc, edges[src, p], vcol[edges[src, q]]); np.add.at(cnt, edges[src, p], 1)
    new = (~known) & (cnt > 0)
    vcol[new] = acc[new] / cnt[new][:, None]
    known |= new
if not known.all():
    from mathutils.kdtree import KDTree
    ids = np.where(known)[0]
    kd = KDTree(len(ids))
    for j, i in enumerate(ids):
        kd.insert(Vector(co[i]), j)
    kd.balance()
    for i in np.where(~known)[0]:
        vcol[i] = vcol[ids[kd.find(Vector(co[i]))[1]]]
    print("VERTS coloured from the nearest visible point:", int((~known).sum()))

# five blend weights per vertex: the four pictures, plus the borrowed colour for hidden areas
w5 = np.zeros((nv, 5), dtype=np.float32)
w5[:, :4] = wts
w5[blind, 4] = 1.0
w5 /= w5.sum(axis=1, keepdims=True)
# smooth the blend across the surface so the joins between pictures are soft
for _ in range(6):
    acc = w5.copy(); cnt = np.ones(nv, dtype=np.float32)
    np.add.at(acc, edges[:, 0], w5[edges[:, 1]]); np.add.at(acc, edges[:, 1], w5[edges[:, 0]])
    np.add.at(cnt, edges[:, 0], 1); np.add.at(cnt, edges[:, 1], 1)
    w5 = acc / cnt[:, None]
w5 /= w5.sum(axis=1, keepdims=True)

# The smoothing above must not hand a hidden vertex a share of a picture: its own position in that
# picture is exactly the part that cannot be trusted.
w5[blind, :4] = 0.0
w5[blind, 4] = 1.0

attr = me.color_attributes.new(name="proj_w", type="FLOAT_COLOR", domain="POINT")
attr.data.foreach_set("color", np.ascontiguousarray(w5[:, :4]).reshape(-1))
fill_w = me.attributes.new(name="proj_fill", type="FLOAT", domain="POINT")
fill_w.data.foreach_set("value", np.ascontiguousarray(w5[:, 4]))
# the pictures are stored sRGB-encoded; a colour attribute is read as linear light
lin = np.where(vcol <= 0.04045, vcol / 12.92, ((vcol + 0.055) / 1.055) ** 2.4).astype(np.float32)
fill_c = me.color_attributes.new(name="fill_col", type="FLOAT_COLOR", domain="POINT")
fill_c.data.foreach_set("color", np.concatenate([lin, np.ones((nv, 1), dtype=np.float32)], axis=1).reshape(-1))

loops = np.empty(len(me.loops), dtype=np.int32); me.loops.foreach_get("vertex_index", loops)
for name in VIEWS:
    layer = me.uv_layers.new(name="uv_" + name, do_init=False)
    layer.data.foreach_set("uv", uv_of[name][loops].reshape(-1))
me.uv_layers.active = me.uv_layers["atlas"]
me.uv_layers["atlas"].active_render = True

# ── material that blends the four pictures, then bake it into the atlas ──
mat = bpy.data.materials.new("projection")
mat.use_nodes = True
nt = mat.node_tree
nt.nodes.clear()
N = nt.nodes.new
attr_node = N("ShaderNodeAttribute"); attr_node.attribute_type = "GEOMETRY"; attr_node.attribute_name = "proj_w"
sep = N("ShaderNodeSeparateColor")
nt.links.new(attr_node.outputs["Color"], sep.inputs[0])
weight_out = [sep.outputs[0], sep.outputs[1], sep.outputs[2], attr_node.outputs["Alpha"]]
total = None
for k, name in enumerate(VIEWS):
    uvn = N("ShaderNodeUVMap"); uvn.uv_map = "uv_" + name
    tex = N("ShaderNodeTexImage"); tex.image = images[name]; tex.extension = "EXTEND"
    nt.links.new(uvn.outputs["UV"], tex.inputs["Vector"])
    sc = N("ShaderNodeVectorMath"); sc.operation = "SCALE"
    nt.links.new(tex.outputs["Color"], sc.inputs[0])
    nt.links.new(weight_out[k], sc.inputs["Scale"])
    if total is None:
        total = sc.outputs["Vector"]
    else:
        add = N("ShaderNodeVectorMath"); add.operation = "ADD"
        nt.links.new(total, add.inputs[0]); nt.links.new(sc.outputs["Vector"], add.inputs[1])
        total = add.outputs["Vector"]
fw = N("ShaderNodeAttribute"); fw.attribute_type = "GEOMETRY"; fw.attribute_name = "proj_fill"
fc = N("ShaderNodeAttribute"); fc.attribute_type = "GEOMETRY"; fc.attribute_name = "fill_col"
sc = N("ShaderNodeVectorMath"); sc.operation = "SCALE"
nt.links.new(fc.outputs["Color"], sc.inputs[0]); nt.links.new(fw.outputs["Fac"], sc.inputs["Scale"])
add = N("ShaderNodeVectorMath"); add.operation = "ADD"
nt.links.new(total, add.inputs[0]); nt.links.new(sc.outputs["Vector"], add.inputs[1])
total = add.outputs["Vector"]
emit = N("ShaderNodeEmission")
nt.links.new(total, emit.inputs["Color"])
out = N("ShaderNodeOutputMaterial")
nt.links.new(emit.outputs["Emission"], out.inputs["Surface"])
atlas_img = bpy.data.images.new("player_basecolor", ATLAS, ATLAS, alpha=False)
target = N("ShaderNodeTexImage"); target.image = atlas_img
nt.nodes.active = target
me.materials.append(mat)

scene.render.engine = "CYCLES"
scene.cycles.device = "CPU"
scene.cycles.samples = 1
scene.render.bake.margin = 10
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
bpy.ops.object.bake(type="EMIT", use_clear=True)
os.makedirs(OUT, exist_ok=True)
atlas_img.filepath_raw = os.path.join(OUT, "player_basecolor.png")
atlas_img.file_format = "PNG"
atlas_img.save()
print("BAKED", atlas_img.filepath_raw)

# ── final material, clean-up and export ──
final = bpy.data.materials.new("player")
final.use_nodes = True
bsdf = final.node_tree.nodes["Principled BSDF"]
tex = final.node_tree.nodes.new("ShaderNodeTexImage"); tex.image = atlas_img
final.node_tree.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
bsdf.inputs["Roughness"].default_value = 0.85
bsdf.inputs["Metallic"].default_value = 0.0
final.node_tree.nodes.active = tex
me.materials.clear(); me.materials.append(final)
for name in VIEWS:
    me.uv_layers.remove(me.uv_layers["uv_" + name])
me.color_attributes.remove(me.color_attributes["proj_w"])
me.color_attributes.remove(me.color_attributes["fill_col"])
me.attributes.remove(me.attributes["proj_fill"])
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT, "player_textured.blend"))
bpy.ops.export_scene.gltf(filepath=os.path.join(OUT, "player_textured.glb"), export_format="GLB", use_selection=True)
print("EXPORTED")

# ── check renders ──
scene.render.engine = "BLENDER_WORKBENCH"
sh = scene.display.shading
sh.light = "FLAT"; sh.color_type = "TEXTURE"
scene.render.resolution_x = 700; scene.render.resolution_y = 1000
scene.world = bpy.data.worlds.new("w"); scene.world.color = (0.4, 0.4, 0.42)
cam_data = bpy.data.cameras.new("cam"); cam_data.type = "ORTHO"; cam_data.ortho_scale = float(hi[2] - lo[2]) * 1.1
cam = bpy.data.objects.new("cam", cam_data); scene.collection.objects.link(cam); scene.camera = cam
centre = Vector(((lo[0] + hi[0]) / 2, (lo[1] + hi[1]) / 2, (lo[2] + hi[2]) / 2))
for name, ang in (("front", 0), ("quarter", 40), ("side", 90), ("back", 180), ("side2", 270), ("quarter2", 220)):
    a = math.radians(ang)
    cam.location = centre + Vector((-math.sin(a) * 5, -math.cos(a) * 5, 0))
    cam.rotation_euler = (centre - cam.location).to_track_quat("-Z", "Y").to_euler()
    scene.render.filepath = os.path.join(OUT, "check-" + name + ".png")
    bpy.ops.render.render(write_still=True)
print("DONE")
