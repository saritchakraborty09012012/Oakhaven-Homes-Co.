"""Procedural PBR texture generation for the OAKHAVEN farmhouse (numpy only)."""
import math
import numpy as np

F32 = np.float32


def vnoise(h, w, cells, seed=0, octaves=4, persistence=0.5):
    """Seamless periodic value-noise fbm. cells: int or (cy, cx)."""
    if isinstance(cells, (int, float)):
        cells = (int(cells), int(cells))
    rng = np.random.default_rng(seed)
    out = np.zeros((h, w), F32)
    amp, tot = 1.0, 0.0
    cy0, cx0 = cells
    for o in range(octaves):
        cy = max(2, cy0 * (2 ** o))
        cx = max(2, cx0 * (2 ** o))
        g = rng.random((cy, cx)).astype(F32)
        ys = np.linspace(0, cy, h, endpoint=False)
        xs = np.linspace(0, cx, w, endpoint=False)
        y0 = ys.astype(np.int32)
        x0 = xs.astype(np.int32)
        fy = (ys - y0)[:, None]
        fx = (xs - x0)[None, :]
        fy = (fy * fy * (3 - 2 * fy)).astype(F32)
        fx = (fx * fx * (3 - 2 * fx)).astype(F32)
        y1 = (y0 + 1) % cy
        x1 = (x0 + 1) % cx
        v00 = g[np.ix_(y0, x0)]
        v01 = g[np.ix_(y0, x1)]
        v10 = g[np.ix_(y1, x0)]
        v11 = g[np.ix_(y1, x1)]
        out += amp * (v00 * (1 - fx) * (1 - fy) + v01 * fx * (1 - fy)
                      + v10 * (1 - fx) * fy + v11 * fx * fy)
        tot += amp
        amp *= persistence
    return out / tot


def fbm(h, w, cells, seed=0, octaves=5):
    return vnoise(h, w, cells, seed, octaves)


def fill_rect(a, x0, y0, x1, y1, color, alpha=1.0):
    h, w = a.shape[:2]
    xs = np.arange(int(math.floor(x0)), int(math.ceil(x1)))
    ys = np.arange(int(math.floor(y0)), int(math.ceil(y1)))
    if xs.size == 0 or ys.size == 0:
        return
    xi = np.mod(xs, w)
    yi = np.mod(ys, h)
    blk = np.asarray(color, F32)
    tgt = a[np.ix_(yi, xi)]
    if alpha >= 1.0:
        a[np.ix_(yi, xi)] = blk
    else:
        a[np.ix_(yi, xi)] = tgt * (1.0 - alpha) + blk * alpha


def fill_ellipse(a, cx, cy, rx, ry, color, alpha=1.0, angle=0.0):
    h, w = a.shape[:2]
    reach = int(math.ceil(max(rx, ry))) + 2
    xs = np.arange(int(cx) - reach, int(cx) + reach + 1)
    ys = np.arange(int(cy) - reach, int(cy) + reach + 1)
    if xs.size == 0 or ys.size == 0:
        return
    X, Y = np.meshgrid(xs, ys)
    dx = X - cx
    dy = Y - cy
    ca, sa = math.cos(angle), math.sin(angle)
    xr = dx * ca + dy * sa
    yr = -dx * sa + dy * ca
    m = (xr / max(rx, 1e-3)) ** 2 + (yr / max(ry, 1e-3)) ** 2 <= 1.0
    if not m.any():
        return
    xi = np.mod(X, w)
    yi = np.mod(Y, h)
    sel = m
    tgt = a[yi[sel], xi[sel]]
    blk = np.asarray(color, F32)
    if alpha >= 1.0:
        a[yi[sel], xi[sel]] = blk
    else:
        a[yi[sel], xi[sel]] = tgt * (1.0 - alpha) + blk * alpha


