"""Headless Blender build: procedural textures + farmhouse -> public/assets/house.glb
Run:  blender -b --python blender/build_house.py
"""
import os
import sys
import time

import bpy

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

import numpy as np  # noqa: E402
import texgen as T  # noqa: E402
import mats as MAT  # noqa: E402
from model import Builder, build_house, build_trees  # noqa: E402

ROOT = os.path.dirname(HERE)
OUT = os.path.join(ROOT, 'public', 'assets')
TEX = os.path.join(OUT, 'tex')
os.makedirs(TEX, exist_ok=True)

t0 = time.time()

# ---------------------------------------------------------------- clean scene
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
if bpy.context.collection is None:
    coll = bpy.data.collections.new('House')
    scene.collection.children.link(coll)

# ---------------------------------------------------------------- textures
def save(name, arr):
    if arr.ndim == 2:
        arr = np.stack([arr] * 3, axis=-1)
    if arr.shape[2] == 3:
        arr = np.concatenate([arr, np.ones(arr.shape[:2] + (1,), np.float32)], axis=-1)
    h, w = arr.shape[:2]
    img = bpy.data.images.new(name, width=w, height=h, alpha=True)
    img.pixels.foreach_set(np.ascontiguousarray(arr, dtype=np.float32).ravel())
    path = os.path.join(TEX, name + '.png')
    img.filepath_raw = path
    img.file_format = 'PNG'
    img.save()
    bpy.data.images.remove(img)
    print(f'  tex {name} ({w}x{h})')
    return path


print('== generating textures ==')
P = {}
P['stud'] = save('stud', T.tex_wood(512, seed=1, base=(0.82, 0.68, 0.46), contrast=0.26))
P['timber'] = save('timber', T.tex_wood(512, seed=21, base=(0.76, 0.56, 0.32), contrast=0.34))
P['doorwood'] = save('doorwood', T.tex_wood(512, seed=31, base=(0.55, 0.33, 0.15), contrast=0.38))
P['osb'] = save('osb', T.tex_osb(512, seed=2))
P['wrap'] = save('wrap', T.tex_wrap(512, seed=3))
P['siding'] = save('siding', T.tex_siding(1024, seed=4))
P['siding_n'] = save('siding_n', T.height_to_normal(
    np.roll(T.tex_siding(1024, seed=4)[..., 0], 0), 1.2))
P['shingle'] = save('shingle', T.tex_shingle(1024, seed=5))
_sh_h = (T.tex_shingle(1024, seed=5)[..., 0])
P['shingle_n'] = save('shingle_n', T.height_to_normal(_sh_h, 1.8))
P['felt'] = save('felt', T.tex_felt(512, seed=6))
P['concrete'] = save('concrete', T.tex_concrete(512, seed=7))
P['concrete_n'] = save('concrete_n', T.height_to_normal(
    T.tex_concrete(512, seed=7)[..., 0], 1.0))
_stone, _stone_h = T.tex_stone(1024, seed=8)
P['stone'] = save('stone', _stone)
P['stone_n'] = save('stone_n', T.height_to_normal(_stone_h, 2.6))
P['grass'] = save('grass', T.tex_grass(1024, seed=9))
P['dirt'] = save('dirt', T.tex_dirt(1024, seed=10))
P['gravel'] = save('gravel', T.tex_gravel(512, seed=11))
P['bark'] = save('bark', T.tex_bark(512, seed=12))
P['leaf'] = save('leaf', T.tex_leaf(512, seed=13))
P['mulch'] = save('mulch', T.tex_mulch(512, seed=14))

