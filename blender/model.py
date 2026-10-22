"""Procedural farmhouse model for the scroll-build website.
All geometry is built in Blender coordinates (Z up, front of house faces -Y).
Object names are encoded for the three.js runtime (dot-free, GLTFLoader-safe):
    stage|OOOO|anim|vstage|VVVV|label|ax,ay,az
where OOOO/VVVV are milli-unit integers (e.g. 0400 = 0.400) and ax,ay,az
are milli-unit axis components (+0000,-1000,+0000).
"""
import math
import random

import bmesh
import bpy
import numpy as np
from mathutils import Matrix, Vector

random.seed(42)

# ---------------------------------------------------------------- constants
SLAB_TOP = 0.35
F1_BOT = 0.47
F1_TOP = 3.60
F2_BOT = 3.68
F2_TOP = 6.45
EAVE_Z = 6.68          # roof plane at front eave (y=-0.42)
MAIN_RIDGE_Z = 11.47
MAIN_RIDGE_Y = 4.5
SQ2 = math.sqrt(2.0)

STUD_T, STUD_D = 0.09, 0.14
SPACE = 0.61


def main_roof_z(y):
    if y <= MAIN_RIDGE_Y:
        return EAVE_Z + (y + 0.42)
    return MAIN_RIDGE_Z - (y - MAIN_RIDGE_Y)


# --------------------------------------------------------------- bmesh utils

def box(bm, cx, cy, cz, sx, sy, sz, rot=None):
    m = Matrix.Translation((cx, cy, cz))
    if rot is not None:
        m = m @ rot
    m = m @ Matrix.Diagonal((sx, sy, sz, 1.0))
    bmesh.ops.create_cube(bm, size=1.0, matrix=m)


def prism_xz(bm, pts, thick, n_off=0.0):
    """Extrude a polygon defined in the XZ plane (y = n_off) along Y."""
    vt = [bm.verts.new((p[0], n_off + thick / 2, p[1])) for p in pts]
    vb = [bm.verts.new((p[0], n_off - thick / 2, p[1])) for p in pts]
    try:
        bm.faces.new(vt)
        bm.faces.new(list(reversed(vb)))
    except ValueError:
        pass
    n = len(pts)
    for i in range(n):
        j = (i + 1) % n
        try:
            bm.faces.new((vt[i], vt[j], vb[j], vb[i]))
        except ValueError:
            pass
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))


def prism_local(bm, pts2d, thick, xf):
    """Extrude polygon in local (a,b) plane along local Z, then transform."""
    vt = [Vector((a, b, thick / 2)) for a, b in pts2d]
    vb = [Vector((a, b, -thick / 2)) for a, b in pts2d]
    ft = [bm.verts.new(xf @ v) for v in vt]
    fb = [bm.verts.new(xf @ v) for v in vb]
    try:
        bm.faces.new(ft)
        bm.faces.new(list(reversed(fb)))
    except ValueError:
        pass
    n = len(pts2d)
    for i in range(n):
        j = (i + 1) % n
        try:
            bm.faces.new((ft[i], ft[j], fb[j], fb[i]))
        except ValueError:
            pass
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))


def cone(bm, r1, r2, depth, xf, segs=8):
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs,
                          radius1=r1, radius2=r2, depth=depth, matrix=xf)


def ico(bm, r, xf, subdiv=2, squash_y=1.0):
    m = xf @ Matrix.Diagonal((1.0, squash_y, 1.0, 1.0))
    bmesh.ops.create_icosphere(bm, subdivisions=subdiv, radius=r, matrix=m,
                               calc_uvs=True)


# ----------------------------------------------------------------- builder

class Builder:
    def __init__(self, context):
        self.context = context
        self.count = 0

    def obj(self, bm, mat, name, stage='env', order=0.0, anim='none',
            vstage='', vorder=0.0, pivot=None, uv_axes=None, uv_origin=None,
            tile=2.0, axis=(0.0, -1.0, 0.0)):
        if len(bm.verts) == 0:
            bm.free()
            return None
        # UVs from world coords
        uv_layer = bm.loops.layers.uv.new('UVMap')
        if uv_axes is not None:
            ua = Vector(uv_axes[0])
            va = Vector(uv_axes[1])
            org = Vector(uv_origin) if uv_origin else Vector((0, 0, 0))
            for f in bm.faces:
                for lh in f.loops:
                    co = lh.vert.co - org
                    lh[uv_layer].uv = (co.dot(ua) / tile, co.dot(va) / tile)
        else:
            for f in bm.faces:
                n = f.normal
                ax = int(np.argmax(np.abs(n)))
                oa, ob = {0: (1, 2), 1: (0, 2), 2: (0, 1)}[ax]
                e_a = Vector((1, 0, 0)) if oa == 0 else (Vector((0, 1, 0)) if oa == 1 else Vector((0, 0, 1)))
                e_b = Vector((1, 0, 0)) if ob == 0 else (Vector((0, 1, 0)) if ob == 1 else Vector((0, 0, 1)))
                for lh in f.loops:
                    co = lh.vert.co
                    lh[uv_layer].uv = (co.dot(e_a) / tile, co.dot(e_b) / tile)
        mesh = bpy.data.meshes.new(name)
        bm.to_mesh(mesh)
        bm.free()
        mesh.materials.append(mat)
        obj = bpy.data.objects.new('obj', mesh)
        bpy.context.scene.collection.objects.link(obj)
        if pivot is not None:
            pv = Vector(pivot)
            for v in mesh.vertices:
                v.co -= pv
            obj.location = pv
        ax_s = ','.join(f'{round(a * 1000):+05d}' for a in axis)
        o_code = f'{round(order * 1000):04d}'
        v_code = f'{round(vorder * 1000):04d}'
        obj.name = f'{stage}|{o_code}|{anim}|{vstage}|{v_code}|{name}|{ax_s}'
        self.count += 1
        return obj


def wall_xf(kind, at, outward=-1):
    """Transform mapping local (u, n, z) so n = outward direction.
    kind 'x': wall runs along +X at plane y=at (outward along Y).
    kind 'y': wall runs along +Y at plane x=at (outward along X).
    """
    if kind == 'x':
        S = Matrix.Diagonal((1.0, float(outward), 1.0, 1.0))
        return Matrix.Translation((0.0, at, 0.0)) @ S
    S = Matrix.Diagonal((1.0, -float(outward), 1.0, 1.0))
    R = Matrix.Rotation(math.pi / 2, 4, 'Z')
    return Matrix.Translation((at, 0.0, 0.0)) @ R @ S


def out_sign(kind, at):
    if kind == 'x':
        return -1 if at < 4.0 else 1
    return -1 if at < 0.0 else 1


def finish(bm, xf):
    bmesh.ops.transform(bm, matrix=xf, verts=bm.verts)
    bmesh.ops.recalc_face_normals(bm, faces=list(bm.faces))


# ------------------------------------------------------ framing primitives

def wall_frame_local(bm, u0, u1, z0, z1, openings=(), th=STUD_T, dep=STUD_D,
                     interior=False):
    plate_h = 0.04
    box(bm, (u0 + u1) / 2, 0, z0 + plate_h / 2, u1 - u0, dep, plate_h)
    box(bm, (u0 + u1) / 2, 0, z1 - plate_h / 2, u1 - u0, dep, plate_h)
    if not interior:
        box(bm, (u0 + u1) / 2, 0, z1 - plate_h * 1.5, u1 - u0, dep, plate_h)

    def full_stud(u, za, zb):
        if zb - za > 0.05:
            box(bm, u, 0, (za + zb) / 2, th, dep, zb - za)

    ops = sorted(openings, key=lambda o: o[0])
    # common studs
    u = u0 + th / 2
    while u < u1 - th / 2 + 1e-6:
        skip = any((o[0] - o[1] / 2 - th) < u < (o[0] + o[1] / 2 + th) for o in ops)
        if not skip:
            full_stud(u, z0 + plate_h, z1 - plate_h * 2)
        u += SPACE
    full_stud(u0 + th * 1.5, z0 + plate_h, z1 - plate_h * 2)
    full_stud(u1 - th * 1.5, z0 + plate_h, z1 - plate_h * 2)
    for oc, ow, oz0, oz1 in ops:
        for ku in (oc - ow / 2 - th / 2, oc + ow / 2 + th / 2):
            if u0 < ku < u1:
                full_stud(ku, z0 + plate_h, z1 - plate_h * 2)
                full_stud(ku, z0 + plate_h, oz1 + 0.19)  # jack
        # header
        hw = ow + 2 * th
        if oz1 + 0.19 < z1:
            box(bm, oc, 0, oz1 + 0.095, hw, dep * 1.15, 0.19)
        # sill
        if oz0 - 0.04 > z0:
            box(bm, oc, 0, oz0 - 0.02, ow, dep, 0.04)
            u = oc - ow / 2 + th / 2
            while u < oc + ow / 2:
                full_stud(u, z0 + plate_h, oz0 - 0.04)
                u += SPACE
        if oz1 + 0.19 < z1:
            u = oc - ow / 2 + th / 2
            while u < oc + ow / 2:
                full_stud(u, oz1 + 0.19, z1 - plate_h * 2)
                u += SPACE