FONT = {
    'A': ["01110", "10001", "10001", "11111", "10001", "10001", "10001"],
    'C': ["01110", "10001", "10000", "10000", "10000", "10001", "01110"],
    'E': ["11111", "10000", "10000", "11110", "10000", "10000", "11111"],
    'H': ["10001", "10001", "10001", "11111", "10001", "10001", "10001"],
    'L': ["10000", "10000", "10000", "10000", "10000", "10000", "11111"],
    'M': ["10001", "11011", "10101", "10101", "10001", "10001", "10001"],
    'N': ["10001", "11001", "10101", "10011", "10001", "10001", "10001"],
    'O': ["01110", "10001", "10001", "10001", "10001", "10001", "01110"],
    'P': ["11110", "10001", "10001", "11110", "10000", "10000", "10000"],
    'R': ["11110", "10001", "10001", "11110", "10100", "10010", "10001"],
    'S': ["01111", "10000", "10000", "01110", "00001", "00001", "11110"],
    'T': ["11111", "00100", "00100", "00100", "00100", "00100", "00100"],
    'U': ["10001", "10001", "10001", "10001", "10001", "10001", "01110"],
    'W': ["10001", "10001", "10001", "10101", "10101", "11011", "10001"],
    'Y': ["10001", "10001", "01010", "00100", "00100", "00100", "00100"],
    ' ': ["00000"] * 7,
    '-': ["00000", "00000", "00000", "11111", "00000", "00000", "00000"],
}


def draw_text(a, text, x, y, scale, color, alpha=1.0):
    cx = x
    for ch in text.upper():
        glyph = FONT.get(ch)
        if glyph:
            for r, row in enumerate(glyph):
                for c, bit in enumerate(row):
                    if bit == '1':
                        fill_rect(a, cx + c * scale, y + r * scale,
                                  cx + (c + 1) * scale, y + (r + 1) * scale,
                                  color, alpha)
        cx += 6 * scale


def height_to_normal(hmap, strength=2.2):
    dx = np.zeros_like(hmap)
    dy = np.zeros_like(hmap)
    dx[:, 1:-1] = (hmap[:, 2:] - hmap[:, :-2]) * 0.5
    dy[1:-1, :] = (hmap[2:, :] - hmap[:-2, :]) * 0.5
    n = np.stack([-dx * strength, -dy * strength, np.ones_like(hmap)], axis=-1)
    ln = np.linalg.norm(n, axis=-1, keepdims=True)
    n = n / np.maximum(ln, 1e-6)
    return (n * 0.5 + 0.5).astype(F32)


def rgba(rgb, alpha=None, h=4, w=4):
    if isinstance(rgb, (list, tuple)):
        rgb = np.asarray(rgb, F32)
    arr = np.empty((h, w, 4), F32)
    arr[..., :3] = rgb
    arr[..., 3] = 1.0 if alpha is None else alpha
    return arr


# ----------------------------------------------------------------------------
# individual textures (all return RGBA float 0..1, seamless)
# ----------------------------------------------------------------------------

def tex_wood(size=512, seed=1, base=(0.78, 0.63, 0.42), contrast=0.30):
    h = w = size
    yy, xx = np.mgrid[0:h, 0:w].astype(F32)
    warp = fbm(h, w, (3, 6), seed, 4)
    ring = np.sin(yy * 0.16 + warp * 9.0) * 0.5 + 0.5
    ring = ring ** 1.4
    streak = fbm(h, w, (2, 90), seed + 3, 3)
    fine = vnoise(h, w, (60, 60), seed + 7, 3)
    v = (1.0 - contrast) + contrast * (0.55 * ring + 0.30 * streak + 0.15 * fine)
    col = np.asarray(base, F32)[None, None, :] * v[..., None]
    knots = np.zeros((h, w), bool)
    rng = np.random.default_rng(seed + 11)
    for _ in range(4):
        kx, ky = rng.integers(0, w), rng.integers(0, h)
        d = ((np.arange(w)[None, :] - kx) ** 2 + (np.arange(h)[:, None] - ky) ** 2) ** 0.5
        knots |= d < 6
    col[knots] *= 0.55
    return np.clip(np.concatenate([col, np.ones((h, w, 1), F32)], -1), 0, 1)


