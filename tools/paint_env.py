#!/usr/bin/env python3
"""Environment painter v4 — Octopath-style HD-2D backdrops (painterly light,
layered silhouettes, baked bloom) fused with Dead Cells-style chunky tilework
(dark silhouette outlines, rim light, dithered noise textures).
Outputs: assets/tiles.png (3 biome rows x 9 cells @40px), assets/bg_*.png."""
import zlib, struct, math, sys

# ---------------- noise kit ----------------
def h2(x, y, s):
    n = (x * 374761393 + y * 668265263 + s * 1446648621) & 0x7fffffff
    n = (n ^ (n >> 13)) * 1274126177 & 0x7fffffff
    return ((n ^ (n >> 16)) & 0xffff) / 65535.0

def vnoise(x, y, s):
    xi, yi = int(math.floor(x)), int(math.floor(y))
    xf, yf = x - xi, y - yi
    u, v = xf * xf * (3 - 2 * xf), yf * yf * (3 - 2 * yf)
    a, b = h2(xi, yi, s), h2(xi + 1, yi, s)
    c, d = h2(xi, yi + 1, s), h2(xi + 1, yi + 1, s)
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v

def fbm(x, y, s, o=4):
    t, amp, f = 0.0, 0.5, 1.0
    for i in range(o):
        t += amp * vnoise(x * f, y * f, s + i * 7)
        amp *= 0.5; f *= 2.0
    return t

BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]

def mix(c0, c1, t):
    t = max(0.0, min(1.0, t))
    return tuple(int(c0[i] + (c1[i] - c0[i]) * t) for i in range(3))

def ramp(pal, t, x, y):
    t = max(0.0, min(0.999, t + (BAYER[y & 3][x & 3] / 16.0 - 0.5) * 0.09))
    i = int(t * (len(pal) - 1))
    return mix(pal[i], pal[min(i + 1, len(pal) - 1)], t * (len(pal) - 1) - i)

class CV:
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.px = [[(0, 0, 0, 255)] * w for _ in range(h)]
    def set(s, x, y, c, a=1.0):
        x, y = int(x), int(y)
        if 0 <= x < s.w and 0 <= y < s.h:
            if a >= 1.0:
                s.px[y][x] = (c[0], c[1], c[2], 255)
            else:
                o = s.px[y][x]
                r = tuple(int(o[i] * (1 - a) + c[i] * a) for i in range(3))
                s.px[y][x] = (r[0], r[1], r[2], 255)

def seamless(cv, F=120):
    """crossfade right edge into left so the panorama tiles without a seam"""
    for x in range(BW - F, BW):
        a = (x - (BW - F)) / float(F)
        for y in range(BH):
            c0 = cv.px[y][x]; c1 = cv.px[y][x - (BW - F)]
            cv.px[y][x] = (int(c0[0] * (1 - a) + c1[0] * a),
                           int(c0[1] * (1 - a) + c1[1] * a),
                           int(c0[2] * (1 - a) + c1[2] * a), 255)

def write_png(path, cv, alpha=False):
    raw = bytearray()
    for y in range(cv.h):
        raw.append(0)
        row = cv.px[y]
        for x in range(cv.w):
            c = row[x]
            raw += bytes(c[:3])
            raw.append(c[3] if len(c) == 4 else 255)
    raw = bytes(raw)
    def chunk(t, d):
        cc = struct.pack(">I", len(d)) + t + d
        return cc + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", cv.w, cv.h, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 6))
    png += chunk(b"IEND", b"")
    open(path, "wb").write(png)
    print("wrote", path, cv.w, "x", cv.h)

# tileset needs true alpha: separate lightweight canvas
class AV:
    def __init__(s, w, h):
        s.w, s.h = w, h
        s.px = [[(0, 0, 0, 0)] * w for _ in range(h)]
    def set(s, x, y, c):
        x, y = int(x), int(y)
        if 0 <= x < s.w and 0 <= y < s.h:
            s.px[y][x] = (c[0], c[1], c[2], 255)
    def blend(s, x, y, c, a):
        x, y = int(x), int(y)
        if 0 <= x < s.w and 0 <= y < s.h:
            o = s.px[y][x]
            a2 = a * (1 - o[3] / 255.0) + o[3] / 255.0 * 0
            r = tuple(int(o[i] * (1 - a2) + c[i] * a2) for i in range(3))
            s.px[y][x] = (r[0], r[1], r[2], max(o[3], int(a * 255)))