def gable_frame_local(bm, u0, u1, zb, zpeak, peak_u=None, th=STUD_T,
                      dep=STUD_D):
    if peak_u is None:
        peak_u = (u0 + u1) / 2

    def ztop(u):
        if u <= peak_u:
            span = max(peak_u - u0, 1e-4)
            return zb + (u - u0) / span * (zpeak - zb)
        span = max(u1 - peak_u, 1e-4)
        return zb + (u1 - u) / span * (zpeak - zb)

    box(bm, (u0 + u1) / 2, 0, zb + 0.02, u1 - u0, dep, 0.04)
    u = u0 + th / 2
    while u < u1 - th / 2:
        zt = ztop(u) - 0.03
        if zt > zb + 0.1:
            box(bm, u, 0, (zb + 0.04 + zt) / 2, th, dep, zt - zb - 0.04)
        u += SPACE
    # rake plates
    for a, b, za, zz in ((u0, peak_u, zb, zpeak), (peak_u, u1, zpeak, zb)):
        dx = b - a
        dz = zz - za
        length = math.hypot(dx, abs(dz)) + 0.03
        ang = math.atan2(dz, dx)
        cx, cz = (a + b) / 2, (za + zz) / 2
        rot = Matrix.Rotation(-ang, 4, 'Y')
        box(bm, cx, 0, cz, length, dep, 0.045, rot=rot)


def rect_diff(r, h):
    rx0, rx1, rz0, rz1 = r
    hx0, hx1, hz0, hz1 = h
    if hx1 <= rx0 or hx0 >= rx1 or hz1 <= rz0 or hz0 >= rz1:
        return [r]
    out = []
    if hz0 > rz0:
        out.append((rx0, rx1, rz0, min(hz0, rz1)))
    if hz1 < rz1:
        out.append((rx0, rx1, max(hz1, rz0), rz1))
    mz0, mz1 = max(rz0, hz0), min(rz1, hz1)
    if mz1 > mz0:
        if hx0 > rx0:
            out.append((rx0, min(hx0, rx1), mz0, mz1))
        if hx1 < rx1:
            out.append((max(hx1, rx0), rx1, mz0, mz1))
    return [q for q in out if q[1] - q[0] > 0.02 and q[3] - q[2] > 0.02]


def panel_local(bm, u0, u1, z0, z1, openings, thick, n_off, skip=()):
    pieces = [(u0, u1, z0, z1)]
    for o in openings:
        oc, ow, oz0, oz1 = o
        pieces = [p for q in pieces
                  for p in rect_diff(q, (oc - ow / 2, oc + ow / 2, oz0, oz1))]
    for a, b, c, d in pieces:
        box(bm, (a + b) / 2, n_off, (c + d) / 2, b - a, thick, d - c)


def siding_local(bm, u0, u1, z0, z1, openings, n_base=0.108, thick=0.024):
    panel_local(bm, u0, u1, z0, z1, openings, thick, n_base)
    # battens
    bw, bt = 0.09, 0.03
    u = u0 + 0.02
    while u < u1 - 0.02:
        spans = [(z0, z1)]
        for oc, ow, oz0, oz1 in openings:
            if oc - ow / 2 < u < oc + ow / 2:
                ns = []
                for a, b in spans:
                    if oz0 > a:
                        ns.append((a, min(oz0, b)))
                    if oz1 < b:
                        ns.append((max(oz1, a), b))
                spans = ns
        for a, b in spans:
            if b - a > 0.08:
                box(bm, u, n_base + thick / 2 + bt / 2, (a + b) / 2,
                    bw, bt, b - a)
        u += 0.30


# ------------------------------------------------------------- house parts

