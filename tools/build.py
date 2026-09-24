#!/usr/bin/env python3
"""Build do ¡Buenas!: _src/index.html -> index.html pronto para publicar.

O que faz e por quê:
- Junta e minifica todo o CSS num bloco embutido. Folha externa bloqueia a
  primeira pintura, e nota de performance é o que sustenta o preço do site.
- Junta e minifica o JS do núcleo + a abertura, embutidos no fim do body.
- Os módulos pesados (baralho, anatomia, salsas, tabla) viram um arquivo
  minificado cada e são carregados SOB DEMANDA, quando a seção se aproxima.
  Isso tira do carregamento inicial o que só importa no meio da página.
- Fontes do Google param de bloquear a pintura (troca de media no onload) e
  ganham métrica de fallback, para o texto não pular quando a fonte chega.

Uso:
    python3 tools/build.py            # gera index.html
    python3 tools/build.py --check    # só avisa se o gerado está velho
"""
import os
import re
import subprocess
import sys
import shutil
import hashlib

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "_src", "index.html")
OUT = os.path.join(ROOT, "index.html")
CSS_DIR = os.path.join(ROOT, "assets", "css")
JS_DIR = os.path.join(ROOT, "assets", "js")
DIST_JS = os.path.join(JS_DIR, "dist")

# Ordem importa: main primeiro, módulos depois (a cascata do módulo vence).
# Embutido: o que pinta a primeira tela. O resto viaja com o módulo.
CSS_FILES = ["main.css", "modules/loader.css"]
# Entram no HTML (precisam existir antes da primeira pintura / da abertura).
JS_INLINE = ["main.js", "modules/loader.js"]
# Carregados quando a seção chega perto. Cada um: arquivo -> seletor que o dispara.
JS_LAZY = {
    "modules/deck.js": "#deck",
    "modules/anatomy.js": "#anatomy",
    "modules/salsas.js": "#salsas",
    "modules/tabla.js": "#tabla",
}
# CSS que acompanha cada módulo (mesmo gatilho).
CSS_LAZY = {"deck": "modules/deck.css", "anatomy": "modules/anatomy.css",
            "salsas": "modules/salsas.css", "tabla": "modules/tabla.css"}

TERSER = os.path.expanduser("~/.npm/_npx/ce069792d930b475/node_modules/.bin/terser")


def min_css(css: str) -> str:
    """Minificador conservador: não toca em url(data:...), calc() nem strings."""
    out, i, n = [], 0, len(css)
    while i < n:
        c = css[i]
        if c in "\"'":
            j = i + 1
            while j < n and (css[j] != c or css[j - 1] == "\\"):
                j += 1
            out.append(css[i:j + 1]); i = j + 1; continue
        if c == "/" and css[i:i + 2] == "/*":
            j = css.find("*/", i + 2)
            i = n if j < 0 else j + 2
            continue
        if c in " \t\r\n":
            j = i
            while j < n and css[j] in " \t\r\n":
                j += 1
            prev = out[-1][-1] if out and out[-1] else ""
            nxt = css[j] if j < n else ""
            if prev and nxt and (prev not in "{};:,>+~(" and nxt not in "{};:,>+~){"):
                out.append(" ")
            elif prev == ":" and nxt not in "{};,":
                out.append(" ")  # `and (min-width: X)`, valores compostos
            i = j; continue
        out.append(c); i += 1
    s = "".join(out)
    s = re.sub(r";\s*}", "}", s)
    return s.strip()


def min_js(path: str) -> str:
    src = open(path, encoding="utf-8").read()
    if not os.path.exists(TERSER):
        return src
    r = subprocess.run(
        [TERSER, path, "-c", "passes=2,drop_debugger=true", "-m", "--ecma", "2020"],
        capture_output=True, text=True)
    if r.returncode != 0 or not r.stdout.strip():
        print(f"  aviso: terser falhou em {os.path.basename(path)}, usando original")
        return src
    return r.stdout.strip()


# Imagens que podem virar <picture> com AVIF. Ficam de fora as que têm regra de
# CSS por posição entre irmãs (.lcard__dish img + img, .heat img:nth-child),
# porque o embrulho quebraria o seletor.
PICTURE_OK = ("assets/img/cards/", "assets/img/food/taco-pastor-")


