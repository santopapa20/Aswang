# Builds a Mixamo-style skeleton for a humanoid that Mixamo's own auto-rigger refuses (the tikbalang:
# horse head, hooves). The joints come from positions measured on the model (rig_landmarks.json), the
# bones get Mixamo's names, and the skin follows them with Blender's automatic weights. The result is
# used by merge_mixamo.py --character, which plays ordinary Mixamo motions on it.
#
# No finger bones: each hand moves as one piece.
#
# usage: blender -b --factory-startup --python rig_humanoid.py -- <model_rigready.blend> <rig_landmarks.json> <out.blend> [--height M]
#   --height  scale the model so it stands this tall in metres (landmarks are scaled with it)
import bpy, sys, json, os
from mathutils import Vector, Matrix

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, LMK, OUT = argv[0], argv[1], argv[2]
HEIGHT = float(argv[argv.index("--height") + 1]) if "--height" in argv else None
L = json.load(open(LMK))

bpy.ops.wm.open_mainfile(filepath=SRC)
scene = bpy.context.scene
ob = next(o for o in scene.objects if o.type == "MESH")
for o in list(scene.objects):
    if o is not ob: bpy.data.objects.remove(o)
me = ob.data
me.transform(ob.matrix_world); ob.matrix_world = Matrix.Identity(4)
if me.validate(verbose=False): print("MESH had invalid geometry (repaired)")
zs = [v.co.z for v in me.vertices]
s = HEIGHT / (max(zs) - min(zs)) if HEIGHT else 1.0
me.transform(Matrix.Translation((0, 0, -min(zs) * s)) @ Matrix.Scale(s, 4))
me.update()
for g in list(ob.vertex_groups): ob.vertex_groups.remove(g)
for m in list(ob.modifiers): ob.modifiers.remove(m)
print("MESH verts %d tris %d, scaled x%.3f to %.3f m" % (len(me.vertices), sum(len(p.vertices) - 2 for p in me.polygons), s, (max(zs) - min(zs)) * s))

def J(key, side=1):
    """A joint. Landmarks are given for the left side and mirrored, unless the right side is listed on its own
    under "right" (for a character standing lopsided, as Nong Kadyo does with his stick and lantern)."""
    if side == -1 and key in L.get("right", {}):
        return Vector(L["right"][key]) * s
    v = L[key]
    return Vector((v[0] * side, v[1], v[2])) * s

arm_data = bpy.data.armatures.new("rig")
arm = bpy.data.objects.new("rig", arm_data)
scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.mode_set(mode="EDIT")
def bone(name, head, tail, parent=None, connect=False):
    b = arm_data.edit_bones.new("mixamorig:" + name)
    b.head, b.tail = head, tail
    if parent: b.parent = arm_data.edit_bones["mixamorig:" + parent]; b.use_connect = connect
bone("Hips", J("hips"), J("spine"))
bone("Spine", J("spine"), J("chest"), "Hips", True)
bone("Spine1", J("chest"), J("upper_chest"), "Spine", True)
bone("Spine2", J("upper_chest"), J("neck"), "Spine1", True)
bone("Neck", J("neck"), J("head"), "Spine2", True)
bone("Head", J("head"), J("head_end"), "Neck", True)
for side, sx in (("Left", 1), ("Right", -1)):                 # the character's left is +X
    bone(side + "Shoulder", J("clavicle", sx), J("shoulder", sx), "Spine2")
    bone(side + "Arm", J("shoulder", sx), J("elbow", sx), side + "Shoulder", True)
    bone(side + "ForeArm", J("elbow", sx), J("wrist", sx), side + "Arm", True)
    bone(side + "Hand", J("wrist", sx), J("hand_tip", sx), side + "ForeArm", True)
    bone(side + "UpLeg", J("hip", sx), J("knee", sx), "Hips")
    bone(side + "Leg", J("knee", sx), J("ankle", sx), side + "UpLeg", True)
    bone(side + "Foot", J("ankle", sx), J("toe", sx), side + "Leg", True)
    bone(side + "ToeBase", J("toe", sx), J("toe_tip", sx), side + "Foot", True)
bpy.ops.object.mode_set(mode="OBJECT")

bpy.ops.object.select_all(action="DESELECT")
ob.select_set(True); arm.select_set(True)
bpy.context.view_layer.objects.active = arm
bpy.ops.object.parent_set(type="ARMATURE_AUTO")

def unweighted():
    return sum(1 for v in me.vertices if not any(g.weight > 0 for g in v.groups))

if unweighted() > 0:
    # Automatic weights need one clean closed surface, and AI-generated meshes often are not (inner
    # shells, self-crossing folds). So: rebuild a clean stand-in surface from the model's volume, work
    # the weights out on that, and copy them back onto the real model by nearest point.
    print("SKIN automatic weights failed on the model itself; using a rebuilt stand-in surface")
    for g in list(ob.vertex_groups): ob.vertex_groups.remove(g)
    for m in list(ob.modifiers): ob.modifiers.remove(m)
    ob.parent = None; ob.matrix_world = Matrix.Identity(4)
    proxy = ob.copy(); proxy.data = me.copy(); proxy.name = "stand_in"
    scene.collection.objects.link(proxy)
    bpy.ops.object.select_all(action="DESELECT")
    proxy.select_set(True); bpy.context.view_layer.objects.active = proxy
    proxy.data.remesh_voxel_size = (max(zs) - min(zs)) * s / 190
    proxy.data.remesh_voxel_adaptivity = 0.0
    bpy.ops.object.voxel_remesh()
    print("SKIN stand-in surface: %d vertices" % len(proxy.data.vertices))
    arm.select_set(True); bpy.context.view_layer.objects.active = arm
    bpy.ops.object.parent_set(type="ARMATURE_AUTO")
    bad = [v.index for v in proxy.data.vertices if not any(g.weight > 0 for g in v.groups)]
    if len(bad) > len(proxy.data.vertices) * 0.01:
        print("ERROR automatic weights failed on the stand-in too (%d vertices)" % len(bad)); sys.exit(1)
    if bad:                                                   # stray crumbs the rebuild left floating: drop them
        import bmesh
        bm = bmesh.new(); bm.from_mesh(proxy.data); bm.verts.ensure_lookup_table()
        bmesh.ops.delete(bm, geom=[bm.verts[i] for i in bad], context="VERTS")
        bm.to_mesh(proxy.data); bm.free()
        print("SKIN dropped %d stray stand-in vertices" % len(bad))
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

# every vertex must follow something, and a game engine reads at most four bones per vertex
bare = unweighted()
bpy.ops.object.select_all(action="DESELECT")
ob.select_set(True); bpy.context.view_layer.objects.active = ob
bpy.ops.object.vertex_group_limit_total(group_select_mode="ALL", limit=4)
bpy.ops.object.vertex_group_normalize_all(group_select_mode="ALL", lock_active=False)
used = {}
for v in me.vertices:
    for g in v.groups:
        if g.weight > 0.5: used[ob.vertex_groups[g.group].name] = used.get(ob.vertex_groups[g.group].name, 0) + 1
print("SKIN bones %d, vertices following nothing: %d" % (len(arm_data.bones), bare))
for b in arm_data.bones: print("  %-24s mainly drives %6d vertices" % (b.name, used.get(b.name, 0)))
if bare:
    print("ERROR automatic weights failed for part of the surface")

bpy.ops.file.pack_all()
os.makedirs(os.path.dirname(os.path.abspath(OUT)), exist_ok=True)
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(OUT))
print("SAVED %s (%.1f MB)" % (OUT, os.path.getsize(OUT) / 1e6))
