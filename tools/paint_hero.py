#!/usr/bin/env python3
"""Pixel-sprite painter v3 — tall & slender heroine per the MEMBRANE LAB sheet.
7.5-head proportions, long black hair, off-should black knit dress, glossy
thigh-high boots, choker, violet eyes. 9 frames, cell 53x121.
Frames: idle0 idle1(blink) run0..3 jump dash attack. Pure-python PNG writer."""
import zlib, struct, sys

W, H = 53, 121

# ---- palette v3 ----
HAIR  = ( 36, 29, 43); HAIR_L = ( 77, 63, 99); HAIR_S = (107, 90, 140); HAIR_D = (21, 16, 25)
SKIN  = (244, 214, 201); SKIN_S = (220, 180, 166); SKIN_L = (255, 233, 222)
DRESS = ( 32, 26, 38); DRESS_L = ( 51, 42, 61); DRESS_D = (18, 13, 22)
BOOT  = ( 25, 21, 33); BOOT_L = ( 62, 54, 80); BOOT_D = (12, 9, 18)
EYE   = (154, 127, 224); EYE_D = ( 74, 53, 133); EYE_W = (255, 255, 255)
LIP   = (201, 138, 138)
CHOKE = ( 20, 16, 26); RING = (216, 176, 106)
TRANS = (0, 0, 0, 0)

class C:
    def __init__(self): self.p = {}
    def set(self, x, y, c):
        x, y = int(round(x)), int(round(y))
        if 0 <= x < W and 0 <= y < H and c is not TRANS: self.p[(x, y)] = c
    def rect(self, x0, y0, x1, y1, c):
        for y in range(int(y0), int(y1) + 1):
            for x in range(int(x0), int(x1) + 1): self.set(x, y, c)
    def ell(self, cx, cy, rx, ry, c):
        for y in range(int(cy - ry), int(cy + ry) + 1):
            for x in range(int(cx - rx), int(cx + rx) + 1):
                if ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1.0: self.set(x, y, c)
    def line(self, x0, y0, x1, y1, c, w=1):
        x0, y0, x1, y1 = map(float, (x0, y0, x1, y1))
        n = int(max(abs(x1 - x0), abs(y1 - y0))) * 2 + 1
        for i in range(n + 1):
            t = i / n
            x, y = x0 + (x1 - x0) * t, y0 + (y1 - y0) * t
            if w == 1: self.set(x, y, c)
            else: self.rect(x - (w - 1) / 2, y - (w - 1) / 2, x + (w - 1) / 2, y + (w - 1) / 2, c)
    def trap(self, xt0, xt1, y0, xb0, xb1, y1, c):
        """trapezoid: top edge (xt0..xt1) at y0, bottom edge (xb0..xb1) at y1"""
        for y in range(int(y0), int(y1) + 1):
            t = (y - y0) / max(1, (y1 - y0))
            xa = xt0 + (xb0 - xt0) * t
            xb = xt1 + (xb1 - xt1) * t
            for x in range(int(round(xa)), int(round(xb)) + 1): self.set(x, y, c)

POSES = ["idle0", "idle1", "run0", "run1", "run2", "run3", "jump", "dash", "attack",
         "land", "wall", "hurt", "attack2", "attack3"]

