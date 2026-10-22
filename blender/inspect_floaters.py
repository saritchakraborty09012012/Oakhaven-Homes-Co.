import bpy
from mathutils import Vector


def wing_roof_z(x):
    return 8.30 - abs(x - 10.25)


seen = set()
for o in bpy.data.objects:
    if o.type != 'MESH' or '|' not in o.name:
        continue
    label = o.name.split('|')[5]
    if label in seen or label.startswith(('env_', 'dry_shingle', 'dry_felt',
                                          'dry_deck', 'ext_rakes')):
        continue
    bb = [o.matrix_world @ Vector(c) for c in o.bound_box]
    over = []
    for c in bb:
        if 6.8 <= c.x <= 13.8 and 0.1 <= c.y <= 9.3 and c.z > wing_roof_z(c.x) + 0.15:
            over.append(c)
    if over:
        seen.add(label)
        print(f'WPOKE {label:36s} n={len(over)} '
              f'x[{min(c.x for c in over):5.2f},{max(c.x for c in over):5.2f}] '
              f'y[{min(c.y for c in over):5.2f},{max(c.y for c in over):5.2f}] '
              f'zmax={max(c.z for c in over):5.2f}')
