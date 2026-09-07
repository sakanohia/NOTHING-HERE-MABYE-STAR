#!/usr/bin/env python3
"""Offline scene compositor: mirrors game.js auto-tiling to preview tileset
in-context (no browser needed). usage: python3 tools/shot.py"""
import zlib, struct, sys

def read_png(path):
    d = open(path, "rb").read()
    assert d[:8] == b"\x89PNG\r\n\x1a\n"
    i = 8; idat = b""; w = h = None; ct = None
    while i < len(d):
        ln = struct.unpack(">I", d[i:i+4])[0]; t = d[i+4:i+8]; data = d[i+8:i+8+ln]
        if t == b"IHDR":
            w, h, bd, ct = struct.unpack(">IIBB", data[:10])[:4]
        elif t == b"IDAT": idat += data
        i += 12 + ln
    raw = zlib.decompress(idat)
    ch = {0: 1, 2: 3, 4: 2, 6: 4}[ct]
    px = [[(0, 0, 0, 0)] * w for _ in range(h)]
    pos = 0
    prev = [0] * (w * ch)
    for y in range(h):
        f = raw[pos]; pos += 1
        line = list(raw[pos:pos + w * ch]); pos += w * ch
        for x in range(len(line)):
            a = line[x - ch] if x >= ch else 0
            b = prev[x]
            c = prev[x - ch] if x >= ch else 0
            if f == 1: line[x] = (line[x] + a) & 255
            elif f == 2: line[x] = (line[x] + b) & 255
            elif f == 3: line[x] = (line[x] + (a + b) // 2) & 255
            elif f == 4:
                p = a + b - c
                pa, pb, pc = abs(p - a), abs(p - b), abs(p - c)
                pr = a if pa <= pb and pa <= pc else (b if pb <= pc else c)
                line[x] = (line[x] + pr) & 255
        prev = line
        for x in range(w):
            o = x * ch
            if ch >= 3:
                al = line[o+3] if ch == 4 else 255
                px[y][x] = (line[o], line[o+1], line[o+2], al)
    return w, h, px

def hash2(x, y):
    n = (x * 374761393 + y * 668265263) & 0xffffffff
    n = ((n ^ (n >> 13)) * 1274126177) & 0xffffffff
    return ((n ^ (n >> 16)) & 0xffffffff) % 1000

def write_png(path, w, h, px):
    raw = bytearray()
    for y in range(h):
        raw.append(0)
        row = px[y]
        for x in range(w):
            c = row[x]
            raw += bytes(c[:3])
            raw.append(c[3] if len(c) == 4 else 255)
    raw = bytes(raw)
    def chunk(t, d):
        cc = struct.pack(">I", len(d)) + t + d
        return cc + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
    png = b"\x89PNG\r\n\x1a\n"
    png += chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 6, 0, 0, 0))
    png += chunk(b"IDAT", zlib.compress(raw, 6))
    png += chunk(b"IEND", b"")
    open(path, "wb").write(png)
    print("wrote", path, w, h)

sys.path.insert(0, ".")
import importlib.util
spec = importlib.util.spec_from_file_location("wd", "js/world.js")
# world.js is JS; read the grid via node instead
import subprocess, json, time
T0 = time.time()
grid = json.loads(subprocess.run(["node", "-e", """
const w=require('./js/world.js');const b=w.build();
console.log(JSON.stringify({W:w.W,H:w.H,g:Array.from(b.g)}));
"""], capture_output=True, text=True, check=True).stdout)
W, H, G = grid["W"], grid["H"], grid["g"]
T = 40
tw, th, tiles = read_png("assets/tiles.png"); print("tiles read", round(time.time()-T0,1), flush=True)

X0, Y0, X1, Y1 = 60, 6, 92, 20   # left hall + gap + right hall + chimney
if len(sys.argv) > 1 and sys.argv[1] == "start":
    X0, Y0, X1, Y1 = 58, 32, 94, 44
OW, OH = (X1 - X0) * T, (Y1 - Y0) * T
out = [[(18, 14, 32, 255)] * OW for _ in range(OH)]

def blit(cx, cy, dx, dy):
    for y in range(T):
        for x in range(T):
            c = tiles[cy + y][cx + x]
            if c[3] > 0:
                out[dy + y][dx + x] = c

def air(t): return t in (0, 2, 4)

for ty in range(Y0, Y1):
    for tx in range(X0, X1):
        v = G[ty * W + tx]
        px, py = (tx - X0) * T, (ty - Y0) * T
        up = G[(ty - 1) * W + tx] if ty > 0 else 1
        dn = G[(ty + 1) * W + tx] if ty < H - 1 else 1
        lf = G[ty * W + tx - 1] if tx > 0 else 1
        rt = G[ty * W + tx + 1] if tx < W - 1 else 1
        zix = 1 if tx < 58 else (2 if ty < 16 else 0)
        hsh = hash2(tx, ty)
        if v in (1, 3):
            blit((hsh % 3) * T, zix * T, px, py)
            if air(up): blit((160 if hsh % 6 == 0 else 120), zix * T, px, py)
            if air(lf): blit(200, zix * T, px, py)
            if air(rt): blit(240, zix * T, px, py)
            if air(dn): blit(280, zix * T, px, py)
        elif v == 2:
            for y in range(T - 5, T):
                for x in range(T): out[py + y][px + x] = (36, 29, 51, 255)
            for s in range(4):
                for y in range(T):
                    half = int((1 - y / T) * 5)
                    cx = s * 10 + 5
                    for x in range(cx - half, cx + half + 1):
                        if 0 <= x < T: out[py + y][px + x] = (201, 194, 221, 255) if half <= 2 else (36, 29, 51, 255)
        elif v == 4:
            blit(320, zix * T, px, py)

print("composited", round(time.time()-T0,1), flush=True)
write_png("tools/shot_out.png", OW, OH, out)
