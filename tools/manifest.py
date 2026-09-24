#!/usr/bin/env python3
"""Escreve assets/img/manifest.json com as imagens que existem.
O site só tenta carregar um encaixe se o arquivo estiver aqui (console sem 404)."""
import json, os

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
IMG = os.path.join(ROOT, "assets", "img")
files = []
for d, _, fs in os.walk(IMG):
    for f in fs:
        if f.lower().endswith((".webp", ".png", ".jpg", ".jpeg", ".svg", ".avif")):
            files.append(os.path.relpath(os.path.join(d, f), ROOT).replace(os.sep, "/"))
files.sort()
out = os.path.join(IMG, "manifest.json")
json.dump(files, open(out, "w"), indent=0)
print(f"{len(files)} imagens -> {os.path.relpath(out, ROOT)}")
