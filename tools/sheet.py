#!/usr/bin/env python3
"""Folha de contato das capturas da auditoria. Uso: python3 tools/sheet.py <desktop|mobile> [cols] [thumb_w]"""
import sys, os, glob
from PIL import Image, ImageDraw, ImageFont

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
mode = sys.argv[1] if len(sys.argv) > 1 else "desktop"
cols = int(sys.argv[2]) if len(sys.argv) > 2 else 3
tw = int(sys.argv[3]) if len(sys.argv) > 3 else 540
d = os.path.join(ROOT, ".audit", mode)
files = sorted(glob.glob(os.path.join(d, "s*.png")))
if not files:
    sys.exit("sem capturas em " + d)
thumbs = []
for f in files:
    im = Image.open(f).convert("RGB")
    thumbs.append((os.path.basename(f)[:-4], im.resize((tw, int(im.height * tw / im.width)), Image.LANCZOS)))
th = max(t[1].height for t in thumbs)
pad, lab = 8, 22
per = cols * (4 if mode == "desktop" else 2)
try:
    font = ImageFont.truetype("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 16)
except Exception:
    font = ImageFont.load_default()
out = []
for s in range(0, len(thumbs), per):
    chunk = thumbs[s:s + per]
    rows = (len(chunk) + cols - 1) // cols
    sheet = Image.new("RGB", (cols * (tw + pad) + pad, rows * (th + lab + pad) + pad), (28, 28, 32))
    dr = ImageDraw.Draw(sheet)
    for i, (name, im) in enumerate(chunk):
        x = pad + (i % cols) * (tw + pad)
        y = pad + (i // cols) * (th + lab + pad)
        dr.text((x + 2, y + 2), name, fill=(255, 220, 0), font=font)
        sheet.paste(im, (x, y + lab))
    p = os.path.join(ROOT, ".audit", f"_{mode}_{s // per}.jpg")
    sheet.save(p, quality=82)
    out.append(p)
print("\n".join(out))