def build_house(B, M, context):
    # shorthand -----------------------------------------------------------
    def wall_parts(wall, m_stud, m_osb, m_wrap, m_siding, m_stone):
        kind, at = wall['kind'], wall['at']
        u0, u1, z0, z1 = wall['u0'], wall['u1'], wall['z0'], wall['z1']
        ops = wall.get('openings', ())
        out = wall.get('out', out_sign(kind, at))
        xf = wall_xf(kind, at, out)
        pivot = None
        if wall.get('exterior', True):
            if kind == 'x':
                pivot = ((u0 + u1) / 2, at, z0)
            else:
                pivot = (at, (u0 + u1) / 2, z0)
        # framing
        bm = bmesh.new()
        wall_frame_local(bm, u0, u1, z0, z1, ops,
                         interior=not wall.get('exterior', True))
        finish(bm, xf)
        B.obj(bm, m_stud, 'frm_' + wall['id'], wall['sf'], wall['of'],
              'grow', pivot=pivot)
        if not wall.get('exterior', True):
            # drywall both faces of interior partitions (seen through windows)
            bm = bmesh.new()
            panel_local(bm, u0, u1, z0, z1, ops, 0.012, 0.078)
            panel_local(bm, u0, u1, z0, z1, ops, 0.012, -0.078)
            finish(bm, xf)
            B.obj(bm, M['drywall'], 'dry_pt_' + wall['id'], 'dry', 0.62,
                  'fade', tile=2.4)
            return
        # sheathing
        bm = bmesh.new()
        panel_local(bm, u0, u1, z0, z1, ops, 0.022, 0.082)
        finish(bm, xf)
        B.obj(bm, m_osb, 'dry_sh_' + wall['id'], 'dry', wall['osh'], 'grow',
              pivot=pivot)
        # house wrap
        bm = bmesh.new()
        panel_local(bm, u0, u1, z0, z1, ops, 0.012, 0.097)
        finish(bm, xf)
        B.obj(bm, m_wrap, 'dry_wr_' + wall['id'], 'dry', wall['owr'], 'grow',
              pivot=pivot)
        # siding (leaves stone band open at bottom when flagged)
        sd0 = 1.06 if wall.get('stone') else z0
        bm = bmesh.new()
        siding_local(bm, u0, u1, sd0, z1, ops)
        finish(bm, xf)
        B.obj(bm, m_siding, 'ext_sd_' + wall['id'], 'ext', wall['osd'],
              'grow', pivot=pivot)
        # stone veneer band (proud of casings/boxes to avoid z-fighting)
        if wall.get('stone'):
            bm = bmesh.new()
            panel_local(bm, u0, u1, z0, min(sd0 + 0.06, z1), ops, 0.096, 0.145)
            finish(bm, xf)
            B.obj(bm, m_stone, 'home_st_' + wall['id'], 'ext',
                  min(wall.get('osd', 0.1) + 0.04, 0.95), 'grow', pivot=pivot)
        # interior drywall on the inner face (visible through windows)
        bm = bmesh.new()
        panel_local(bm, u0, u1, z0, z1, ops, 0.012, -0.082)
        finish(bm, xf)
        B.obj(bm, M['drywall'], 'dry_in_' + wall['id'], 'dry', 0.64,
              'fade', tile=2.4)

    m_stud, m_osb, m_wrap = M['stud'], M['osb'], M['wrap']
    m_siding, m_stone = M['siding'], M['stone']
    m_conc, m_white, m_black = M['concrete'], M['white'], M['black']
    m_timber, m_door, m_glass = M['timber'], M['doorwood'], M['glass']
    m_shingle, m_felt = M['shingle'], M['felt']
    m_bulb = M['bulb']

    # ---------------- foundation ------------------------------------------
    bm = bmesh.new()
    strips = [
        (-8.35, 7.35, -0.55, 0.15),      # front main
        (-8.35, 7.35, 8.85, 9.55),       # back main
        (-8.35, -7.65, -0.55, 9.55),     # left main
        (6.65, 7.35, -0.55, 9.55),       # right main
        (6.65, 13.85, -0.25, 0.95),      # wing front
        (13.15, 13.85, -0.25, 8.85),     # wing right
        (6.65, 13.85, 8.15, 8.85),       # wing back
    ]
    for a, b, c, d in strips:
        box(bm, (a + b) / 2, (c + d) / 2, -0.12, b - a, d - c, 0.46)
    B.obj(bm, m_conc, 'fnd_footings', 'fnd', 0.05, 'rise', tile=3.0)

    bm = bmesh.new()
    stems = [
        (-8.15, 7.15, -0.15, 0.05), (-8.15, 7.15, 8.95, 9.15),
        (-8.15, -7.95, -0.15, 9.15), (6.95, 7.15, -0.15, 9.15),
        (6.95, 13.65, 0.45, 0.75), (13.45, 13.65, 0.45, 8.65),
        (6.95, 13.65, 8.35, 8.65),
    ]
    for a, b, c, d in stems:
        box(bm, (a + b) / 2, (c + d) / 2, 0.21, b - a, d - c, 0.42)
    B.obj(bm, m_conc, 'fnd_stems', 'fnd', 0.15, 'rise', tile=3.0)

    bm = bmesh.new()
    box(bm, -0.5, 4.5, 0.20, 14.6, 8.7, 0.30)
    box(bm, 10.25, 4.6, 0.20, 6.1, 7.3, 0.30)
    B.obj(bm, m_conc, 'fnd_slab', 'fnd', 0.30, 'rise', tile=3.0)

    bm = bmesh.new()
    box(bm, -0.5, -1.625, 0.20, 15.3, 3.25, 0.30)
    B.obj(bm, m_conc, 'fnd_porchslab', 'fnd', 0.42, 'rise', tile=3.0)

    # subfloor decks
    bm = bmesh.new()
    box(bm, -0.5, 4.5, 0.41, 14.6, 8.7, 0.12)
    box(bm, 10.25, 4.6, 0.41, 6.1, 7.3, 0.12)
    B.obj(bm, m_osb, 'fnd_deck', 'fnd', 0.55, 'grow',
          pivot=(-0.5, 4.5, 0.35), tile=2.4)

    # excavation mound(s)
    for i, (mx, my, s) in enumerate([(15.4, 2.5, 1.0), (-12.2, -5.0, 0.8)]):
        bm = bmesh.new()
        ico(bm, 2.4 * s, Matrix.Translation((mx, my, 0.15)) @
            Matrix.Diagonal((1.25, 1.0, 0.42, 1.0)), subdiv=2)
        B.obj(bm, M['dirt'], f'fnd_mound_{i}', 'fnd', 0.18 + i * 0.04, 'temp',
              vstage='home', vorder=0.30, tile=10.0)

    # lumber stack (temporary)
    bm = bmesh.new()
    lx, ly = 11.4, -1.9
    for k in range(2):
        box(bm, lx, ly + k * 0.9, 0.08, 2.5, 0.12, 0.14)
    for k in range(9):
        box(bm, lx + random.uniform(-0.05, 0.05), ly + 0.45,
            0.20 + k * 0.135, 2.4, 0.85, 0.12)
    for k in range(5):
        box(bm, lx - 1.0 + k * 0.5, ly + 0.45, 1.45, 0.10, 0.85, 0.12)
    B.obj(bm, m_stud, 'fnd_lumber', 'fnd', 0.86, 'temp',
          vstage='ext', vorder=0.10, tile=1.0)

    # ---------------- walls ------------------------------------------------
    WALLS = [
        dict(id='f1_front_a', kind='x', at=0.0, u0=-8.0, u1=-2.0, z0=F1_BOT,
             z1=F1_TOP, exterior=True, stone=True,
             openings=((-6.4, 2.4, 0.68, 2.85), (-3.6, 1.8, 0.68, 2.85)),
             sf='fnd', of=0.72, osh=0.12, owr=0.36, osd=0.08, ost=0.06),
        dict(id='f1_front_b', kind='x', at=0.0, u0=-2.0, u1=1.5, z0=F1_BOT,
             z1=F1_TOP, exterior=True, stone=True,
             openings=((-0.5, 2.05, 0.35, 2.80),),
             sf='fnd', of=0.80, osh=0.15, owr=0.39, osd=0.11, ost=0.09),
        dict(id='f1_front_c', kind='x', at=0.0, u0=1.5, u1=7.0, z0=F1_BOT,
             z1=F1_TOP, exterior=True, stone=True,
             openings=((2.6, 1.9, 0.68, 2.85), (5.5, 1.4, 0.68, 2.85)),
             sf='fnd', of=0.88, osh=0.18, owr=0.42, osd=0.14, ost=0.12),
        dict(id='f1_left', kind='y', at=-8.0, u0=0.0, u1=9.0, z0=F1_BOT,
             z1=F1_TOP, exterior=True,
             openings=((2.5, 1.2, 1.05, 2.75), (6.0, 1.2, 1.05, 2.75)),
             sf='frm', of=0.04, osh=0.20, owr=0.44, osd=0.16),
        dict(id='f1_back', kind='x', at=9.0, u0=-8.0, u1=7.0, z0=F1_BOT,
             z1=F1_TOP, exterior=True, openings=(),
             sf='frm', of=0.07, osh=0.22, owr=0.46, osd=0.18),
        dict(id='f1_right', kind='y', at=7.0, u0=0.0, u1=9.0, z0=F1_BOT,
             z1=F1_TOP, exterior=True, openings=(),
             sf='frm', of=0.09, osh=0.24, owr=0.47, osd=0.19),
        dict(id='f1_part_a', kind='x', at=4.5, u0=-7.4, u1=6.4, z0=F1_BOT,
             z1=F1_TOP, exterior=False, openings=((0.5, 0.9, 0.47, 2.4),),
             sf='frm', of=0.13),
        dict(id='f1_part_b', kind='y', at=1.0, u0=0.4, u1=8.6, z0=F1_BOT,
             z1=F1_TOP, exterior=False, openings=((3.5, 0.9, 0.47, 2.4),),
             sf='frm', of=0.15),
        dict(id='f2_front_a', kind='x', at=0.0, u0=-8.0, u1=-1.3, z0=F2_BOT,
             z1=F2_TOP, exterior=True, stone=False,
             openings=((-7.2, 1.0, 4.60, 6.10), (-4.0, 2.0, 4.45, 6.15)),
             sf='frm', of=0.28, osh=0.26, owr=0.49, osd=0.22),
        dict(id='f2_front_b', kind='x', at=0.0, u0=-1.3, u1=4.7, z0=F2_BOT,
             z1=F2_TOP, exterior=True,
             openings=((-0.6, 1.3, 4.60, 6.10), (2.5, 1.8, 4.45, 6.15)),
             sf='frm', of=0.31, osh=0.28, owr=0.51, osd=0.25),
        dict(id='f2_front_c', kind='x', at=0.0, u0=4.7, u1=7.0, z0=F2_BOT,
             z1=F2_TOP, exterior=True, openings=((5.7, 1.1, 4.60, 6.10),),
             sf='frm', of=0.34, osh=0.30, owr=0.53, osd=0.27),
        dict(id='f2_left', kind='y', at=-8.0, u0=0.0, u1=9.0, z0=F2_BOT,
             z1=F2_TOP, exterior=True,
             openings=((2.5, 1.1, 4.70, 6.05), (6.0, 1.1, 4.70, 6.05)),
             sf='frm', of=0.37, osh=0.32, owr=0.55, osd=0.29),
        dict(id='f2_back', kind='x', at=9.0, u0=-8.0, u1=7.0, z0=F2_BOT,
             z1=F2_TOP, exterior=True, openings=(),
             sf='frm', of=0.39, osh=0.34, owr=0.56, osd=0.30),
        dict(id='f2_right', kind='y', at=7.0, u0=0.0, u1=9.0, z0=F2_BOT,
             z1=F2_TOP, exterior=True, openings=(),
             sf='frm', of=0.41, osh=0.36, owr=0.57, osd=0.31),
        dict(id='f2_part_a', kind='x', at=4.5, u0=-7.4, u1=6.4, z0=F2_BOT,
             z1=F2_TOP, exterior=False, openings=(),
             sf='frm', of=0.43),
        dict(id='f2_part_b', kind='y', at=1.0, u0=0.4, u1=8.6, z0=F2_BOT,
             z1=F2_TOP, exterior=False, openings=((5.0, 0.9, 3.68, 5.6),),
             sf='frm', of=0.44),
        dict(id='wing_front', kind='x', at=0.6, u0=7.0, u1=13.5, z0=F1_BOT,
             z1=5.05, exterior=True, stone=True,
             openings=((10.25, 3.9, 0.35, 2.80),),
             sf='frm', of=0.18, osh=0.38, owr=0.58, osd=0.33, ost=0.15),
        dict(id='wing_right', kind='y', at=13.5, u0=0.6, u1=8.5, z0=F1_BOT,
             z1=5.05, exterior=True, openings=(),
             sf='frm', of=0.20, osh=0.40, owr=0.60, osd=0.34),
        dict(id='wing_back', kind='x', at=8.5, u0=7.0, u1=13.5, z0=F1_BOT,
             z1=5.05, exterior=True, openings=(),
             sf='frm', of=0.22, osh=0.42, owr=0.61, osd=0.35),
    ]
    for w in WALLS:
        wall_parts(w, m_stud, m_osb, m_wrap, m_siding, m_stone)

    # ---------------- gables ------------------------------------------------
    GABLES = [
        dict(id='gableA', kind='x', at=0.0, u0=-6.5, u1=-1.5, zb=F2_TOP,
             zpk=9.12, of=0.50, osh=0.44, owr=0.62, osd=0.40),
        dict(id='gableB', kind='x', at=0.0, u0=0.5, u1=4.5, zb=F2_TOP,
             zpk=8.62, of=0.52, osh=0.45, owr=0.63, osd=0.41),
        dict(id='gableML', kind='y', at=-8.0, u0=-0.35, u1=9.35, zb=F2_TOP,
             zpk=MAIN_RIDGE_Z, peak_u=MAIN_RIDGE_Y, of=0.54, osh=0.46,
             owr=0.64, osd=0.42),
        dict(id='gableMR', kind='y', at=7.0, u0=-0.35, u1=9.35, zb=F2_TOP,
             zpk=MAIN_RIDGE_Z, peak_u=MAIN_RIDGE_Y, of=0.55, osh=0.47,
             owr=0.65, osd=0.43),
        dict(id='gableWF', kind='x', at=0.6, u0=7.0, u1=13.5, zb=5.05,
             zpk=8.30, of=0.56, osh=0.48, owr=0.66, osd=0.44),
        dict(id='gableWB', kind='x', at=8.5, u0=7.0, u1=13.5, zb=5.05,
             zpk=8.30, of=0.57, osh=0.49, owr=0.67, osd=0.45),
    ]
    for g in GABLES:
        kind, at = g['kind'], g['at']
        u0, u1, zb, zpk = g['u0'], g['u1'], g['zb'], g['zpk']
        peak_u = g.get('peak_u', (u0 + u1) / 2)
        xf = wall_xf(kind, at, out_sign(kind, at))
        pivot = ((u0 + u1) / 2, at, zb) if kind == 'x' else (at, (u0 + u1) / 2, zb)
        # frame
        bm = bmesh.new()
        gable_frame_local(bm, u0, u1, zb, zpk, peak_u)
        finish(bm, xf)
        B.obj(bm, m_stud, 'frm_' + g['id'], 'frm', g['of'], 'grow', pivot=pivot)
        # triangle polygon (slightly inset u for sheathing/wrap/siding)
        tri = [(u0 + 0.02, zb), (u1 - 0.02, zb), (peak_u, zpk - 0.03)]
        bm = bmesh.new()
        prism_xz(bm, tri, 0.022, n_off=0.082)
        finish(bm, xf)
        B.obj(bm, m_osb, 'dry_sh_' + g['id'], 'dry', g['osh'], 'grow',
              pivot=pivot)
        bm = bmesh.new()
        prism_xz(bm, tri, 0.012, n_off=0.097)
        finish(bm, xf)
        B.obj(bm, m_wrap, 'dry_wr_' + g['id'], 'dry', g['owr'], 'grow',
              pivot=pivot)
        # siding + battens on triangle
        bm = bmesh.new()
        n0, n1, nh = 0.108, 0.132, 0.03
        pts = [(u0 + 0.02, n0 + nh / 2, zb), (u1 - 0.02, n0 + nh / 2, zb),
               (peak_u, n0 + nh / 2, zpk - 0.03)]
        vt = [bm.verts.new(p) for p in pts]
        vb = [bm.verts.new((p[0], n1, p[2])) for p in pts]
        try:
            bm.faces.new(vt)
            bm.faces.new(list(reversed(vb)))
            for i in range(3):
                j = (i + 1) % 3
                bm.faces.new((vt[i], vt[j], vb[j], vb[i]))
        except ValueError:
            pass

        def ztop(u):
            if u <= peak_u:
                return zb + (u - u0) / max(peak_u - u0, 1e-4) * (zpk - zb)
            return zb + (u1 - u) / max(u1 - peak_u, 1e-4) * (zpk - zb)

        u = u0 + 0.15
        while u < u1 - 0.1:
            zt = ztop(u) - 0.05
            if zt > zb + 0.1:
                box(bm, u, n1 + nh / 2, (zb + zt) / 2, 0.09, nh, zt - zb)
            u += 0.30
        finish(bm, xf)
        B.obj(bm, m_siding, 'ext_sd_' + g['id'], 'ext', g['osd'], 'grow',
              pivot=pivot)

    # second-floor joists + deck
    bm = bmesh.new()
    x = -7.9
    while x < 6.9:
        box(bm, x, 4.5, 3.48, 0.09, 8.9, 0.24)
        x += 0.45
    box(bm, -0.5, 0.05, 3.48, 14.9, 0.1, 0.24)
    box(bm, -0.5, 8.95, 3.48, 14.9, 0.1, 0.24)
    for xw in (7.4, 9.0, 10.6, 12.2, 13.3):
        box(bm, xw, 4.55, 3.48, 0.09, 7.8, 0.24)
    B.obj(bm, m_stud, 'frm_joists', 'frm', 0.24, 'grow',
          pivot=(-0.5, 4.5, 3.30), tile=1.0)
    bm = bmesh.new()
    box(bm, -0.5, 4.5, 3.64, 14.9, 8.9, 0.08)
    box(bm, 10.25, 4.55, 3.64, 6.3, 7.8, 0.08)
    B.obj(bm, m_osb, 'frm_deck2', 'frm', 0.26, 'grow',
          pivot=(-0.5, 4.5, 3.60), tile=2.4)

    # ---------------- porch framing ----------------------------------------
    bm = bmesh.new()
    box(bm, -0.5, -3.08, 3.99, 15.3, 0.16, 0.26)       # beam
    B.obj(bm, m_stud, 'frm_beam', 'frm', 0.60, 'drop', tile=1.0)
    bm = bmesh.new()
    box(bm, -0.5, -0.05, 4.30, 15.2, 0.10, 0.20)       # ledger
    B.obj(bm, m_stud, 'frm_ledger', 'frm', 0.58, 'grow',
          pivot=(-0.5, 0.0, 4.20), tile=1.0)

    cols_x = (-7.5, -4.85, -2.2, 0.45, 3.1, 5.75)
    for i, cx in enumerate(cols_x):
        bm = bmesh.new()
        box(bm, cx, -3.0, (0.35 + 3.86) / 2, 0.18, 0.18, 3.51)
        B.obj(bm, m_timber, f'frm_post_{i}', 'frm', 0.64 + i * 0.025, 'rise',
              tile=1.0)
        # knee braces (finish stage)
        bm = bmesh.new()
        bl = 0.62
        ang = math.radians(45)
        for sx in (-1, 1):
            cx2 = cx + sx * bl / 2 * math.cos(ang)
            cz = 3.86 - bl / 2 * math.sin(ang) - 0.02
            box(bm, cx2, -3.0, cz, bl, 0.12, 0.10,
                rot=Matrix.Rotation(sx * ang, 4, 'Y'))
        B.obj(bm, m_timber, f'ext_brace_{i}', 'ext', 0.58 + i * 0.015,
              'grow', pivot=(cx, -3.0, 3.4), tile=1.0)

    # porch rafters (visible under deck edges at eave)
    bm = bmesh.new()
    xr = -8.0
    while xr < 7.1:
        box(bm, xr, -1.7, 4.0, 0.09, 3.15, 0.19,
            rot=Matrix.Rotation(math.radians(14.2), 4, 'X'))
        xr += 0.61
    B.obj(bm, m_stud, 'frm_porchrafters', 'frm', 0.62, 'grow',
          pivot=(-0.5, -1.7, 3.6), tile=1.0)

    # ---------------- roofs (deck / felt / shingles) ------------------------
    def roof_set(label, pts2d, xf, origin, ua, va, o_deck, o_felt, o_sh,
                 slide_axis, tile=2.7):
        # deck
        bm = bmesh.new()
        prism_local(bm, pts2d, 0.13, xf)
        B.obj(bm, m_osb, 'dry_deck_' + label, 'dry', o_deck, 'slide',
              uv_axes=(ua, va), uv_origin=origin, tile=2.4, axis=slide_axis)
        # felt
        bm = bmesh.new()
        xf_f = xf @ Matrix.Translation((0, 0, 0.085))
        prism_local(bm, pts2d, 0.02, xf_f)
        B.obj(bm, m_felt, 'dry_felt_' + label, 'dry', o_felt, 'slide',
              uv_axes=(ua, va), uv_origin=origin, tile=2.6, axis=slide_axis)
        # shingles
        bm = bmesh.new()
        xf_s = xf @ Matrix.Translation((0, 0, 0.115))
        prism_local(bm, pts2d, 0.05, xf_s)
        B.obj(bm, m_shingle, 'dry_shingle_' + label, 'dry', o_sh, 'slide',
              uv_axes=(ua, va), uv_origin=origin, tile=tile, axis=slide_axis)

    vlen_main = SQ2 * 4.92
    xf_main_f = (Matrix.Translation((0.0, -0.42, EAVE_Z)) @
                 Matrix.Rotation(math.radians(45), 4, 'X'))
    pts_mf = [(-6.5, -0.10), (-4.0, 3.45), (-1.5, -0.10), (0.5, -0.10),
              (2.5, 2.74), (4.5, -0.10), (7.4, -0.10), (7.4, vlen_main),
              (-8.4, vlen_main), (-8.4, -0.10)]
    roof_set('mfront', pts_mf, xf_main_f, (0.0, -0.42, EAVE_Z),
             (1, 0, 0), (0, 0.7071, 0.7071), 0.06, 0.26, 0.40,
             (0.0, -0.7071, -0.7071))

    xf_main_b = (Matrix.Translation((0.0, MAIN_RIDGE_Y, MAIN_RIDGE_Z)) @
                 Matrix.Rotation(math.radians(-45), 4, 'X'))
    roof_set('mback', [(-8.4, -0.1), (7.4, -0.1), (7.4, vlen_main),
                       (-8.4, vlen_main)],
             xf_main_b, (0.0, MAIN_RIDGE_Y, MAIN_RIDGE_Z),
             (1, 0, 0), (0, 0.7071, -0.7071), 0.09, 0.28, 0.42,
             (0.0, 0.7071, -0.7071))

    for gid, ex, rz, pk_x, slant, orders in (
            ('gAl', -6.65, 6.47, -4.0, 3.75, (0.12, 0.30, 0.44)),
            ('gAr', -4.0, 9.12, -1.35, 3.75, (0.14, 0.31, 0.45)),
            ('gBl', 0.35, 6.47, 2.5, 2.90, (0.16, 0.32, 0.46)),
            ('gBr', 2.5, 8.62, 4.65, 2.90, (0.18, 0.33, 0.47))):
        if gid.endswith('l'):
            xf_g = Matrix.Translation((ex, -0.35, rz)) @ Matrix.Rotation(
                math.radians(-45), 4, 'Y')
            axis = (-0.7071, 0.0, -0.7071)
            org = (ex, -0.35, rz)
            ua, va = (0, 1, 0), (0.7071, 0, 0.7071)
        else:
            xf_g = Matrix.Translation((ex, -0.35, rz)) @ Matrix.Rotation(
                math.radians(45), 4, 'Y')
            axis = (0.7071, 0.0, -0.7071)
            org = (ex, -0.35, rz)
            ua, va = (0, 1, 0), (0.7071, 0, -0.7071)
        roof_set(gid, [(0, -0.55), (slant, -0.55), (slant, 3.60), (0, 3.60)],
                 xf_g, org, ua, va, orders[0], orders[1], orders[2], axis)

    # wing roofs
    xf_wl = Matrix.Translation((6.85, 0.25, 4.90)) @ Matrix.Rotation(
        math.radians(-45), 4, 'Y')
    roof_set('wl', [(0, 0.25), (4.85, 0.25), (4.85, 8.85), (0, 8.85)],
             xf_wl, (6.85, 0.25, 4.90), (0, 1, 0), (0.7071, 0, 0.7071),
             0.20, 0.34, 0.48, (-0.7071, 0.0, -0.7071))
    xf_wr = Matrix.Translation((10.25, 0.25, 8.30)) @ Matrix.Rotation(
        math.radians(45), 4, 'Y')
    roof_set('wr', [(0, 0.25), (4.85, 0.25), (4.85, 8.85), (0, 8.85)],
             xf_wr, (10.25, 0.25, 8.30), (0, 1, 0), (0.7071, 0, -0.7071),
             0.22, 0.35, 0.49, (0.7071, 0.0, -0.7071))

    # porch roof + soffit
    ang_p = math.atan2(0.80, 3.15)
    xf_p = (Matrix.Translation((0.0, -3.25, 3.62)) @
            Matrix.Rotation(ang_p, 4, 'X'))
    roof_set('porch', [(-8.15, 0), (7.15, 0), (7.15, 3.25), (-8.15, 3.25)],
             xf_p, (0.0, -3.25, 3.62), (1, 0, 0),
             (0, math.cos(ang_p), math.sin(ang_p)), 0.24, 0.36, 0.50,
             (0.0, -0.970, -0.246))
    bm = bmesh.new()
    xf_sf = xf_p @ Matrix.Translation((0, 0, -0.20))
    prism_local(bm, [(-8.1, 0.1), (7.1, 0.1), (7.1, 3.15), (-8.1, 3.15)],
                0.035, xf_sf)
    B.obj(bm, M['timber'], 'ext_soffit', 'ext', 0.40, 'slide',
          uv_axes=((1, 0, 0), (0, math.cos(ang_p), math.sin(ang_p))),
          uv_origin=(0.0, -3.25, 3.62), tile=1.2,
          axis=(0.0, -0.970, -0.246))

    # ---------------- trim: fascia, rakes, gutters --------------------------
    bm = bmesh.new()
    box(bm, -0.5, -0.42, 6.62, 15.9, 0.06, 0.30)
    B.obj(bm, m_white, 'ext_fascia_main', 'ext', 0.50, 'grow',
          pivot=(-0.5, -0.42, 6.45))
    bm = bmesh.new()
    box(bm, -0.5, -3.28, 3.58, 15.5, 0.05, 0.26)
    B.obj(bm, m_white, 'ext_fascia_porch', 'ext', 0.52, 'grow',
          pivot=(-0.5, -3.28, 3.4))
    bm = bmesh.new()
    box(bm, -0.5, 9.38, 6.62, 15.9, 0.06, 0.30)
    B.obj(bm, m_white, 'ext_fascia_back', 'ext', 0.51, 'grow',
          pivot=(-0.5, 9.38, 6.45))

    rake_specs = [
        ('A', -6.65, 6.47, -4.0, 9.12, 0.0),
        ('A2', -4.0, 9.12, -1.35, 6.47, 0.0),
        ('B', 0.35, 6.47, 2.5, 8.62, 0.0),
        ('B2', 2.5, 8.62, 4.65, 6.47, 0.0),
    ]
    bm = bmesh.new()
    for _, x0, z0, x1, z1, _p in rake_specs:
        L = math.hypot(x1 - x0, z1 - z0)
        ang = math.atan2(z1 - z0, x1 - x0)
        box(bm, (x0 + x1) / 2, -0.93, (z0 + z1) / 2 + 0.05, L, 0.10, 0.22,
            rot=Matrix.Rotation(-ang, 4, 'Y'))
    # wing rakes
    for x0, z0, x1, z1 in ((6.85, 4.90, 10.25, 8.30), (10.25, 8.30, 13.65, 4.90)):
        L = math.hypot(x1 - x0, z1 - z0)
        ang = math.atan2(z1 - z0, x1 - x0)
        box(bm, (x0 + x1) / 2, 0.47, (z0 + z1) / 2 + 0.05, L, 0.10, 0.22,
            rot=Matrix.Rotation(-ang, 4, 'Y'))
    # main side-gable rakes (left & right)
    for xx in (-8.42, 7.42):
        for y0, z0, y1, z1 in ((-0.42, 6.62, 4.5, MAIN_RIDGE_Z),
                               (4.5, MAIN_RIDGE_Z, 9.42, 6.62)):
            L = math.hypot(y1 - y0, z1 - z0)
            ang = math.atan2(z1 - z0, y1 - y0)
            # rotate about X: local X stays X; build in YZ via rot X
            box(bm, xx, (y0 + y1) / 2, (z0 + z1) / 2, 0.10, L, 0.22,
                rot=Matrix.Rotation(ang, 4, 'X'))
    B.obj(bm, m_white, 'ext_rakes', 'ext', 0.54, 'grow',
          pivot=(-0.5, -0.3, 6.5))

    # gutters + downspouts
    bm = bmesh.new()
    box(bm, -0.5, -0.50, 6.52, 15.9, 0.14, 0.13)
    box(bm, -0.5, -3.36, 3.50, 15.5, 0.13, 0.12)
    B.obj(bm, m_black, 'ext_gutters', 'ext', 0.66, 'drop')
    bm = bmesh.new()
    for dx, dy in ((-8.25, -0.48), (7.15, -0.48), (-8.15, -3.34),
                   (6.95, -3.34)):
        box(bm, dx, dy, 3.2, 0.10, 0.10, 6.4 if dy > -1 else 3.4)
    B.obj(bm, m_white, 'ext_downspouts', 'ext', 0.68, 'drop')

    # chimney
    bm = bmesh.new()
    box(bm, 4.6, 5.6, 8.6, 0.95, 1.10, 6.4)
    B.obj(bm, m_stone, 'ext_chimney', 'ext', 0.84, 'rise', tile=2.2)
    bm = bmesh.new()
    box(bm, 4.6, 5.6, 11.9, 1.15, 1.30, 0.16)
    B.obj(bm, m_conc, 'ext_chimneycap', 'ext', 0.86, 'rise', tile=3.0)

    # ---------------- windows, doors, lanterns ------------------------------
    def window_unit(cu, cz, w, h, at, kind, order, wid):
        xf = wall_xf(kind, at, out_sign(kind, at))
        piv = (cu, at, cz) if kind == 'x' else (at, cu, cz)
        bm = bmesh.new()
        fr = 0.09
        d = 0.12
        box(bm, cu, 0, cz + h / 2 - fr / 2, w, d, fr)
        box(bm, cu, 0, cz - h / 2 + fr / 2, w, d, fr)
        box(bm, cu - w / 2 + fr / 2, 0, cz, fr, d, h)
        box(bm, cu + w / 2 - fr / 2, 0, cz, fr, d, h)
        cols = 2 if w < 1.6 else 3
        rows = 3 if h > 1.5 else 2
        for ci in range(1, cols):
            xx = cu - w / 2 + w * ci / cols
            box(bm, xx, 0, cz, 0.028, d * 0.6, h - 2 * fr)
        for ri in range(1, rows):
            zz = cz - h / 2 + h * ri / rows
            box(bm, cu, 0, zz, w - 2 * fr, d * 0.6, 0.028)
        finish(bm, xf)
        B.obj(bm, m_black, f'ext_winframe_{wid}', 'ext', order, 'pop',
              pivot=piv, tile=0.8)
        # glass
        bm = bmesh.new()
        box(bm, cu, 0, cz, w - 0.05, 0.02, h - 0.05)
        finish(bm, xf)
        B.obj(bm, m_glass, f'glow_winglass_{wid}', 'ext', order + 0.005,
              'pop', pivot=piv, tile=0.8)
        # casing
        bm = bmesh.new()
        cw = 0.15
        box(bm, cu, 0.14, cz + h / 2 + cw / 2, w + 2 * cw, 0.05, cw)
        box(bm, cu, 0.14, cz - h / 2 - cw / 2, w + 2 * cw, 0.05, cw)
        box(bm, cu - w / 2 - cw / 2, 0.14, cz, cw, 0.05, h)
        box(bm, cu + w / 2 + cw / 2, 0.14, cz, cw, 0.05, h)
        finish(bm, xf)
        B.obj(bm, m_white, f'ext_wincasing_{wid}', 'ext', order - 0.02,
              'pop', pivot=piv, tile=0.8)

    wi = 0
    for w in WALLS:
        for (cu, ow, oz0, oz1) in w.get('openings', ()):
            is_door = oz0 < 0.5
            if is_door and not w.get('exterior'):
                continue
            if is_door and w['id'] == 'f1_front_b':
                continue
            if is_door and w['id'] == 'wing_front':
                # garage door handled separately
                continue
            window_unit(cu, (oz0 + oz1) / 2, ow - 0.06, oz1 - oz0 - 0.06,
                        w['at'], w['kind'], 0.33 + (wi % 14) * 0.012, wi)
            wi += 1
    # gable attic window for wing
    window_unit(10.25, 5.9, 1.0, 0.9, 0.6, 'x', 0.50, 99)

    # garage door
    xf_g = wall_xf('x', 0.6, -1)
    bm = bmesh.new()
    gx, gz0, gz1 = 10.25, 0.35, 2.80
    gw = 3.9
    box(bm, gx, 0.10, (gz0 + gz1) / 2, gw, 0.08, gz1 - gz0)
    for r in range(4):
        for c in range(4):
            box(bm, gx - gw / 2 + gw * (c + 0.5) / 4, 0.15,
                gz0 + (gz1 - gz0) * (r + 0.5) / 4,
                gw / 4 - 0.14, 0.03, (gz1 - gz0) / 4 - 0.12)
    finish(bm, xf_g)
    B.obj(bm, m_white, 'ext_garagedoor', 'ext', 0.53, 'rise',
          pivot=(gx, 0.6, gz0), tile=1.0)

    # front door (double, warm wood with glass panes) — world coords, front = -Y
    bm = bmesh.new()
    box(bm, -0.5, -0.05, 2.88, 2.45, 0.06, 0.16)
    box(bm, -1.62, -0.05, 1.575, 0.16, 0.06, 2.50)
    box(bm, 0.62, -0.05, 1.575, 0.16, 0.06, 2.50)
    B.obj(bm, m_white, 'ext_doorcasing', 'ext', 0.55, 'pop',
          pivot=(-0.5, -0.05, 1.575), tile=0.8)
    bm = bmesh.new()
    for sx in (-1, 1):
        lx = -0.5 + sx * 0.5
        box(bm, lx - 0.43, -0.03, 1.575, 0.13, 0.07, 2.30)
        box(bm, lx + 0.43, -0.03, 1.575, 0.13, 0.07, 2.30)
        box(bm, lx, -0.03, 0.475, 0.99, 0.07, 0.25)
        box(bm, lx, -0.03, 1.35, 0.99, 0.07, 0.12)
        box(bm, lx, -0.03, 2.675, 0.99, 0.07, 0.13)
        box(bm, lx, -0.07, 0.90, 0.72, 0.02, 0.72)
        box(bm, lx, -0.05, 2.02, 0.03, 0.03, 1.05)
        for rz in (1.70, 2.05, 2.35):
            box(bm, lx, -0.05, rz, 0.73, 0.03, 0.028)
    B.obj(bm, m_door, 'ext_doorwood', 'ext', 0.56, 'pop',
          pivot=(-0.5, -0.03, 1.575), tile=1.2)
    bm = bmesh.new()
    for sx in (-1, 1):
        lx = -0.5 + sx * 0.5
        box(bm, lx, -0.03, 2.02, 0.73, 0.02, 1.05)
    B.obj(bm, m_glass, 'glow_doorglass', 'ext', 0.565, 'pop',
          pivot=(-0.5, -0.03, 2.02), tile=0.8)
    bm = bmesh.new()
    for sx in (-1, 1):
        box(bm, -0.5 + sx * 0.10, -0.09, 1.35, 0.04, 0.08, 0.5)
    B.obj(bm, m_black, 'ext_doorhandle', 'ext', 0.57, 'pop',
          pivot=(-0.5, -0.09, 1.35), tile=0.5)

    # lanterns
    for i, lx in enumerate((-1.85, 0.85)):
        bm = bmesh.new()
        box(bm, lx, -0.08, 2.45, 0.16, 0.10, 0.34)
        box(bm, lx, -0.16, 2.68, 0.22, 0.16, 0.05)
        box(bm, lx, -0.16, 2.24, 0.20, 0.15, 0.04)
        B.obj(bm, m_black, f'ext_lantern_{i}', 'ext', 0.70, 'pop',
              pivot=(lx, -0.12, 2.45), tile=0.5)
        bm = bmesh.new()
        box(bm, lx, -0.16, 2.46, 0.12, 0.10, 0.30)
        B.obj(bm, m_bulb, f'glow_lantern_{i}', 'ext', 0.705, 'pop',
              pivot=(lx, -0.16, 2.46), tile=0.5)

    # house number plaque
    bm = bmesh.new()
    box(bm, 1.35, -0.06, 2.30, 0.14, 0.03, 0.22)
    B.obj(bm, m_black, 'ext_plaque', 'ext', 0.80, 'pop',
          pivot=(1.35, -0.06, 2.30), tile=0.4)

    # ---------------- interior (seen through windows & door) ---------------
    # living-room rug
    bm = bmesh.new()
    box(bm, -4.3, 2.3, 0.485, 3.8, 2.8, 0.03)
    B.obj(bm, M['carpet'], 'ext_rug', 'ext', 0.20, 'fade', tile=2.0)

    # 3-seat sofa facing the front windows
    bm = bmesh.new()
    box(bm, -4.6, 3.95, 0.68, 2.7, 0.75, 0.42)
    box(bm, -4.6, 4.28, 1.02, 2.7, 0.18, 0.95)
    box(bm, -5.95, 3.95, 0.82, 0.2, 0.75, 0.7)
    box(bm, -3.25, 3.95, 0.82, 0.2, 0.75, 0.7)
    for i in range(3):
        box(bm, -5.45 + i * 0.85, 3.8, 0.94, 0.78, 0.6, 0.14)
    B.obj(bm, M['sofa'], 'ext_sofa1', 'ext', 0.22, 'fade', tile=1.5)

    # loveseat against the left wall, facing into the room
    bm = bmesh.new()
    box(bm, -7.35, 2.0, 0.68, 0.75, 1.9, 0.42)
    box(bm, -7.68, 2.0, 1.02, 0.18, 1.9, 0.95)
    box(bm, -7.35, 1.1, 0.82, 0.75, 0.2, 0.7)
    box(bm, -7.35, 2.9, 0.82, 0.75, 0.2, 0.7)
    for i in range(2):
        box(bm, -7.2, 1.55 + i * 0.9, 0.94, 0.6, 0.82, 0.14)
    B.obj(bm, M['sofa2'], 'ext_sofa2', 'ext', 0.23, 'fade', tile=1.5)

    # coffee table
    bm = bmesh.new()
    box(bm, -4.4, 2.1, 0.86, 1.15, 0.62, 0.055)
    for dx in (-0.5, 0.5):
        for dy in (-0.24, 0.24):
            box(bm, -4.4 + dx, 2.1 + dy, 0.66, 0.07, 0.07, 0.36)
    B.obj(bm, M['doorwood'], 'ext_table', 'ext', 0.24, 'fade', tile=1.2)

    # staircase up to the second floor (seen through the right-hand windows)
    bm = bmesh.new()
    for i in range(13):
        top = 0.47 + 0.247 * (i + 1)
        box(bm, 5.9, 0.76 + 0.28 * i, (0.47 + top) / 2, 1.05, 0.28,
            top - 0.47)
    B.obj(bm, M['stud'], 'ext_stairs', 'ext', 0.26, 'fade', tile=1.5)

    # small indoor plants (one by the stairs, one beside the sofa)
    def indoor(x, y, order, s=1.0):
        bm = bmesh.new()
        cone(bm, 0.11 * s, 0.15 * s, 0.24 * s,
             Matrix.Translation((x, y, 0.47 + 0.12 * s)), segs=10)
        B.obj(bm, M['pot'], f'ext_pot_{int(order * 100)}', 'ext', order,
              'fade', tile=0.8)
        bm = bmesh.new()
        cone(bm, 0.028 * s, 0.045 * s, 0.30 * s,
             Matrix.Translation((x, y, 0.47 + 0.39 * s)), segs=6)
        ico(bm, 0.14 * s, Matrix.Translation(
            (x, y, 0.47 + 0.66 * s)), subdiv=2)
        ico(bm, 0.095 * s, Matrix.Translation(
            (x + 0.10 * s, y - 0.07 * s, 0.47 + 0.82 * s)), subdiv=2)
        ico(bm, 0.08 * s, Matrix.Translation(
            (x - 0.08 * s, y + 0.07 * s, 0.47 + 0.76 * s)), subdiv=2)
        B.obj(bm, M['leafB'], f'ext_plantin_{int(order * 100)}', 'ext',
              order + 0.01, 'fade', tile=1.0)

    indoor(4.85, 3.55, 0.27)
    indoor(-6.5, 4.15, 0.28)

    # ---------------- hardscape & landscape (home stage) --------------------
    bm = bmesh.new()
    box(bm, -0.5, -3.55, 0.28, 2.6, 0.65, 0.15)
    box(bm, -0.5, -4.10, 0.16, 2.6, 0.55, 0.14)
    box(bm, -0.5, -4.62, 0.03, 2.6, 0.55, 0.13)
    B.obj(bm, m_conc, 'home_steps', 'home', 0.12, 'rise', tile=3.0)
    bm = bmesh.new()
    box(bm, -0.5, -7.4, 0.02, 2.2, 5.5, 0.10)
    box(bm, 4.6, -9.0, 0.02, 10.5, 1.6, 0.10)
    box(bm, 9.85, -9.8, 0.02, 1.8, 2.0, 0.10)
    B.obj(bm, m_conc, 'home_walk', 'home', 0.16, 'fade', tile=3.0)
    bm = bmesh.new()
    box(bm, 10.6, -10.5, 0.015, 6.4, 25.0, 0.09)
    box(bm, 9.2, -9.5, 0.015, 2.6, 1.8, 0.09)
    B.obj(bm, M['gravel'], 'home_drive', 'home', 0.19, 'fade', tile=4.0)

    # mulch beds
    bm = bmesh.new()
    box(bm, -0.6, -3.85, 0.03, 16.4, 1.15, 0.09)
    box(bm, -8.55, -0.5, 0.03, 0.9, 6.5, 0.09)
    box(bm, 7.95, -2.2, 0.03, 1.5, 5.0, 0.09)
    B.obj(bm, M['mulch'], 'home_beds', 'home', 0.27, 'fade', tile=3.0)

    # plants
    def shrub(kind, x, y, s, order, mat, tint=0.0):
        bm = bmesh.new()
        if kind == 'cone':
            cone(bm, 0.42 * s, 0.02, 1.25 * s,
                 Matrix.Translation((x, y, 0.05 + 0.625 * s)), segs=10)
            cone(bm, 0.36 * s, 0.02, 1.05 * s,
                 Matrix.Translation((x + 0.05, y - 0.05, 0.05 + 0.75 * s)),
                 segs=8)
        elif kind == 'ball':
            ico(bm, 0.36 * s, Matrix.Translation((x, y, 0.10 + 0.33 * s)) @
                Matrix.Diagonal((1.0, 1.0, 0.85, 1.0)), subdiv=2)
            ico(bm, 0.28 * s, Matrix.Translation((x + 0.2, y + 0.12,
                                                  0.10 + 0.40 * s)), subdiv=2)
        elif kind == 'grass':
            for k in range(6):
                a = k * math.pi / 3 + random.uniform(-0.3, 0.3)
                cone(bm, 0.055 * s, 0.005, 0.85 * s,
                     Matrix.Translation((x + math.cos(a) * 0.1 * s,
                                         y + math.sin(a) * 0.1 * s,
                                         0.06 + 0.42 * s)) @
                     Matrix.Rotation(random.uniform(-0.35, 0.35), 4, 'X') @
                     Matrix.Rotation(random.uniform(-0.35, 0.35), 4, 'Y'),
                     segs=5)
        elif kind == 'flower':
            for k in range(4):
                ico(bm, 0.10 * s, Matrix.Translation(
                    (x + random.uniform(-0.12, 0.12),
                     y + random.uniform(-0.12, 0.12),
                     0.08 + random.uniform(0.05, 0.22))), subdiv=1)
        elif kind == 'tree':
            cone(bm, 0.06 * s, 0.03 * s, 0.9 * s,
                 Matrix.Translation((x, y, 0.45 * s)), segs=6)
            for k in range(4):
                ico(bm, 0.45 * s * random.uniform(0.8, 1.15),
                    Matrix.Translation((x + random.uniform(-0.3, 0.3) * s,
                                        y + random.uniform(-0.3, 0.3) * s,
                                        0.9 * s + random.uniform(0, 0.5) * s)),
                    subdiv=2, squash_y=0.8)
        B.obj(bm, mat, f'home_plant_{kind}_{int(order * 100)}', 'home',
              order, 'grow', pivot=(x, y, 0.02), tile=1.5)

    # window flower boxes on the porch (in four bloom colours)
    for j, (wx, wwx, mk) in enumerate(((-6.4, 1.9, M['flowerY']),
                                       (-3.6, 1.5, M['flowerR']),
                                       (2.6, 1.6, M['flowerW']),
                                       (5.5, 1.3, M['flowerP']))):
        bm = bmesh.new()
        box(bm, wx, -0.38, 0.55, wwx, 0.42, 0.40)
        B.obj(bm, M['doorwood'], f'home_box_{j}', 'home', 0.30, 'fade',
              tile=1.0)
        bm = bmesh.new()
        for k in range(5):
            ico(bm, 0.09, Matrix.Translation(
                (wx - wwx / 2 + 0.15 + k * (wwx - 0.3) / 4,
                 -0.38 + random.uniform(-0.1, 0.1),
                 0.75 + random.uniform(0.04, 0.12))), subdiv=1)
        B.obj(bm, mk, f'home_boxfl_{j}', 'home', 0.32, 'grow',
              pivot=(wx, -0.38, 0.75), tile=0.6)

    # lawn stepping stones leading off the walk
    bm = bmesh.new()
    box(bm, -1.9, -10.9, 0.02, 0.72, 0.52, 0.06)
    B.obj(bm, m_conc, 'home_stones', 'home', 0.22, 'fade', tile=2.0)

    plants = [
        ('cone', -2.75, -3.85, 1.05, 0.33), ('cone', 1.65, -3.85, 1.05, 0.35),
        ('ball', -6.6, -3.75, 1.0, 0.38), ('ball', -5.4, -3.72, 0.95, 0.40),
        ('ball', -4.2, -3.78, 1.05, 0.42), ('ball', 3.0, -3.75, 1.0, 0.44),
        ('ball', 4.2, -3.72, 0.95, 0.46), ('ball', 5.4, -3.78, 1.05, 0.48),
        ('ball', 6.4, -3.70, 0.9, 0.50),
        ('grass', -7.6, -3.80, 1.1, 0.52), ('grass', -3.4, -3.85, 1.0, 0.54),
        ('grass', 2.3, -3.88, 1.05, 0.56), ('grass', 5.9, -3.90, 1.0, 0.58),
        ('grass', 7.9, -2.4, 1.1, 0.60), ('grass', -8.5, -2.2, 1.0, 0.61),
        ('flower', -6.0, -4.05, 1.0, 0.62, 'p'), ('flower', -4.6, -4.08, 1.0, 0.64, 'y'),
        ('flower', -3.0, -4.02, 1.0, 0.65, 'w'), ('flower', -1.9, -4.10, 1.0, 0.66, 'r'),
        ('flower', 1.1, -4.06, 1.0, 0.67, 'u'), ('flower', 2.6, -4.03, 1.0, 0.68, 'y'),
        ('flower', 4.0, -4.09, 1.0, 0.69, 'w'), ('flower', 5.5, -4.04, 1.0, 0.70, 'r'),
        ('flower', 6.6, -4.00, 1.0, 0.71, 'p'),
        ('ball', -1.85, -4.55, 0.8, 0.73), ('ball', 0.95, -4.55, 0.8, 0.74),
        # second wave of blooms (arrives late in the home stage)
        ('flower', -5.3, -4.12, 0.9, 0.75, 'r'), ('flower', -3.8, -4.00, 0.9, 0.76, 'u'),
        ('flower', -2.45, -4.13, 0.9, 0.77, 'y'), ('flower', 1.85, -4.12, 0.9, 0.78, 'w'),
        ('flower', 3.3, -4.14, 0.9, 0.79, 'p'), ('flower', 4.75, -4.11, 0.9, 0.80, 'y'),
        ('flower', 6.1, -4.13, 0.9, 0.81, 'w'),
        # left side bed
        ('flower', -8.50, -2.6, 0.95, 0.82, 'y'), ('flower', -8.45, -1.5, 0.95, 0.83, 'r'),
        ('flower', -8.60, -0.3, 0.95, 0.84, 'w'), ('flower', -8.50, 0.9, 0.95, 0.85, 'u'),
        ('flower', -8.45, 2.0, 0.95, 0.86, 'y'),
        # right side bed (removed/shifted to avoid path obstruction)
        ('flower', 9.2, -4.5, 0.9, 0.87, 'u'), ('flower', 9.8, -3.8, 0.9, 0.88, 'w'),
        ('flower', 9.1, -2.9, 0.9, 0.89, 'r'), ('flower', 9.9, -2.0, 0.9, 0.90, 'y'),
        # low hedge lining the front walk
        ('ball', 0.0, -10.2, 0.5, 0.91), ('ball', 1.3, -10.2, 0.5, 0.92),
        ('ball', 2.6, -10.2, 0.5, 0.93), ('ball', 3.9, -10.2, 0.5, 0.94),
        ('ball', 5.2, -10.2, 0.5, 0.95), ('ball', 6.5, -10.2, 0.5, 0.96),
        # extra shade tree on the west lawn
        ('tree', -11.5, -7.5, 0.9, 0.97),
    ]
    leaf_mats = [M['leafA'], M['leafB'], M['leafC']]
    flow_mats = {'p': M['flower'], 'y': M['flowerY'], 'r': M['flowerR'],
                 'w': M['flowerW'], 'u': M['flowerP']}
    for i, e in enumerate(plants):
        k, x, y, s, o = e[:5]
        if k == 'flower':
            mat = flow_mats[e[5] if len(e) > 5 else 'p']
        else:
            mat = leaf_mats[i % 3]
        shrub(k, x, y, s, o, mat)