# ---------------- palettes ----------------
RUINS_PAL = [(30, 24, 48), (52, 40, 74), (74, 58, 102), (98, 78, 128)]
CAVES_PAL = [(14, 10, 24), (30, 20, 46), (46, 32, 68), (66, 48, 94)]
SKY_PAL   = [(52, 60, 104), (74, 84, 134), (100, 112, 164), (130, 142, 194)]
OUTLINE = (12, 9, 18)

# ---------------- tile cells ----------------
T = 40
def cell_base(cv, ox, oy, z, variant):
    for y in range(T):
        for x in range(T):
            gx, gy = x + variant * 13, y
            if z == 0:  # ruins: weathered brick
                n = fbm(gx * 0.09, gy * 0.09, 11 + variant)
                row = gy // 10
                off = 10 if row % 2 else 0
                mortar = (gy % 10 == 0) or ((gx + off) % 20 == 0)
                t = n * 0.85 + (0.2 if not mortar else -0.2)
                c = ramp(RUINS_PAL, t, x, y)
                if h2(gx, gy, 5) < 0.05: c = mix(c, OUTLINE, 0.5)
                if h2(gx, gy, 6) < 0.04: c = mix(c, (63, 174, 140), 0.4)
            elif z == 1:  # caves: rugged rock + sparse crystal veins
                n = fbm(gx * 0.11, gy * 0.11, 21 + variant, 5)
                ridge = abs(fbm(gx * 0.06, gy * 0.06, 31) - 0.5)
                t = n * 0.95 - 0.05
                c = ramp(CAVES_PAL, t, x, y)
                if ridge < 0.012 and n > 0.5: c = mix(c, (176, 109, 240), 0.75)
                if h2(gx, gy, 7) < 0.04: c = mix(c, (0, 0, 0), 0.5)
            else:  # sky: pale marble + gold inlay
                n = fbm(gx * 0.07, gy * 0.13, 41 + variant)
                t = n * 0.7 + 0.3
                c = ramp(SKY_PAL, t, x, y)
                if gy % 20 == 0 or (gy % 20 == 1 and h2(gx, gy, 8) < 0.6):
                    c = mix(c, (216, 176, 106), 0.6)
                if h2(gx, gy, 9) < 0.02: c = (235, 240, 255)
            cv.set(ox + x, oy + y, c)

def cell_top(cv, ox, oy, z, variant):
    for x in range(T):
        hgt = 4 + int(fbm(x * 0.2, variant * 9, 51 + z) * 6)
        for y in range(hgt):
            t = 1 - y / 8.0
            if z == 0:
                c = mix((43, 122, 99), (111, 214, 168), t)
                if h2(x, variant, 12) < 0.07 and y < 2: c = (255, 182, 213)
                if h2(x, variant, 13) < 0.06 and y < 2: c = (255, 244, 214)
            elif z == 1:
                c = mix((46, 32, 68), (122, 79, 192), t)
            else:
                c = mix((159, 180, 255), (255, 255, 255), t)
            cv.set(ox + x, oy + y, c)
        if z == 0:  # grass blades above the cap
            if h2(x, variant, 16) < 0.4:
                bl = 2 + int(h2(x, variant, 17) * 4)
                for y in range(bl):
                    cv.set(ox + x + (1 if y > bl - 2 else 0), oy - 0, (111, 214, 168)) if False else None
        if z == 1 and variant == 1:  # crystal cluster
            for cx0, ch in ((8, 14), (18, 20), (28, 10)):
                for y in range(ch):
                    cc = (220, 190, 255) if y > ch - 4 else (176, 109, 240)
                    cv.set(ox + cx0, oy + max(0, 6 - y + 4), cc)
                    cv.set(ox + cx0 + 1, oy + max(0, 6 - y + 4), cc)

