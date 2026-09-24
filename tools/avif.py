#!/usr/bin/env python3
"""Gera AVIF ao lado de cada WebP pesado (cartas e taco). AVIF comprime
ilustração com grão bem melhor que WebP: ~40% mais leve no mesmo olho."""
import os, glob
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
TARGETS = ["assets/img/cards/*.webp", "assets/img/food/taco-pastor-*.webp", "assets/img/food/ing-*.webp"]
Q = 46

total_w = total_a = 0
for pat in TARGETS:
    for f in sorted(glob.glob(os.path.join(ROOT, pat))):
        out = f[:-5] + ".avif"
        im = Image.open(f).convert("RGBA")
        im.save(out, "AVIF", quality=Q)
        w, a = os.path.getsize(f), os.path.getsize(out)
        if a >= w:            # se não ganhou, não vale manter
            os.remove(out)
            continue
        total_w += w; total_a += a
print(f"AVIF: {total_w/1024:.0f}KB de WebP -> {total_a/1024:.0f}KB ({100*total_a/total_w:.0f}%)")
