#!/usr/bin/env python3
"""Mede a métrica das fontes reais contra o fallback do sistema e imprime os
@font-face de ajuste. Sem isso o texto pula quando a fonte do Google chega."""
import asyncio, json
from playwright.async_api import async_playwright

PAIRS = [("Anybody", "Arial"), ("Instrument Sans", "Arial"), ("Ultra", "Georgia")]
HTML = """<!doctype html><meta charset=utf-8>
<link rel=stylesheet href="https://fonts.googleapis.com/css2?family=Anybody:wdth,wght@50..150,300..900&family=Instrument+Sans:wdth,wght@75..100,400..700&family=Ultra&display=block">
<div id=t style="position:absolute;white-space:nowrap;font-size:100px"></div>"""

JS = """async (pairs) => {
  for (const [real] of pairs) {
    try { await document.fonts.load(`400 100px "${real}"`); } catch (e) {}
  }
  await document.fonts.ready;
  const missing = pairs.filter(([r]) => !document.fonts.check(`400 100px "${r}"`)).map(([r]) => r);
  if (missing.length) throw new Error('fonte não carregou: ' + missing.join(', '));
  const t = document.getElementById('t');
  const S = 'Hamburgefonstiv 0123456789 ¡Buenas! tacos worth shouting';
  t.textContent = S;
  const out = {};
  for (const [real, fb] of pairs) {
    t.style.fontFamily = `"${real}"`; t.style.fontWeight = 400; t.style.fontVariationSettings = 'normal';
    const w1 = t.getBoundingClientRect().width;
    const m1 = (() => { const c = document.createElement('canvas').getContext('2d'); c.font = `100px "${real}"`; return c.measureText(S); })();
    t.style.fontFamily = fb;
    const w2 = t.getBoundingClientRect().width;
    const m2 = (() => { const c = document.createElement('canvas').getContext('2d'); c.font = `100px ${fb}`; return c.measureText(S); })();
    out[real] = {
      fallback: fb,
      sizeAdjust: +(w1 / w2 * 100).toFixed(2),
      ascent: +(m1.fontBoundingBoxAscent / (m2.fontBoundingBoxAscent || 1) * 100).toFixed(1),
      descent: +(m1.fontBoundingBoxDescent / (m2.fontBoundingBoxDescent || 1) * 100).toFixed(1),
    };
  }
  return out;
}"""


async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        pg = await b.new_page()
        await pg.set_content(HTML, wait_until="networkidle")
        await pg.wait_for_timeout(1500)
        res = await pg.evaluate(JS, PAIRS)
        await b.close()
    print(json.dumps(res, indent=1))
    print("\n/* fallback com a métrica da fonte real (evita o texto pular) */")
    for fam, v in res.items():
        print(f"""@font-face {{
  font-family: "{fam} Fallback";
  src: local("{v['fallback']}"), local("Helvetica"), local("Liberation Sans");
  size-adjust: {v['sizeAdjust']}%;
  ascent-override: {v['ascent']}%;
  descent-override: {v['descent']}%;
}}""")


asyncio.run(main())