def tex_osb(size=512, seed=2):
    h = w = size
    rng = np.random.default_rng(seed)
    base = np.zeros((h, w, 3), F32)
    base[:] = (0.74, 0.64, 0.46)
    base += (fbm(h, w, 6, seed, 4)[..., None] - 0.5) * 0.14
    for _ in range(2400):
        cx, cy = rng.uniform(0, w), rng.uniform(0, h)
        rx = rng.uniform(9, 34)
        ry = rng.uniform(3.5, 11)
        ang = rng.uniform(0, math.pi)
        tone = rng.uniform(0.72, 1.12)
        col = np.array([0.76 * tone, 0.64 * tone, 0.44 * tone], F32)
        col *= rng.uniform(0.92, 1.05)
        fill_ellipse_arr(base, cx, cy, rx, ry, col, ang)
    speck = vnoise(h, w, 140, seed + 5, 2)
    base += (speck[..., None] - 0.5) * 0.10
    out = np.clip(np.concatenate([base, np.ones((h, w, 1), F32)], -1), 0, 1)
    return out


def fill_ellipse_arr(arr, cx, cy, rx, ry, color, angle=0.0):
    h, w = arr.shape[:2]
    reach = int(math.ceil(max(rx, ry))) + 2
    xs = np.arange(int(cx) - reach, int(cx) + reach + 1)
    ys = np.arange(int(cy) - reach, int(cy) + reach + 1)
    X, Y = np.meshgrid(xs, ys)
    dx, dy = X - cx, Y - cy
    ca, sa = math.cos(angle), math.sin(angle)
    xr = dx * ca + dy * sa
    yr = -dx * sa + dy * ca
    m = (xr / max(rx, 1e-3)) ** 2 + (yr / max(ry, 1e-3)) ** 2 <= 1.0
    if not m.any():
        return
    xi = np.mod(X, w)
    yi = np.mod(Y, h)
    arr[yi[m], xi[m]] = color


