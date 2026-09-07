#!/usr/bin/env python3
"""Render the hero sheet upscaled on a dark bg for visual review."""
import importlib.util, zlib, struct, sys

spec = importlib.util.spec_from_file_location("ph", "tools/paint_hero.py")
ph = importlib.util.module_from_spec(spec); spec.loader.exec_module(ph)
S = 4
frames = [ph.build(ph.pose_data(n)) for n in ph.POSES]
W, H = ph.W * S * len(frames), ph.H * S
bg = (30, 26, 40)
buf = bytearray()
for y in range(H):
    buf.append(0)
    sy = y // S
    for f in frames:
        for x in range(ph.W * S):
            c = f.p.get((x // S, sy))
            if c is None or (len(c) == 4 and c[3] == 0): c = bg
            buf += bytes(c[:3])
def chunk(t, d):
    return struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xffffffff)
png = (b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", W, H, 8, 2, 0, 0, 0))
       + chunk(b"IDAT", zlib.compress(bytes(buf), 9)) + chunk(b"IEND", b""))
out = sys.argv[1] if len(sys.argv) > 1 else "tools/hero_preview.png"
open(out, "wb").write(png)
print("preview", W, H, "->", out)