def cell_side(cv, ox, oy, z, side):
    for y in range(T):
        n = fbm(y * 0.15, side * 3, 61 + z)
        cv.set(ox + (0 if side == 0 else T - 1), oy + y, OUTLINE)
        cv.set(ox + (1 if side == 0 else T - 2), oy + y, mix((111, 90, 168), (255, 255, 255), 0.15 + n * 0.25))
        cv.set(ox + (2 if side == 0 else T - 3), oy + y, mix((111, 90, 168), (0, 0, 0), 0.4))

def cell_bottom(cv, ox, oy, z):
    for y in range(6):
        a = (1 - y / 6.0) * 0.55
        for x in range(T):
            o = cv.px[oy + y][ox + x]
            r = tuple(int(o[i] * (1 - a)) for i in range(3))
            cv.px[oy + y][ox + x] = (r[0], r[1], r[2], o[3])
    for x in range(T):
        if h2(x, z, 14) < 0.12:
            ln = 3 + int(h2(x, z, 15) * 6)
            for y in range(ln):
                cv.set(ox + x, oy + 5 + y, mix((43, 33, 62), (0, 0, 0), 0.4))

def cell_oneway(cv, ox, oy, z):
    for y in range(12):
        for x in range(T):
            if y == 0: c = (255, 255, 255)
            elif y < 3: c = [(111, 90, 168), (122, 79, 192), (216, 176, 106)][z]
            elif y < 8:
                pal = RUINS_PAL if z == 0 else (CAVES_PAL if z == 1 else SKY_PAL)
                c = ramp(pal, 0.45 + fbm(x * 0.2, y, 71) * 0.4, x, y)
            else: c = mix(OUTLINE, (60, 48, 90), 0.4)
            cv.set(ox + x, oy + y, c)
    for bx in (4, T - 7):
        for y in range(12, 18):
            cv.set(ox + bx + (1 if y > 14 else 0), oy + y, mix(OUTLINE, (90, 74, 130), 0.35))
            cv.set(ox + bx + 1 + (1 if y > 14 else 0), oy + y, mix(OUTLINE, (90, 74, 130), 0.35))

def build_tiles():
    cv = AV(T * 9, T * 3)
    for z in range(3):
        oy = z * T
        for v in range(3): cell_base(cv, v * T, oy, z, v)
        cell_top(cv, 3 * T, oy, z, 0)
        cell_top(cv, 4 * T, oy, z, 1)
        cell_side(cv, 5 * T, oy, z, 0)
        cell_side(cv, 6 * T, oy, z, 1)
        cell_bottom(cv, 7 * T, oy, z)
        cell_oneway(cv, 8 * T, oy, z)
    write_png("assets/tiles.png", cv)

# ---------------- backdrops (HD-2D) ----------------
BW, BH = 1000, 562

def vgrad(cv, stops):
    for y in range(BH):
        t = y / (BH - 1) * (len(stops) - 1)
        i = min(int(t), len(stops) - 2)
        c = mix(stops[i], stops[i + 1], t - i)
        for x in range(BW): cv.set(x, y, c)

def glow_dot(cv, x, y, r, c, a):
    for dy in range(-r, r + 1):
        for dx in range(-r, r + 1):
            d = math.hypot(dx, dy) / r
            if d <= 1: cv.set(x + dx, y + dy, c, a * (1 - d) ** 2)

def ridge_layer(cv, base_h, amp, seed, col, rim=None, rim_a=0.8, jag=0.006):
    """mountain/silhouette ridge, opaque to bottom"""
    for x in range(BW):
        hgt = base_h + fbm(x * jag, 0.7, seed, 4) * amp + vnoise(x * 0.05, 0, seed) * amp * 0.25
        top = int(BH - hgt)
        if rim: cv.set(x, top, rim, rim_a)
        for y in range(top + 1, BH): cv.set(x, y, col)

