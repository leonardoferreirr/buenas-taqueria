#!/usr/bin/env python3
"""Gera assets/img/ui/og.jpg (1200x630) com a cara do site."""
import asyncio, os
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
HTML = """<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Anybody:wdth,wght@50..150,300..900&family=Instrument+Sans:wght@400..700&display=swap">
<style>
*{box-sizing:border-box;margin:0}
body{width:1200px;height:630px;overflow:hidden;position:relative;background:#F4EAD8;
 font-family:"Instrument Sans",sans-serif;color:#1D1511;display:grid;place-items:center}
.grain{position:absolute;inset:0;opacity:.09;pointer-events:none;
 background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='240' height='240'><filter id='n'><feTurbulence type='fractalNoise' baseFrequency='.9' numOctaves='3' stitchTiles='stitch'/><feColorMatrix values='0 0 0 0 .11 0 0 0 0 .08 0 0 0 0 .06 0 0 0 1 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>")}
.stage{position:relative;width:100%;height:100%;display:grid;place-items:center}
.wm{display:flex;align-items:flex-end;gap:.02em;font-family:"Anybody";font-weight:900;
 font-variation-settings:"wdth" 84,"wght" 900;font-size:170px;line-height:.8;text-transform:uppercase;
 position:absolute;top:120px}
.wm b{font-weight:900;background:linear-gradient(90deg,#E5256E 0%,#F6A019 52%,#F5CD3A 100%);
 -webkit-background-clip:text;background-clip:text;color:transparent;position:relative;padding-bottom:.04em}
.wm b::before{content:"BUENAS";position:absolute;left:.045em;top:.045em;z-index:-1;color:#1D1511;-webkit-text-fill-color:#1D1511}
.excl{height:.79em;width:.35em;margin-bottom:.035em}
.taco{position:absolute;top:158px;left:346px;width:452px;transform:rotate(-4deg);
 filter:drop-shadow(0 26px 30px rgba(29,21,17,.32))}
.tag{position:absolute;bottom:58px;left:64px;font-family:"Anybody";font-weight:850;
 font-variation-settings:"wdth" 62,"wght" 850;font-size:52px;text-transform:uppercase;line-height:1;z-index:3}
.tag i{font-style:normal;color:#E5256E}
.loc{position:absolute;bottom:26px;left:66px;font-size:19px;color:#5A4A3F;font-weight:600;z-index:3}
.veil{position:absolute;left:0;right:0;bottom:0;height:190px;z-index:2;
 background:linear-gradient(to top,#F4EAD8 0 46%,rgba(244,234,216,.86) 72%,rgba(244,234,216,0) 100%)}
.band{position:absolute;left:-4%;right:-4%;top:76px;height:0;border-top:4px solid #1D1511;transform:rotate(-2deg);opacity:.0}
</style></head><body>
<div class="grain"></div>
<div class="stage">
  <div class="wm">
    <svg class="excl" viewBox="0 0 44 100"><g transform="translate(3 3)" fill="#1D1511"><path d="M14 36 H26 L36 100 H4 Z"/><path transform="translate(2 4)" d="M5,5 C11,-1 29,-1 35,6 C40,11 38,19 31,21 C25,23 23,18 19.5,18 C15,18 13,23 7,21 C1,19 0,9 5,5 Z"/></g><path d="M14 36 H26 L36 100 H4 Z" fill="#E5256E"/><g transform="translate(2 4)"><path d="M5,5 C11,-1 29,-1 35,6 C40,11 38,19 31,21 C25,23 23,18 19.5,18 C15,18 13,23 7,21 C1,19 0,9 5,5 Z" fill="#E5256E"/><ellipse cx="19.5" cy="14.8" rx="3.4" ry="1.5" fill="#F4EAD8" opacity=".9"/></g></svg>
    <b>BUENAS</b>
    <svg class="excl" viewBox="0 0 44 100"><g transform="translate(3 3)" fill="#1D1511"><path d="M4 0 H36 L26 64 H14 Z"/><path transform="translate(2 72)" d="M5,5 C11,-1 29,-1 35,6 C40,11 38,19 31,21 C25,23 23,18 19.5,18 C15,18 13,23 7,21 C1,19 0,9 5,5 Z"/></g><path d="M4 0 H36 L26 64 H14 Z" fill="#F5CD3A"/><g transform="translate(2 72)"><path d="M5,5 C11,-1 29,-1 35,6 C40,11 38,19 31,21 C25,23 23,18 19.5,18 C15,18 13,23 7,21 C1,19 0,9 5,5 Z" fill="#F5CD3A"/><ellipse cx="19.5" cy="14.8" rx="3.4" ry="1.5" fill="#1D1511" opacity=".35"/></g></svg>
  </div>
  <img class="taco" src="ASSET/taco-pastor-1200.webp">
  <div class="veil"></div>
  <p class="tag">Tacos worth <i>shouting</i> about.</p>
  <p class="loc">Taquería · Highland Park &amp; Boyle Heights, Los Angeles</p>
</div></body></html>"""


async def main():
    html = HTML.replace("ASSET/", "file://" + os.path.join(ROOT, "assets/img/food") + "/")
    tmp = os.path.join(ROOT, ".audit", "og.html")
    os.makedirs(os.path.dirname(tmp), exist_ok=True)
    open(tmp, "w").write(html)
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page(viewport={"width": 1200, "height": 630}, device_scale_factor=1)
        await pg.goto("file://" + tmp, wait_until="networkidle")
        await pg.wait_for_timeout(1200)
        out = os.path.join(ROOT, "assets/img/ui/og.jpg")
        await pg.screenshot(path=out, type="jpeg", quality=88)
        await b.close()
    print(out, os.path.getsize(out) // 1024, "KB")


asyncio.run(main())
