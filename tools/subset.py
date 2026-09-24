#!/usr/bin/env python3
"""Corta as fontes para os caracteres que o site realmente usa.

A Anybody (variável, 2 eixos) só aparece em título e nome de carta, sempre em
caixa alta. Carregar o alfabeto inteiro é pagar por letra que ninguém vê.
Mantém os eixos variáveis intactos: são eles que fazem o nome "gritar".
"""
import os, re, sys
from fontTools import subset

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
FONTS = os.path.join(ROOT, "assets", "fonts")

# Texto que o site pode mostrar: o HTML inteiro + o que o JS injeta.
EXTRA = ("¡Buenas! HECHO A MANO · TORTILLAS DEL DÍA · DESDE 2016 TACOS WORTH SHOUTING ABOUT "
         "LOS ANGELES ¡B! ¡Ay! One more… Open now Closed Closing soon opens until a.m. p.m. "
         "0123456789 $.,:;!?¿¡&@#%()[]{}/\\|+-–—'\"“”‘’ áéíóúñÁÉÍÓÚÑàâçèêëîïôûüÀÈÉÊÎÔÛÜº°ª")


def used_chars():
    txt = EXTRA
    for rel in ("_src/index.html",):
        txt += open(os.path.join(ROOT, rel), encoding="utf-8").read()
    for d in ("assets/js", "assets/js/modules"):
        p = os.path.join(ROOT, d)
        for f in os.listdir(p):
            if f.endswith(".js"):
                txt += open(os.path.join(p, f), encoding="utf-8").read()
    # tira marcação e nomes de arquivo, mas mantém o texto visível
    txt = re.sub(r"<[^>]+>", " ", txt)
    return set(txt) | set(txt.upper()) | set(txt.lower())


def run():
    chars = used_chars()
    keep = "".join(sorted(c for c in chars if c.isprintable() and ord(c) > 31))
    total_before = total_after = 0
    for f in sorted(os.listdir(FONTS)):
        if not f.endswith(".woff2") or ".sub." in f:
            continue
        src = os.path.join(FONTS, f)
        out = os.path.join(FONTS, f.replace(".woff2", ".sub.woff2"))
        args = [src, f"--text={keep}", "--flavor=woff2", f"--output-file={out}",
                "--layout-features=kern,liga,calt,ccmp,locl,rlig,mark,mkmk",
                "--no-hinting", "--desubroutinize", "--name-IDs=*", "--drop-tables+=DSIG"]
        subset.main(args)
        b, a = os.path.getsize(src), os.path.getsize(out)
        total_before += b; total_after += a
        print(f"{f:32s} {b/1024:6.1f}KB -> {a/1024:6.1f}KB  ({100*a/b:.0f}%)")
    print(f"\n{len(keep)} caracteres mantidos | total {total_before/1024:.0f}KB -> {total_after/1024:.0f}KB")


if __name__ == "__main__":
    run()