def pose_data(name):
    d = dict(bob=0, lean=0, sway=0, skirt=0, blink=False, mouth="smile",
             legL=[(24, 58), (23, 84), (23, 112), -1], legR=[(29, 58), (30, 84), (30, 112), 1],
             armF=[(20, 26), (14, 33), (19, 41)], armB=[(33, 26), (35, 36), (33, 46)])
    if name == "idle1": d.update(blink=True, bob=1)
    elif name == "run0":
        d.update(mouth="o", legL=[(24, 58), (28, 82), (33, 108), 1], legR=[(29, 58), (25, 86), (19, 110), -1],
                 armF=[(20, 26), (16, 33), (20, 39)], armB=[(33, 26), (30, 33), (27, 38)], sway=1)
    elif name == "run1":
        d.update(bob=-1, mouth="o", sway=2, legL=[(24, 58), (25, 82), (26, 110), 1], legR=[(29, 58), (28, 82), (27, 110), 1],
                 armF=[(20, 26), (16, 33), (19, 40)], armB=[(33, 26), (33, 34), (32, 41)])
    elif name == "run2":
        d.update(mouth="o", legL=[(24, 58), (20, 84), (15, 109), -1], legR=[(29, 58), (33, 82), (38, 108), 1],
                 armF=[(20, 26), (24, 33), (28, 38)], armB=[(33, 26), (36, 33), (33, 40)], sway=1)
    elif name == "run3":
        d.update(bob=-1, mouth="o", sway=2, legL=[(24, 58), (24, 82), (25, 110), -1], legR=[(29, 58), (29, 82), (28, 110), 1],
                 armF=[(20, 26), (17, 34), (20, 41)], armB=[(33, 26), (34, 34), (33, 41)])
    elif name == "jump":
        d.update(mouth="o", sway=2, legL=[(24, 58), (20, 78), (23, 94), -1], legR=[(29, 58), (32, 78), (29, 96), 1],
                 armF=[(20, 26), (14, 30), (12, 24)], armB=[(33, 26), (38, 32), (40, 27)])
    elif name == "dash":
        d.update(lean=4, sway=-5, mouth="o",
                 legL=[(24, 58), (17, 82), (11, 98), -1], legR=[(29, 58), (23, 86), (16, 104), -1],
                 armF=[(20, 26), (14, 33), (8, 38)], armB=[(33, 26), (35, 34), (29, 40)])
    elif name == "attack":
        d.update(lean=3, mouth="det",
                 legL=[(24, 58), (19, 86), (14, 112), -1], legR=[(29, 58), (35, 84), (39, 110), 1],
                 armF=[(20, 26), (32, 28), (46, 27)], armB=[(33, 26), (28, 33), (24, 38)])
    elif name == "land":
        d.update(bob=2, mouth="o", skirt=2,
                 legL=[(24, 58), (19, 80), (17, 106), -1], legR=[(29, 58), (34, 80), (36, 106), 1],
                 armF=[(20, 26), (13, 32), (11, 40)], armB=[(33, 26), (40, 32), (42, 40)])
    elif name == "wall":
        d.update(lean=3, sway=-2, mouth="det",
                 legL=[(24, 58), (19, 76), (23, 92), -1], legR=[(29, 58), (32, 86), (30, 112), 1],
                 armF=[(20, 26), (27, 30), (34, 28)], armB=[(33, 26), (39, 32), (44, 30)])
    elif name == "hurt":
        d.update(lean=-4, sway=3, mouth="o",
                 legL=[(24, 58), (20, 84), (16, 110), -1], legR=[(29, 58), (33, 84), (37, 108), 1],
                 armF=[(20, 26), (13, 28), (9, 22)], armB=[(33, 26), (39, 28), (44, 23)])
    elif name == "attack2":
        d.update(lean=2, mouth="det",
                 legL=[(24, 58), (18, 86), (13, 112), -1], legR=[(29, 58), (36, 84), (41, 110), 1],
                 armF=[(20, 26), (27, 16), (38, 10)], armB=[(33, 26), (27, 33), (22, 38)])
    elif name == "attack3":
        d.update(lean=5, mouth="det",
                 legL=[(24, 58), (15, 86), (9, 112), -1], legR=[(29, 58), (39, 84), (45, 110), 1],
                 armF=[(20, 26), (34, 26), (48, 26)], armB=[(33, 26), (25, 32), (19, 36)])
    return d