# ---------------------------------------------------------------- materials
print('== materials ==')
M = {}
M['stud'] = MAT.make_pbr('stud', P['stud'], rough=0.78)
M['timber'] = MAT.make_pbr('timber', P['timber'], rough=0.68)
M['doorwood'] = MAT.make_pbr('doorwood', P['doorwood'], rough=0.58)
M['osb'] = MAT.make_pbr('osb', P['osb'], rough=0.85)
M['wrap'] = MAT.make_pbr('wrap', P['wrap'], rough=0.72)
M['siding'] = MAT.make_pbr('siding', P['siding'], P['siding_n'], rough=0.90)
M['shingle'] = MAT.make_pbr('shingle', P['shingle'], P['shingle_n'], rough=0.88)
M['felt'] = MAT.make_pbr('felt', P['felt'], rough=0.9)
M['concrete'] = MAT.make_pbr('concrete', P['concrete'], P['concrete_n'], rough=0.85)
M['stone'] = MAT.make_pbr('stone', P['stone'], P['stone_n'], rough=0.86)
M['white'] = MAT.make_flat('white', (0.90, 0.90, 0.88), rough=0.85)
M['black'] = MAT.make_flat('black', (0.045, 0.048, 0.052), rough=0.55, metal=0.15)
M['glass'] = MAT.make_flat('glass', (0.035, 0.045, 0.055), rough=0.05, alpha=0.4)
M['bulb'] = MAT.make_flat('bulb', (0.9, 0.75, 0.5), rough=0.4,
                          emit_color=(1.0, 0.78, 0.22), emit_strength=5.0)
M['drywall'] = MAT.make_flat('drywall', (0.85, 0.78, 0.70), rough=0.92)
M['sofa'] = MAT.make_flat('sofa', (0.56, 0.50, 0.43), rough=0.9)
M['sofa2'] = MAT.make_flat('sofa2', (0.46, 0.44, 0.42), rough=0.9)
M['carpet'] = MAT.make_flat('carpet', (0.47, 0.23, 0.19), rough=0.97)
M['pot'] = MAT.make_flat('pot', (0.55, 0.32, 0.22), rough=0.8)
M['dirt'] = MAT.make_pbr('dirt', P['dirt'], rough=0.92)
M['gravel'] = MAT.make_pbr('gravel', P['gravel'], rough=0.9)
M['mulch'] = MAT.make_pbr('mulch', P['mulch'], rough=0.95)
M['bark'] = MAT.make_pbr('bark', P['bark'], rough=0.9)


def leaf_mat(name, hue):
    import bpy as _b
    m = _b.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = _b.data.images.load(P['leaf'])
    tex.image.colorspace_settings.name = 'sRGB'
    hs = nt.nodes.new('ShaderNodeHueSaturation')
    hs.inputs['Hue'].default_value = hue
    hs.inputs['Saturation'].default_value = 1.05
    hs.inputs['Value'].default_value = 1.0
    nt.links.new(tex.outputs['Color'], hs.inputs['Color'])
    nt.links.new(hs.outputs['Color'], bsdf.inputs['Base Color'])
    nt.links.new(tex.outputs['Alpha'], bsdf.inputs['Alpha'])
    bsdf.inputs['Roughness'].default_value = 0.82
    m.blend_method = 'CLIP'
    return m


M['leafA'] = leaf_mat('leafA', 0.50)
M['leafB'] = leaf_mat('leafB', 0.47)
M['leafC'] = leaf_mat('leafC', 0.53)
M['flower'] = MAT.make_flat('flower', (0.55, 0.35, 0.42), rough=0.8)
M['flowerY'] = MAT.make_flat('flowerY', (0.93, 0.76, 0.24), rough=0.8)
M['flowerR'] = MAT.make_flat('flowerR', (0.86, 0.30, 0.28), rough=0.8)
M['flowerW'] = MAT.make_flat('flowerW', (0.94, 0.92, 0.87), rough=0.8)
M['flowerP'] = MAT.make_flat('flowerP', (0.70, 0.46, 0.78), rough=0.8)

# ---------------------------------------------------------------- build
print('== modeling ==')
B = Builder(bpy.context)
build_house(B, M, bpy.context)
build_trees(B, M)
print(f'  objects: {B.count}')

# ---------------------------------------------------------------- export
glb = os.path.join(OUT, 'house.glb')
print('== export ->', glb)
bpy.ops.export_scene.gltf(
    filepath=glb,
    export_format='GLB',
    export_yup=True,
    export_apply=False,
    export_materials='EXPORT',
    export_texcoords=True,
    export_normals=True,
    export_cameras=False,
    export_lights=False,
    export_extras=False,
    use_selection=False,
)
print(f'== done in {time.time() - t0:.1f}s  size={os.path.getsize(glb)/1e6:.1f}MB')