def tex_wrap(size=512, seed=3):
    h = w = size
    rng = np.random.default_rng(seed)
    col = np.zeros((h, w, 3), F32)
    col[:] = (0.93, 0.93, 0.92)
    col += (fbm(h, w, 10, seed, 4)[..., None] - 0.5) * 0.07
    # red printed stripes
    fill_rect(col, 0, int(h * 0.06), w, int(h * 0.06) + 4, (0.72, 0.12, 0.14))
    fill_rect(col, 0, int(h * 0.56), w, int(h * 0.56) + 4, (0.72, 0.12, 0.14))
    # repeating brand logo rows
    blue = (0.13, 0.22, 0.42)
    grey = (0.42, 0.44, 0.47)
    rows = [(0, 1.0), (int(h * 0.30), 1.0), (int(h * 0.68), 1.0)]
    for ry, sc in rows:
        s = max(1, size // 160)
        xoff = 6
        while xoff < w + 80:
            draw_text(col, "TOLLENSCAR", xoff, ry + 6, s, blue)
            draw_text(col, "HOMEWRAP", xoff + 66 * s, ry + 8, s - 1 if s > 1 else 1, grey)
            xoff += 150 * s
    # tiny printed dashes
    for _ in range(60):
        x = rng.integers(0, w)
        y = rng.integers(0, h)
        fill_rect(col, x, y, x + rng.integers(6, 22), y + 2, (0.5, 0.52, 0.55), 0.55)
    alpha = np.ones((h, w, 1), F32)
    return np.clip(np.concatenate([col, alpha], -1), 0, 1)


def tex_siding(size=1024, seed=4):
    h = w = size
    boards = 8
    bh = h // boards
    col = np.zeros((h, w, 3), F32)
    rng = np.random.default_rng(seed)
    for b in range(boards):
        y0, y1 = b * bh, (b + 1) * bh
        tone = 0.905 + rng.uniform(-0.02, 0.02)
        col[y0:y1, :] = (tone, tone * 0.995, tone * 0.975)
        # seam shadow at bottom of each board
        col[y1 - 3:y1, :] *= 0.55
        col[y1 - 6:y1 - 3, :] *= 0.80
        col[y0:y0 + 2, :] = np.minimum(col[y0:y0 + 2, :] + 0.05, 1.0)
    grain = fbm(h, w, (10, 3), seed + 2, 4)
    col *= (0.94 + 0.10 * grain)[..., None]
    fine = vnoise(h, w, (4, 220), seed + 5, 2)
    col *= (0.97 + 0.05 * fine)[..., None]
    out = np.clip(np.concatenate([col, np.ones((h, w, 1), F32)], -1), 0, 1)
    return out


def tex_shingle(size=1024, seed=5):
    h = w = size
    rng = np.random.default_rng(seed)
    col = np.zeros((h, w, 3), F32)
    col[:] = (0.16, 0.165, 0.175)
    rows = 16
    rh = h // rows
    for r in range(rows):
        y0 = r * rh
        x = -rng.integers(0, 90)
        while x < w + 60:
            tw = rng.integers(52, 150)
            base = rng.uniform(0.11, 0.30)
            tint = rng.uniform(-0.012, 0.016)
            c = np.array([base + tint * 0.5, base + tint * 0.2, base * 1.02 + tint], F32)
            x0 = max(x, 0)
            x1 = min(x + tw, w)
            if x1 > x0:
                seg = col[y0:min(y0 + rh, h), x0:x1]
                seg[:] = c
                hh = seg.shape[0]
                grad = np.linspace(1.14, 0.92, hh, dtype=F32)[:, None, None]
                seg *= grad
                seg[:2, :] *= 0.55
                seg[-3:-1, :] *= 0.78
            x += tw
        # row shadow line
        col[y0:y0 + 3, :] *= 0.5
    gran = vnoise(h, w, 260, seed + 4, 2)
    col *= (0.86 + 0.30 * gran)[..., None]
    wear = fbm(h, w, 7, seed + 9, 3)
    col *= (0.92 + 0.16 * wear)[..., None]
    out = np.clip(np.concatenate([col, np.ones((h, w, 1), F32)], -1), 0, 1)
    return out


def tex_felt(size=512, seed=6):
    h = w = size
    col = np.zeros((h, w, 3), F32)
    col[:] = (0.15, 0.15, 0.16)
    col += (fbm(h, w, 14, seed, 4)[..., None] - 0.5) * 0.10
    for y in range(0, h, 84):
        col[y:y + 3, :] *= 0.55
    for y in range(40, h, 84):
        col[y, :] = (0.30, 0.32, 0.36)
    for x in range(0, w, 64):
        for y in range(0, h, 16):
            col[y:y + 6, x:x + 2] = (0.33, 0.35, 0.40)
    out = np.clip(np.concatenate([col, np.ones((h, w, 1), F32)], -1), 0, 1)
    return out


def tex_concrete(size=512, seed=7):
    h = w = size
    rng = np.random.default_rng(seed)
    col = np.zeros((h, w, 3), F32)
    col[:] = (0.60, 0.595, 0.575)
    col += (fbm(h, w, 5, seed, 5)[..., None] - 0.5) * 0.16
    speck = vnoise(h, w, 200, seed + 3, 2)
    col += (speck[..., None] - 0.5) * 0.09
    # hairline cracks
    for _ in range(5):
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        ang = rng.uniform(0, 2 * math.pi)
        for _ in range(70):
            fill_rect(col, x, y, x + 1.5, y + 1.5, (0.34, 0.34, 0.33), 0.45)
            ang += rng.normal(0, 0.5)
            x += math.cos(ang) * 3
            y += math.sin(ang) * 3
    out = np.clip(np.concatenate([col, np.ones((h, w, 1), F32)], -1), 0, 1)
    return out


def tex_stone(size=1024, seed=8):
    h = w = size
    rng = np.random.default_rng(seed)
    palette = [
        (0.56, 0.53, 0.49), (0.66, 0.62, 0.55), (0.48, 0.46, 0.44),
        (0.71, 0.67, 0.58), (0.58, 0.55, 0.50), (0.42, 0.41, 0.40),
        (0.68, 0.64, 0.60), (0.52, 0.48, 0.42),
    ]
    n_seed = 132
    pts = []
    cols = []
    gw = int(math.sqrt(n_seed * w / h))
    gh = max(1, n_seed // gw)
    for gy in range(gh):
        for gx in range(gw):
            px = (gx + rng.uniform(0.2, 0.8)) * w / gw
            py = (gy + rng.uniform(0.2, 0.8)) * h / gh
            px = px % w
            py = py % h
            pts.append((px, py))
            cols.append(np.array(palette[rng.integers(0, len(palette))], F32)
                        * rng.uniform(0.86, 1.12))
    d1 = np.full((h, w), 1e18, F32)
    d2 = np.full((h, w), 1e18, F32)
    idx = np.zeros((h, w), np.int32)
    X = np.arange(w, dtype=F32)[None, :]
    Y = np.arange(h, dtype=F32)[:, None]
    # wrap-aware distance (tileable): try 3x3 shifts cheaply via mod distances
    for i, (px, py) in enumerate(pts):
        ddx = np.abs(X - px)
        ddx = np.minimum(ddx, w - ddx)
        ddy = np.abs(Y - py)
        ddy = np.minimum(ddy, h - ddy)
        d = ddx * ddx + ddy * ddy
        closer = d < d1
        idx = np.where(closer, i, idx)
        d2 = np.where(closer, d1, np.minimum(d2, d))
        d1 = np.where(closer, d, d1)
    f1 = np.sqrt(np.maximum(d1, 0))
    f2 = np.sqrt(np.maximum(d2, 0))
    stone_idx = idx
    mortar = (f2 - f1) < 26.0
    col = np.zeros((h, w, 3), F32)
    for i, c in enumerate(cols):
        col[stone_idx == i] = c
    rock_n = fbm(h, w, 26, seed + 5, 5)
    col *= (0.80 + 0.34 * rock_n)[..., None]
    edge_k = np.clip((f2 - f1) / 26.0, 0, 1)
    col *= (0.62 + 0.38 * edge_k)[..., None]
    col[mortar] = (0.62, 0.60, 0.56) * (0.85 + 0.25 * rock_n[mortar][:, None])
    hmap = np.where(mortar, 0.25, 0.75) + rock_n * 0.25
    col = np.clip(col, 0, 1)
    out = np.clip(np.concatenate([col, np.ones((h, w, 1), F32)], -1), 0, 1)
    return out, hmap.astype(F32)


def tex_grass(size=1024, seed=9):
    h = w = size
    big = fbm(h, w, 5, seed, 4)
    col = np.zeros((h, w, 3), F32)
    dark = np.array([0.13, 0.26, 0.09], F32)
    lite = np.array([0.33, 0.47, 0.15], F32)
    col[:] = dark
    col += (lite - dark)[None, None, :] * big[..., None]
    blades = vnoise(h, w, (110, 14), seed + 4, 3)
    col *= (0.78 + 0.44 * blades)[..., None]
    dry = fbm(h, w, 7, seed + 8, 3)
    dry_m = np.clip((dry - 0.60) * 4.0, 0, 1)[..., None]
    col = col * (1 - dry_m) + np.array([0.48, 0.45, 0.20], F32) * dry_m
    shadow = fbm(h, w, 16, seed + 12, 3)
    col *= (0.86 + 0.28 * shadow)[..., None]
    out = np.clip(np.concatenate([col, np.ones((h, w, 1), F32)], -1), 0, 1)
    return out


def tex_dirt(size=1024, seed=10):
    h = w = size
    rng = np.random.default_rng(seed)
    big = fbm(h, w, 4, seed, 5)
    c0 = np.array([0.34, 0.26, 0.185], F32)
    c1 = np.array([0.55, 0.45, 0.33], F32)
    col = c0[None, None, :] + (c1 - c0)[None, None, :] * big[..., None]
    med = fbm(h, w, 13, seed + 3, 4)
    col *= (0.86 + 0.30 * med)[..., None]
    grit = vnoise(h, w, 300, seed + 6, 2)
    col *= (0.90 + 0.22 * grit)[..., None]
    # scattered pebbles
    for _ in range(500):
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        r = rng.uniform(1.2, 4.0)
        fill_ellipse_arr(col, x, y, r, r * 0.8,
                         np.array([0.55, 0.52, 0.47], F32) * rng.uniform(0.7, 1.15))
    # soft tyre ruts
    for k in range(3):
        y_base = rng.uniform(0.15, 0.85) * h
        amp = rng.uniform(8, 26)
        phase = rng.uniform(0, 6.28)
        xs = np.arange(w, dtype=F32)
        y_line = y_base + np.sin(xs / w * math.pi * (1.2 + k * 0.4) + phase) * amp
        Yc = np.arange(h)[:, None]
        band = np.abs(Yc - y_line[None, :]) < 9
        col[band] *= 0.80
    out = np.clip(np.concatenate([col, np.ones((h, w, 1), F32)], -1), 0, 1)
    return out


def tex_gravel(size=512, seed=11):
    h = w = size
    rng = np.random.default_rng(seed)
    col = np.zeros((h, w, 3), F32)
    col[:] = (0.50, 0.48, 0.45)
    col += (fbm(h, w, 9, seed, 4)[..., None] - 0.5) * 0.14
    for _ in range(2600):
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        r = rng.uniform(2.0, 6.5)
        g = rng.uniform(0.42, 0.80)
        c = np.array([g, g * 0.98, g * 0.93], F32) * rng.uniform(0.9, 1.1)
        fill_ellipse_arr(col, x, y, r, r * rng.uniform(0.7, 1.1), c,
                         rng.uniform(0, 3.14))
    out = np.clip(np.concatenate([col, np.ones((h, w, 1), F32)], -1), 0, 1)
    return out


def tex_bark(size=512, seed=12):
    h = w = size
    warp = fbm(h, w, (4, 3), seed, 4)
    xx = np.arange(w, dtype=F32)[None, :]
    fur = np.sin(xx * 0.22 + warp * 14.0) * 0.5 + 0.5
    base = np.zeros((h, w, 3), F32)
    c0 = np.array([0.24, 0.19, 0.145], F32)
    c1 = np.array([0.46, 0.39, 0.31], F32)
    base[:] = c0
    base += (c1 - c0)[None, None, :] * (fur ** 1.6)[..., None]
    fine = vnoise(h, w, (8, 60), seed + 3, 3)
    base *= (0.85 + 0.30 * fine)[..., None]
    out = np.clip(np.concatenate([base, np.ones((h, w, 1), F32)], -1), 0, 1)
    return out


def tex_leaf(size=512, seed=13):
    h = w = size
    rng = np.random.default_rng(seed)
    col = np.zeros((h, w, 4), F32)
    greens = [
        (0.20, 0.34, 0.11), (0.30, 0.44, 0.14), (0.40, 0.50, 0.16),
        (0.52, 0.53, 0.17), (0.16, 0.28, 0.10),
    ]
    for _ in range(3400):
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        r = rng.uniform(3.0, 9.0)
        c = np.array(greens[rng.integers(0, len(greens))], F32) * rng.uniform(0.8, 1.2)
        c = np.clip(c, 0, 1)
        ca = math.cos(rng.uniform(0, 3.14))
        fill_ellipse_arr(col[..., :3], x, y, r, r * rng.uniform(0.5, 0.9), c, ca)
        fill_ellipse_arr(col[..., 3:4], x, y, r, r * rng.uniform(0.5, 0.9),
                         np.ones(1, F32), ca)
    sh = fbm(h, w, 9, seed + 2, 4)
    col[..., :3] *= (0.80 + 0.40 * sh)[..., None]
    col[..., :3] = np.clip(col[..., :3], 0, 1)
    # ragged alpha edges
    al = vnoise(h, w, 70, seed + 5, 2)
    col[..., 3] = np.where(col[..., 3] > 0.5, np.where(al > 0.34, 1.0, 0.0), 0.0)
    return np.clip(col, 0, 1)


def tex_mulch(size=512, seed=14):
    h = w = size
    rng = np.random.default_rng(seed)
    col = np.zeros((h, w, 3), F32)
    col[:] = (0.15, 0.105, 0.075)
    for _ in range(2400):
        x, y = rng.uniform(0, w), rng.uniform(0, h)
        rw = rng.uniform(3, 11)
        rh = rng.uniform(1.5, 4)
        g = rng.uniform(0.55, 1.5)
        c = np.array([0.24 * g, 0.16 * g, 0.10 * g], F32)
        fill_ellipse_arr(col, x, y, rw, rh, np.clip(c, 0, 1),
                         rng.uniform(0, 3.14))
    out = np.clip(np.concatenate([col, np.ones((h, w, 1), F32)], -1), 0, 1)
    return out