def build(p):
    c = C()
    oy, lean, sw = p["bob"], p["lean"], p["sway"]

    # ================= long back hair (flows to hips, sways) =================
    c.ell(26 + lean, 10 + oy, 8, 8, HAIR_D)
    c.trap(19 + lean, 34 + lean, 10 + oy, 17 + sw, 36 + sw, 44 + oy, HAIR_D)
    c.trap(17 + sw, 36 + sw, 44 + oy, 18 + sw, 35 + sw, 66 + oy, HAIR)
    # pointed tips
    for tx in (18, 24, 29, 35):
        c.line(tx + sw, 64 + oy, tx + sw + (1 if tx < 26 else -1), 70 + oy, HAIR, 1)
    c.line(18 + sw, 46 + oy, 19 + sw, 62 + oy, HAIR_L, 1)   # sheen strands
    c.line(35 + sw, 46 + oy, 34 + sw, 60 + oy, HAIR_D, 1)

    # ================= back arm (sleeved) =================
    sh, el, ha = p["armB"]
    c.line(sh[0] + lean, sh[1] + oy, el[0], el[1] + oy, DRESS, 4)
    c.line(el[0], el[1] + oy, ha[0], ha[1] + oy, DRESS, 4)
    c.ell(ha[0], ha[1] + oy, 2, 2, SKIN_S)

    # ================= legs: bare thigh + glossy thigh-high boots =================
    for leg, shade in ((p["legR"], True), (p["legL"], False)):
        (hx, hy), (kx, ky), (ax, ay), toe = leg
        hy += oy; ky += oy; ay += oy
        skin = SKIN_S if shade else SKIN
        boot = BOOT_D if shade else BOOT
        c.line(hx, hy, kx, ky, skin, 5)                      # bare thigh
        c.line(kx, ky, ax, ay, boot, 5)                      # boot shaft
        c.line(kx, ky, ax, ay, BOOT if shade else BOOT_L, 1) # gloss line front
        c.line(kx - 2, ky, kx + 2, ky, BOOT_L if not shade else BOOT, 1)  # boot top band
        # foot + stiletto heel
        tx = ax + toe * 5
        c.rect(min(ax - 2, tx), ay + 1, max(ax + 2, tx), ay + 3, boot)
        c.line(min(ax - 2, tx), ay + 4, max(ax + 2, tx) + 1, ay + 4, BOOT_D, 1)   # sole
        c.rect(ax - toe * 3, ay + 4, ax - toe * 3 + 1, ay + 7, BOOT_D)            # heel spike
        c.set(ax + toe * 3, ay + 1, BOOT_L)                  # toe shine

    # ================= dress: off-should knit, waist, A-line skirt =================
    sk = p["skirt"]
    c.trap(23, 30, 43 + oy, 20 + sk, 33 + sk, 58 + oy, DRESS)      # skirt
    c.trap(21, 32, 25 + oy, 23, 30, 43 + oy, DRESS)                # cinched bodice
    # waist cinch light
    c.line(23 + lean, 42 + oy, 30 + lean, 42 + oy, DRESS_L, 1)
    # knit ribs
    for rx in range(23, 31, 2):
        c.line(rx + lean, 26 + oy, rx + lean, 42 + oy, DRESS_L, 1)
    for rx in range(22, 32, 3):
        c.line(rx + sk, 45 + oy, rx + sk, 57 + oy, DRESS_L, 1)
    # hem band
    c.line(20 + sk, 58 + oy, 33 + sk, 58 + oy, DRESS_L, 2)
    # off-shoulder skin caps + neckline
    c.rect(19 + lean, 24 + oy, 21 + lean, 24 + oy, SKIN)
    c.rect(32 + lean, 24 + oy, 34 + lean, 24 + oy, SKIN)
    c.line(23 + lean, 24 + oy, 30 + lean, 24 + oy, SKIN, 1)
    c.line(21 + lean, 25 + oy, 32 + lean, 25 + oy, DRESS_L, 1)

    # ================= front arm (sleeved) =================
    sh, el, ha = p["armF"]
    c.line(sh[0] + lean, sh[1] + oy, el[0] + lean, el[1] + oy, DRESS, 4)
    c.line(el[0] + lean, el[1] + oy, ha[0] + lean, ha[1] + oy, DRESS, 4)
    c.ell(ha[0] + lean, ha[1] + oy, 2, 2, SKIN)
    c.set(ha[0] + lean + 1, ha[1] + oy, SKIN_L)

    # ================= neck + choker =================
    c.rect(25 + lean, 19 + oy, 28 + lean, 23 + oy, SKIN_S)
    c.rect(24 + lean, 20 + oy, 29 + lean, 21 + oy, CHOKE)
    c.set(26 + lean, 22 + oy, RING)

    # ================= head =================
    hx0 = 26 + lean
    c.ell(hx0, 12 + oy, 7, 8, SKIN)
    c.set(hx0 - 4, 16 + oy, SKIN_S); c.set(hx0 + 4, 15 + oy, SKIN_S)   # soft cheek shade
    c.ell(hx0, 11 + oy, 7, 7, SKIN)
    # eyes (violet, elegant)
    if p["blink"]:
        c.line(hx0 - 5, 14 + oy, hx0 - 2, 14 + oy, EYE_D, 1)
        c.line(hx0 + 2, 14 + oy, hx0 + 5, 14 + oy, EYE_D, 1)
    else:
        c.rect(hx0 - 5, 12 + oy, hx0 - 2, 15 + oy, EYE)
        c.rect(hx0 + 2, 12 + oy, hx0 + 5, 15 + oy, EYE)
        c.line(hx0 - 6, 11 + oy, hx0 - 2, 11 + oy, EYE_D, 1)   # lash
        c.line(hx0 + 2, 11 + oy, hx0 + 6, 11 + oy, EYE_D, 1)
        c.set(hx0 - 4, 14 + oy, EYE_D); c.set(hx0 + 3, 14 + oy, EYE_D)
        c.set(hx0 - 5, 12 + oy, EYE_W); c.set(hx0 + 2, 12 + oy, EYE_W)
    if p["mouth"] == "smile":
        c.line(hx0 - 1, 18 + oy, hx0 + 1, 18 + oy, LIP, 1)
    elif p["mouth"] == "o":
        c.rect(hx0 - 1, 17 + oy, hx0, 18 + oy, (150, 90, 96))
    else:
        c.line(hx0 - 1, 18 + oy, hx0 + 2, 17 + oy, LIP, 1)

    # ================= front hair: fringe + long side locks =================
    c.ell(hx0, 8 + oy, 8, 6, HAIR)
    c.rect(hx0 - 8, 8 + oy, hx0 + 7, 11 + oy, HAIR)
    fx = hx0 - 7
    for i in range(5):                                        # fringe
        d = 1 if i % 2 == 0 else 3
        c.rect(fx, 10 + oy, fx + 2, 10 + d + oy, HAIR)
        fx += 3
    c.rect(hx0 - 8, 9 + oy, hx0 - 7, 30 + oy, HAIR)           # side locks to chest
    c.rect(hx0 + 7, 9 + oy, hx0 + 8, 28 + oy, HAIR)
    c.line(hx0 - 8, 20 + oy, hx0 - 8, 28 + oy, HAIR_L, 1)
    c.line(hx0 + 8, 18 + oy, hx0 + 8, 25 + oy, HAIR_D, 1)
    c.line(hx0 - 4, 5 + oy, hx0 - 1, 4 + oy, HAIR_L, 1)        # crown sheen
    c.line(hx0, 4 + oy, hx0 + 3, 6 + oy, HAIR_S, 1)
    return c

def encode(path, frames):
    raw = b""
    fw = W * len(frames)
    for y in range(H):
        raw += b"\x00"
        for f in frames:
            for x in range(W):
                c = f.p.get((x, y), (0, 0, 0, 0))
                raw += bytes(c[:3]) + bytes([255 if len(c) == 3 else 0])
    def chunk(t, d):
        cc = struct.pack(">I", len(d)) + t + d
        return cc + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", fw, H, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 9))
    png += chunk(b"IEND", b"")
    open(path, "wb").write(png)

if __name__ == "__main__":
    frames = [build(pose_data(n)) for n in POSES]
    out = sys.argv[1] if len(sys.argv) > 1 else "assets/hero.png"
    encode(out, frames)
    print("wrote", out, W * len(frames), "x", H, "frames:", len(frames))
