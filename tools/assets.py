#!/usr/bin/env python3
"""Pipeline de imagens do ¡Buenas!

Uso:
  python3 tools/assets.py cards <sheet.png> <out_dir> <nome1> [nome2 nome3 ...]
      Arte de carta em fundo creme. Tira o creme de fora (flood fill a partir das bordas,
      preserva o creme de dentro, como olhos e brilhos), separa N artes lado a lado e exporta.
  python3 tools/assets.py cutout <img.png> <out_dir> <nome> [--sizes 1200,800,480]
      Recorte já transparente (ChatGPT): apara o vazio e exporta.
  python3 tools/assets.py split <sheet.png> <out_dir> <nome1> [nome2 ...]
      Folha transparente com N itens lado a lado: separa por coluna e exporta.
  python3 tools/assets.py photo <img.jpg> <out_dir> <nome> [--sizes 600,900,1200]
      Foto normal (sem alfa): exporta WebP nos tamanhos pedidos.

Saída: <out_dir>/<nome>-<largura>.webp para cada tamanho, e um PNG mestre em raw/processed/.
"""
import sys, os
import numpy as np
from PIL import Image
from scipy import ndimage as ndi

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
MASTER = os.path.join(ROOT, "raw", "processed")


def cream_to_alpha(img, tol=26.0, soft=10.0):
    rgb = np.asarray(img.convert("RGB")).astype(np.float32)
    h, w, _ = rgb.shape
    b = 10
    border = np.concatenate([rgb[:b].reshape(-1, 3), rgb[-b:].reshape(-1, 3),
                             rgb[:, :b].reshape(-1, 3), rgb[:, -b:].reshape(-1, 3)])
    bg = np.median(border, axis=0)
    blur = ndi.gaussian_filter(rgb, sigma=(1.4, 1.4, 0))
    dist = np.sqrt(((blur - bg) ** 2).sum(axis=2))
    cand = dist < tol
    lab, n = ndi.label(cand)
    edge = np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))
    edge = edge[edge != 0]
    exterior = np.isin(lab, edge)
    fg = ~exterior
    # remove poeira do papel (componentes minúsculos)
    flab, fn = ndi.label(fg, structure=np.ones((3, 3)))
    if fn:
        sizes = ndi.sum(np.ones_like(flab), flab, index=np.arange(1, fn + 1))
        small = np.isin(flab, np.where(sizes < 45)[0] + 1)
        fg &= ~small
    # borda suave: faixa de 2px ao redor do contorno recebe alfa proporcional à distância de cor
    alpha = fg.astype(np.float32)
    band = ndi.binary_dilation(fg, iterations=2) & ~ndi.binary_erosion(fg, iterations=1)
    d_raw = np.sqrt(((rgb - bg) ** 2).sum(axis=2))
    ramp = np.clip((d_raw - (tol - soft)) / (2 * soft), 0, 1)
    alpha = np.where(band, np.maximum(alpha * 0.0, ramp) * ndi.binary_dilation(fg, iterations=2), alpha)
    # come 1px da borda: mata o halo creme que sobra no antialias
    cross = np.array([[0, 1, 0], [1, 1, 1], [0, 1, 0]], bool)
    alpha = ndi.grey_erosion(alpha, footprint=cross)
    alpha = ndi.gaussian_filter(alpha, 0.55)
    alpha = np.clip(alpha, 0, 1)
    # descontamina o creme das bordas semi-transparentes
    a3 = alpha[..., None]
    col = np.where(a3 > 0.02, (rgb - (1 - a3) * bg) / np.maximum(a3, 0.02), rgb)
    col = np.clip(col, 0, 255)
    out = np.dstack([col, alpha * 255]).astype(np.uint8)
    return Image.fromarray(out), bg


def fg_mask(rgba, thr=14):
    return np.asarray(rgba)[..., 3] > thr