def bg_ruins():
    cv = CV(BW, BH)
    vgrad(cv, [(20, 12, 44), (58, 28, 66), (122, 62, 84), (196, 110, 92)])
    # low dusk sun + baked bloom + horizon band
    glow_dot(cv, 640, 400, 190, (255, 170, 120), 0.5)
    glow_dot(cv, 640, 400, 80, (255, 224, 180), 0.75)
    cv.set(640, 400, (255, 246, 224))
    for x in range(BW):  # horizon haze
        cv.set(x, 402, (255, 190, 140), 0.35); cv.set(x, 403, (255, 190, 140), 0.2)
    # far + near mountains
    ridge_layer(cv, 190, 90, 91, (86, 48, 92), rim=(255, 170, 130), rim_a=0.5, jag=0.004)
    ridge_layer(cv, 140, 70, 92, (58, 32, 70), rim=(255, 150, 120), rim_a=0.6, jag=0.006)
    # cathedral ruins mid-layer: arches, broken columns, rose window
    for ax in (60, 330, 620, 860):
        w = 150 + int(h2(ax, 1, 93) * 60); hgt = 220 + int(h2(ax, 2, 93) * 120)
        cx = ax + w // 2
        for x in range(ax, min(ax + w, BW)):
            t = (x - ax) / w
            top = BH - hgt - int(math.sin(t * math.pi) * 90)
            for y in range(top, BH): cv.set(x, y, (40, 24, 56))
            cv.set(x, top, (255, 170, 130), 0.7)
        # rose window glow in the arch
        glow_dot(cv, cx, BH - hgt - 40, 26, (255, 190, 140), 0.5)
        for dy in range(-14, 15):
            for dx in range(-14, 15):
                if 12 < math.hypot(dx, dy) < 15 or abs(dx) < 2 or abs(dy) < 2:
                    cv.set(cx + dx, BH - hgt - 40 + dy, (30, 18, 44))
    for cxp in (250, 540, 800):  # broken columns
        hgt = 150 + int(h2(cxp, 3, 94) * 90)
        for y in range(BH - hgt, BH):
            for x in range(cxp, cxp + 22): cv.set(x, y, (44, 26, 60))
            cv.set(cxp, y, (255, 170, 130), 0.45)
        for x in range(cxp, cxp + 22):  # jagged broken top
            cv.set(x, BH - hgt - int(h2(x, 4, 94) * 8), (44, 26, 60))
    # god rays from top-left
    for i in range(5):
        x0 = 60 + i * 190
        for y in range(0, 420, 2):
            xx = x0 + y * 0.5; wdt = 18 + y * 0.10
            for x in range(int(xx), int(xx + wdt), 2):
                cv.set(x, y, (255, 200, 160), 0.045)
    # foreground grass band
    for x in range(BW):
        hgt = 26 + int(fbm(x * 0.02, 3, 95) * 18)
        for y in range(BH - hgt, BH): cv.set(x, y, (24, 14, 34))
        if h2(x, 1, 96) < 0.5:
            bl = 4 + int(h2(x, 2, 96) * 8)
            for y in range(bl): cv.set(x + (1 if y > bl - 3 else 0), BH - hgt - y, (34, 20, 44))
        if h2(x, 3, 96) < 0.05: cv.set(x, BH - hgt - 6, (255, 182, 213))
    # birds near the sun
    for bx, by in ((560, 250), (600, 235), (700, 270)):
        cv.set(bx, by, (30, 18, 40)); cv.set(bx - 2, by - 1, (30, 18, 40)); cv.set(bx + 2, by - 1, (30, 18, 40))
    seamless(cv)
    write_png("assets/bg_ruins.png", cv)

