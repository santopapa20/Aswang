# Turns a model about the vertical so it faces the way the rigging tools expect (its front at -Y), and
# centres it over the origin with its lowest point on the ground. For a model that was generated standing
# at an angle.
# usage: blender -b --factory-startup --python turn_model.py -- <model.blend> <degrees> <out.blend>
#   degrees  positive turns it anticlockwise seen from above
import bpy, sys, math, os
from mathutils import Matrix, Vector

argv = sys.argv[sys.argv.index("--") + 1:]
SRC, DEG, OUT = argv[0], float(argv[1]), argv[2]
bpy.ops.wm.open_mainfile(filepath=SRC)
ob = next(o for o in bpy.context.scene.objects if o.type == "MESH")
me = ob.data
me.transform(ob.matrix_world); ob.matrix_world = Matrix.Identity(4)
me.transform(Matrix.Rotation(math.radians(DEG), 4, "Z"))
xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
me.transform(Matrix.Translation(Vector((-(min(xs) + max(xs)) / 2, -(min(ys) + max(ys)) / 2, -min(zs)))))
me.update()
bpy.ops.file.pack_all()
bpy.ops.wm.save_as_mainfile(filepath=os.path.abspath(OUT))
xs = [v.co.x for v in me.vertices]; ys = [v.co.y for v in me.vertices]; zs = [v.co.z for v in me.vertices]
print("TURNED %.1f degrees: size x %.3f y %.3f z %.3f -> %s" % (DEG, max(xs) - min(xs), max(ys) - min(ys), max(zs) - min(zs), OUT))