def build_trees(B, M):
    rng = random.Random(7)
    leaf_mats = [M['leafA'], M['leafB'], M['leafC']]
    spots = [(-16.5, 1.5, 1.35), (-19.0, -8.0, 1.15), (-13.5, 12.0, 1.0),
             (-9.0, 16.0, 0.9), (-21.0, 8.0, 1.2), (-24.0, -2.0, 1.1),
             (17.5, 3.0, 1.15), (21.0, -3.0, 0.95), (16.0, 13.0, 1.05),
             (24.0, 9.0, 1.2), (13.5, 17.0, 0.9), (-4.0, 19.0, 1.0),
             (5.0, 20.0, 1.05), (28.0, 16.0, 1.1), (-28.0, 14.0, 1.15),
             (-31.0, 2.0, 1.0), (31.0, 2.0, 1.0), (9.5, 24.0, 0.95),
             (-11.0, 25.0, 1.0), (1.0, 27.0, 1.05), (19.0, 22.0, 0.95),
             (-19.0, 21.0, 1.0), (34.0, 10.0, 0.9), (-34.0, 8.0, 0.95),
             (50.0, -50.0, 0.01), (-18.5, -12.0, 0.55), (-26.0, -6.0, 0.9)]
    for i, (x, y, s) in enumerate(spots):
        h = rng.uniform(6.0, 10.5) * s
        r_b = 0.30 * s
        bm = bmesh.new()
        cone(bm, r_b, r_b * 0.55, h * 0.55,
             Matrix.Translation((x, y, h * 0.275)), segs=8)
        for _ in range(3):
            a = rng.uniform(0, 6.28)
            cone(bm, 0.10 * s, 0.04 * s, h * 0.35,
                 Matrix.Translation((x + math.cos(a) * 0.3, y + math.sin(a) * 0.3,
                                     h * 0.55)) @
                 Matrix.Rotation(rng.uniform(0.4, 0.9), 4, 'X') @
                 Matrix.Rotation(a, 4, 'Z'), segs=5)
        B.obj(bm, M['bark'], f'env_tree_{i}_trunk', 'env', 0, 'none', tile=1.2)
        bm = bmesh.new()
        n_blobs = rng.randint(4, 7)
        for k in range(n_blobs):
            a = rng.uniform(0, 6.28)
            rr = rng.uniform(1.5, 2.9) * s
            ico(bm, rr, Matrix.Translation(
                (x + math.cos(a) * rng.uniform(0.2, 1.5) * s,
                 y + math.sin(a) * rng.uniform(0.2, 1.5) * s,
                 h * rng.uniform(0.72, 1.05))), subdiv=2, squash_y=0.78)
        B.obj(bm, leaf_mats[i % 3], f'env_tree_{i}_leaf', 'env', 0, 'none',
              tile=3.0)