def avif_pictures(html: str) -> tuple:
    """Embrulha <img> em <picture> com uma fonte AVIF, quando o arquivo existe."""
    n = [0]

    def swap(m):
        tag = m.group(0)
        src = re.search(r'src="([^"]+)"', tag)
        if not src or not src.group(1).startswith(PICTURE_OK):
            return tag
        ss = re.search(r'srcset="([^"]+)"', tag)
        cands = []
        if ss:
            for part in ss.group(1).split(","):
                bits = part.strip().split()
                if not bits:
                    continue
                a = bits[0].replace(".webp", ".avif")
                if os.path.exists(os.path.join(ROOT, a)):
                    cands.append(" ".join([a] + bits[1:]))
        else:
            a = src.group(1).replace(".webp", ".avif")
            if os.path.exists(os.path.join(ROOT, a)):
                cands.append(a)
        if not cands:
            return tag
        sizes = re.search(r'sizes="([^"]+)"', tag)
        sz = f' sizes="{sizes.group(1)}"' if sizes else ""
        n[0] += 1
        return f'<picture><source type="image/avif" srcset="{", ".join(cands)}"{sz}>{tag}</picture>'

    return re.sub(r"<img[^>]*>", swap, html), n[0]


def build(check_only=False):
    html = open(SRC, encoding="utf-8").read()

    # ---------- CSS: um bloco só, embutido ----------
    css = "\n".join(open(os.path.join(CSS_DIR, f), encoding="utf-8").read() for f in CSS_FILES)
    css_min = min_css(css)
    html = re.sub(r'\n?\s*<link rel="stylesheet" href="assets/css/(?!modules)[^"]+">', "", html)
    html = re.sub(r'\n?\s*<link rel="stylesheet" href="assets/css/modules/[^"]+">', "", html)

    # ---------- fontes: não bloqueiam a pintura, e o fallback tem a métrica certa ----------
    font_href = re.search(r'<link rel="stylesheet" href="(https://fonts\.googleapis\.com[^"]+)">', html)
    fonts_block = ""
    if font_href:
        href = font_href.group(1)
        fonts_block = (
            f'<link rel="preload" as="style" href="{href}">\n'
            f'<link rel="stylesheet" href="{href}" media="print" onload="this.media=\'all\';this.onload=null">\n'
            f'<noscript><link rel="stylesheet" href="{href}"></noscript>'
        )
        html = html.replace(font_href.group(0), fonts_block)

    # ---------- JS ----------
    os.makedirs(DIST_JS, exist_ok=True)
    inline_js = "\n".join(min_js(os.path.join(JS_DIR, f)) for f in JS_INLINE)

    lazy_map = {}
    keep = set()
    for rel, sel in JS_LAZY.items():
        name = os.path.basename(rel).replace(".js", "")
        code = min_js(os.path.join(JS_DIR, rel))
        digest = hashlib.sha1(code.encode()).hexdigest()[:8]
        fname = f"{name}.{digest}.js"
        open(os.path.join(DIST_JS, fname), "w", encoding="utf-8").write(code)
        keep.add(fname)
        css_url = ""
        if name in CSS_LAZY:
            mc = min_css(open(os.path.join(CSS_DIR, CSS_LAZY[name]), encoding="utf-8").read())
            cd = hashlib.sha1(mc.encode()).hexdigest()[:8]
            cname = f"{name}.{cd}.css"
            open(os.path.join(DIST_JS, cname), "w", encoding="utf-8").write(mc)
            keep.add(cname)
            css_url = f"assets/js/dist/{cname}"
        lazy_map[sel] = [f"assets/js/dist/{fname}", css_url]
    lazy_boot = (
        "(()=>{var M=" + repr(lazy_map).replace("'", '"') + ";"
        "var load=function(s){var u=M[s];if(!u)return;delete M[s];"
        "if(u[1]){var l=document.createElement('link');l.rel='stylesheet';l.href=u[1];document.head.appendChild(l)}"
        "var t=document.createElement('script');t.src=u[0];t.defer=!0;document.head.appendChild(t)};"
        "var all=function(){for(var s in M)load(s)};"
        "if(!('IntersectionObserver' in window)){all();return}"
        "var arm=function(){"
        "var io=new IntersectionObserver(function(es){es.forEach(function(e){"
        "if(e.isIntersecting){io.unobserve(e.target);load('#'+e.target.id)}})},{rootMargin:'110% 0px 110% 0px'});"
        "Object.keys(M).forEach(function(s){var el=document.querySelector(s);if(el)io.observe(el);else delete M[s]});"
        "setTimeout(all,4000)};"
        # só depois da abertura: durante ela a linha principal já está ocupada
        "var go=function(){window.requestIdleCallback?requestIdleCallback(arm,{timeout:1200}):setTimeout(arm,300)};"
        "if(document.readyState==='complete'){go()}else{addEventListener('load',go,{once:!0})}"
        "addEventListener('pointerdown',arm,{once:!0,passive:!0});"
        "addEventListener('scroll',arm,{once:!0,passive:!0});})();"
    )

    # O núcleo vai num arquivo com defer, NÃO embutido: script embutido roda
    # antes de qualquer <script defer>, e aí o main.js decidiria que não há
    # GSAP e o site inteiro ficaria parado. Com defer ele entra na fila certa,
    # depois das bibliotecas, e ainda fica em cache entre visitas.
    core_digest = hashlib.sha1(inline_js.encode()).hexdigest()[:8]
    core_name = f"site.{core_digest}.js"
    open(os.path.join(DIST_JS, core_name), "w", encoding="utf-8").write(inline_js)
    keep.add(core_name)
    for f in os.listdir(DIST_JS):
        if f not in keep:
            os.remove(os.path.join(DIST_JS, f))

    html = re.sub(r'\n?\s*<script src="assets/js/[^"]+" defer></script>', "", html)
    html = html.replace("</head>", f"<style>{css_min}</style>\n</head>")
    html = html.replace(
        "</body>",
        f'<script src="assets/js/dist/{core_name}" defer></script>\n'
        f"<script>{lazy_boot}</script>\n</body>")

    html, n_pic = avif_pictures(html)

    # o preload da imagem principal precisa apontar para o mesmo arquivo que a
    # <picture> vai escolher, senão o navegador baixa as duas versões
    def fix_preload(m):
        tag = m.group(0)
        ss = re.search(r'imagesrcset="([^"]+)"', tag)
        if not ss:
            return tag
        cands = []
        for part in ss.group(1).split(","):
            bits = part.strip().split()
            a_ = bits[0].replace(".webp", ".avif")
            if os.path.exists(os.path.join(ROOT, a_)):
                cands.append(" ".join([a_] + bits[1:]))
        if len(cands) != len(ss.group(1).split(",")):
            return tag
        avif = tag.replace(ss.group(1), ", ".join(cands)).replace("<link ", '<link type="image/avif" ', 1)
        return avif
    html = re.sub(r'<link rel="preload" as="image"[^>]*>', fix_preload, html)
    html = re.sub(r"\n{3,}", "\n\n", html)

    if check_only:
        cur = open(OUT, encoding="utf-8").read() if os.path.exists(OUT) else ""
        if cur != html:
            print("index.html está desatualizado: rode python3 tools/build.py")
            return 1
        print("index.html em dia")
        return 0

    open(OUT, "w", encoding="utf-8").write(html)
    kb = lambda s: f"{len(s.encode()) / 1024:.1f}KB"
    print(f"index.html {kb(html)}  (css embutido {kb(css_min)}, núcleo {kb(inline_js)} em {core_name}, {n_pic} imagens com AVIF)")
    for sel, (ju, cu) in lazy_map.items():
        sz = os.path.getsize(os.path.join(ROOT, ju)) / 1024
        cs = f" + {os.path.getsize(os.path.join(ROOT, cu)) / 1024:.1f}KB css" if cu else ""
        print(f"  sob demanda {sel:9s} {ju.split('/')[-1]:26s} {sz:.1f}KB{cs}")
    return 0


if __name__ == "__main__":
    sys.exit(build("--check" in sys.argv))