def bg_caves():
    cv = CV(BW, BH)
    vgrad(cv, [(6, 4, 14), (16, 10, 30), (30, 18, 48)])
    # cavern walls left/right + ceiling
    for y in range(BH):
        wl = int(fbm(y * 0.01, 0, 101) * 130 + 40)
        for x in range(wl):
            cv.set(x, y, mix((18, 12, 30), (34, 22, 52), x / wl))
        wr = int(fbm(y * 0.01, 5, 102) * 130 + 40)
        for x in range(BW - wr, BW):
            cv.set(x, y, mix((34, 22, 52), (18, 12, 30), (x - (BW - wr)) / wr))
        cv.set(wl, y, (122, 79, 192), 0.35); cv.set(BW - wr - 1, y, (122, 79, 192), 0.35)
    for x in range(BW):
        hgt = int(60 + fbm(x * 0.008, 1, 103) * 90)
        for y in range(hgt): cv.set(x, y, (14, 9, 26))
        ln = 10 + int(h2(x, 1, 104) * 50)
        for y in range(hgt, hgt + ln):  # stalactites
            if h2(x, 2, 104) < 0.5: cv.set(x, y, (14, 9, 26))
        cv.set(x, hgt, (122, 79, 192), 0.3)
    # giant background crystals (soft)
    for gx, gy, gr, gc in ((300, 300, 90, (63, 208, 164)), (700, 260, 110, (176, 109, 240)), (500, 420, 70, (126, 240, 224))):
        glow_dot(cv, gx, gy, gr, gc, 0.16)
        for k in range(4):
            ox = gx + (k - 2) * 18; ch = int(gr * (0.8 + h2(k, gx, 105) * 0.7))
            for yy in range(ch):
                wdt = max(1, int((1 - yy / ch) * 10))
                cv.set(ox, gy - yy, gc, 0.25)
                cv.set(ox + 1, gy - yy, gc, 0.2)
    # mid crystal clusters w/ bloom
    for i in range(16):
        x = int(80 + h2(i, 3, 106) * (BW - 160)); y = int(200 + h2(i, 4, 106) * 280)
        glow_dot(cv, x, y, 40, (176, 109, 240), 0.4)
        for k in range(3):
            ch = 14 + int(h2(i, k, 107) * 26); ox = x + (k - 1) * 8
            for yy in range(ch):
                wdt = max(1, int((1 - yy / ch) * 3))
                cc = (230, 210, 255) if yy > ch - 5 else (150, 90, 220)
                for x2 in range(ox - wdt, ox + wdt + 1): cv.set(x2, y - yy, cc)
    # underground lake
    for y in range(BH - 70, BH):
        t = (y - (BH - 70)) / 70.0
        for x in range(BW):
            w = fbm(x * 0.02, y * 0.08, 111)
            c = mix((20, 14, 40), (70, 44, 110), t * 0.5 + w * 0.3)
            if h2(x // 6, y, 112) < 0.05 and w > 0.55: c = mix(c, (190, 140, 255), 0.5)
            cv.set(x, y, c)
    cv.set(0, BH - 70, (190, 140, 255), 0.4)
    for x in range(BW): cv.set(x, BH - 70, (190, 140, 255), 0.35)
    for i in range(16):  # reflections
        x = int(80 + h2(i, 3, 106) * (BW - 160))
        for y in range(BH - 66, BH - 8, 4):
            cv.set(x + int(vnoise(y * 0.3, i, 5) * 10 - 5), y, (176, 109, 240), 0.3)
    # mist bands
    for yb in (300, 380, 460):
        for y in range(yb, yb + 26):
            a = 0.05 * math.sin((y - yb) / 26 * math.pi)
            for x in range(0, BW, 2): cv.set(x, y, (126, 240, 224), a)
    # spores
    for i in range(110):
        cv.set(int(h2(i, 5, 108) * BW), int(h2(i, 6, 108) * BH), (126, 240, 224), 0.8)
    seamless(cv)
    write_png("assets/bg_caves.png", cv)

def bg_sky():
    cv = CV(BW, BH)
    vgrad(cv, [(6, 8, 28), (16, 20, 52), (40, 48, 96), (70, 80, 140)])
    for i in range(240):
        x, y = int(h2(i, 1, 121) * BW), int(h2(i, 2, 121) * BH * 0.85)
        cv.set(x, y, (235, 240, 255) if i % 3 else (159, 180, 255), 0.5 + h2(i, 7, 121) * 0.5)
    for i in range(8):  # colored bright stars w/ cross glint
        x, y = int(h2(i, 8, 121) * BW), int(h2(i, 9, 121) * 300)
        glow_dot(cv, x, y, 6, (207, 216, 255), 0.5)
        cv.set(x, y, (255, 255, 255)); cv.set(x - 2, y, (255, 255, 255), 0.6); cv.set(x + 2, y, (255, 255, 255), 0.6)
        cv.set(x, y - 2, (255, 255, 255), 0.6); cv.set(x, y + 2, (255, 255, 255), 0.6)
    # moon + halo
    glow_dot(cv, 790, 120, 150, (207, 216, 255), 0.30)
    for dy in range(-56, 57):
        for dx in range(-56, 57):
            d = dx * dx + dy * dy
            if d <= 56 * 56:
                c = (244, 247, 255) if dx + dy < -12 else (214, 222, 248)
                if h2(dx, dy, 122) < 0.07: c = (184, 194, 228)
                cv.set(790 + dx, 120 + dy, c)
    # aurora ribbons
    for r in range(3):
        for x in range(BW):
            yb = 60 + r * 40 + int(fbm(x * 0.005, r, 131) * 70)
            hh = 60 + int(vnoise(x * 0.01, r, 132) * 40)
            for y in range(yb, yb + hh):
                t = 1 - (y - yb) / hh
                cv.set(x, y, (126, 240, 224) if r != 1 else (154, 127, 224), 0.10 * t)
    # far floating islands (lighter) then near (darker, rim-lit)
    for ix, iy, sc, near in ((150, 330, 1.5, 1), (480, 250, 1.0, 0), (830, 360, 1.2, 1), (650, 180, 0.6, 0)):
        body = (26, 22, 50) if near else (52, 58, 108)
        rimc = (207, 216, 255)
        rw = int(80 * sc); rh = int(34 * sc)
        for dy in range(rh):
            wdt = int((1 - dy / rh) ** 0.8 * rw)
            for dx in range(-wdt, wdt):
                cv.set(ix + dx, iy + dy, body)
        for dx in range(-rw, rw):
            n = fbm(dx * 0.08, iy, 151)
            cv.set(ix + dx, iy - 1 - int(n * 5), rimc, 0.8 if near else 0.5)
            cv.set(ix + dx, iy - 2 - int(n * 5), rimc, 0.4)
        if near:  # hanging roots + waterfall
            for dx in range(-rw // 2, rw // 2, 7):
                ln = int(h2(dx, ix, 152) * 26)
                for y in range(ln): cv.set(ix + dx, iy + rh + y, body)
            for y in range(iy + rh, min(iy + rh + 120, BH), 2):
                cv.set(ix + int(vnoise(y * 0.15, ix, 6) * 8), y, (159, 200, 255), 0.4)
    # cloud sea: 3 soft bands
    for band, (col, a0) in enumerate((((90, 100, 160), 0.5), ((120, 130, 190), 0.7), ((160, 170, 220), 0.9))):
        ybase = BH - 130 + band * 40
        for x in range(BW):
            top = ybase - int(fbm(x * 0.007, band * 3, 141) * 50)
            for y in range(top, BH):
                t = min(1.0, (y - top) / 30.0)
                cv.set(x, y, col, a0 * (0.4 + 0.6 * t))
        # puffs on the ridge
        for i in range(9):
            px = int(h2(i, band, 143) * BW); pr = 14 + int(h2(i, band + 1, 143) * 22)
            py = ybase - int(fbm(px * 0.007, band * 3, 141) * 50) - pr // 2
            for dy in range(-pr, pr + 1):
                for dx in range(-pr * 2, pr * 2 + 1):
                    if (dx / (pr * 2)) ** 2 + (dy / pr) ** 2 <= 1:
                        cv.set(px + dx, py + dy, mix(col, (255, 255, 255), 0.25), a0 * 0.5)
    # shooting star
    for i in range(26):
        cv.set(180 + i * 3, 90 + i, (255, 255, 255), 1 - i / 26.0)
    seamless(cv)
    write_png("assets/bg_sky.png", cv)

if __name__ == "__main__":
    build_tiles()
    bg_ruins()
    bg_caves()
    bg_sky()