def split_columns(rgba, n, pad_ratio=0.04):
    m = fg_mask(rgba)
    h, w = m.shape
    if n == 1:
        return [trim(rgba, pad_ratio)]
    glued = ndi.binary_dilation(m, iterations=3)
    lab, cnt = ndi.label(glued, structure=np.ones((3, 3)))
    prof = ndi.uniform_filter1d(m.sum(axis=0).astype(np.float32), 25)
    cuts = []
    for k in range(1, n):
        c = int(w * k / n)
        lo, hi = int(c - w * 0.13), int(c + w * 0.13)
        cuts.append(lo + int(np.argmin(prof[lo:hi])))
    bounds = [0] + cuts + [w]
    objs = ndi.find_objects(lab)
    groups = [[] for _ in range(n)]
    for i, sl in enumerate(objs):
        if sl is None:
            continue
        comp = lab[sl] == (i + 1)
        ys, xs = np.nonzero(comp)
        cx = xs.mean() + sl[1].start
        seg = max(j for j in range(n) if bounds[j] <= cx)
        groups[seg].append((i + 1, sl))
    crops = []
    arr = np.asarray(rgba)
    for g in groups:
        keep = np.zeros_like(m)
        for idx, sl in g:
            keep[sl] |= (lab[sl] == idx)
        keep &= m | ndi.binary_dilation(m, iterations=1)
        piece = arr.copy()
        piece[..., 3] = np.where(ndi.binary_dilation(keep, iterations=2), piece[..., 3], 0)
        crops.append(trim(Image.fromarray(piece), pad_ratio))
    return crops


def trim(rgba, pad_ratio=0.04):
    m = fg_mask(rgba)
    ys, xs = np.nonzero(m)
    y0, y1, x0, x1 = ys.min(), ys.max(), xs.min(), xs.max()
    pad = int(max(y1 - y0, x1 - x0) * pad_ratio)
    H, W = m.shape
    return rgba.crop((max(0, x0 - pad), max(0, y0 - pad), min(W, x1 + pad + 1), min(H, y1 + pad + 1)))


def export(rgba, out_dir, name, sizes, quality=82):
    os.makedirs(out_dir, exist_ok=True)
    os.makedirs(MASTER, exist_ok=True)
    rgba.save(os.path.join(MASTER, f"{name}.png"))
    done = []
    for s in sizes:
        im = rgba
        if max(im.size) > s:
            r = s / max(im.size)
            im = im.resize((round(im.width * r), round(im.height * r)), Image.LANCZOS)
        p = os.path.join(out_dir, f"{name}-{s}.webp")
        im.save(p, "WEBP", quality=quality, alpha_quality=90, method=6)
        done.append(f"{os.path.basename(p)} {im.width}x{im.height} {os.path.getsize(p) / 1024:.0f}KB")
    print(f"{name}: " + " | ".join(done))


def main():
    if len(sys.argv) < 5:
        print(__doc__)
        sys.exit(1)
    mode, src, out_dir = sys.argv[1:4]
    rest = sys.argv[4:]
    sizes = None
    if "--sizes" in rest:
        i = rest.index("--sizes")
        sizes = [int(x) for x in rest[i + 1].split(",")]
        rest = rest[:i] + rest[i + 2:]
    img = Image.open(src)
    if mode == "cards":
        rgba, bg = cream_to_alpha(img)
        print(f"fundo estimado: #{int(bg[0]):02X}{int(bg[1]):02X}{int(bg[2]):02X}")
        for name, crop in zip(rest, split_columns(rgba, len(rest))):
            export(crop, out_dir, name, sizes or [720, 360])
    elif mode == "cutout":
        export(trim(img.convert("RGBA"), 0.02), out_dir, rest[0], sizes or [1200, 800, 480])
    elif mode == "photo":
        im = img.convert("RGB")
        os.makedirs(out_dir, exist_ok=True)
        done = []
        for sz in (sizes or [600, 900, 1200]):
            o = im
            if max(o.size) > sz:
                r = sz / max(o.size)
                o = o.resize((round(o.width * r), round(o.height * r)), Image.LANCZOS)
            fp = os.path.join(out_dir, f"{rest[0]}-{sz}.webp")
            o.save(fp, "WEBP", quality=80, method=6)
            done.append(f"{os.path.basename(fp)} {o.width}x{o.height} {os.path.getsize(fp) / 1024:.0f}KB")
        print(f"{rest[0]}: " + " | ".join(done))
    elif mode == "split":
        for name, crop in zip(rest, split_columns(img.convert("RGBA"), len(rest), 0.03)):
            export(crop, out_dir, name, sizes or [800, 400])
    else:
        print(__doc__)
        sys.exit(1)


if __name__ == "__main__":
    main()
