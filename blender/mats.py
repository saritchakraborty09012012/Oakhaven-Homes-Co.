"""Blender material helpers for the farmhouse export."""
import bpy


def _img(path, colorspace):
    img = bpy.data.images.load(path)
    img.colorspace_settings.name = colorspace
    img.pack()
    return img


def make_pbr(name, albedo_path, normal_path=None, rough=0.8, metal=0.0,
             alpha=None, emit_path=None, emit_strength=0.0, base_color=None):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    if albedo_path:
        tex = nt.nodes.new('ShaderNodeTexImage')
        tex.image = _img(albedo_path, 'sRGB')
        nt.links.new(tex.outputs['Color'], bsdf.inputs['Base Color'])
    if base_color is not None:
        bsdf.inputs['Base Color'].default_value = (*base_color, 1.0)
    if normal_path:
        ntex = nt.nodes.new('ShaderNodeTexImage')
        ntex.image = _img(normal_path, 'Non-Color')
        nmap = nt.nodes.new('ShaderNodeNormalMap')
        nmap.inputs['Strength'].default_value = 1.0
        nt.links.new(ntex.outputs['Color'], nmap.inputs['Color'])
        nt.links.new(nmap.outputs['Normal'], bsdf.inputs['Normal'])
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if alpha is not None:
        bsdf.inputs['Alpha'].default_value = alpha
        m.blend_method = 'BLEND' if alpha < 1.0 else 'OPAQUE'
    if emit_strength > 0:
        bsdf.inputs['Emission Color'].default_value = (1.0, 0.72, 0.42, 1.0)
        bsdf.inputs['Emission Strength'].default_value = emit_strength
    return m


def make_flat(name, color, rough=0.7, metal=0.0, alpha=None,
              emit_color=None, emit_strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*color, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if alpha is not None:
        bsdf.inputs['Alpha'].default_value = alpha
        m.blend_method = 'BLEND'
    if emit_color is not None:
        bsdf.inputs['Emission Color'].default_value = (*emit_color, 1.0)
        bsdf.inputs['Emission Strength'].default_value = emit_strength
    return m
