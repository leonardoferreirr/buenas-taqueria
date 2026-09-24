#!/usr/bin/env python3
"""Auditoria visual e de scroll do ¡Buenas! em Chromium headless.

Uso: python3 tools/audit.py [desktop|mobile|both] [--url http://127.0.0.1:8751] [--out DIR]
Gera: folhas de contato numeradas, relatório de console/404 e checagens de overflow.
"""
import asyncio, json, os, sys
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, ".audit")
URL = "http://127.0.0.1:8751"

PROBE = r"""() => {
  const de = document.documentElement;
  const over = [];
  document.querySelectorAll('body *').forEach(el => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    if (r.right > de.clientWidth + 2 || r.left < -2) {
      const cs = getComputedStyle(el);
      if (cs.position === 'fixed' || cs.visibility === 'hidden' || cs.opacity === '0') return;
      over.push({ sel: el.tagName.toLowerCase() + (el.className && typeof el.className === 'string' ? '.' + el.className.trim().split(/\s+/).slice(0,2).join('.') : ''), left: Math.round(r.left), right: Math.round(r.right) });
    }
  });
  const invisible = [];
  document.querySelectorAll('section, h1, h2, .lcard, .review, .place, .tcell').forEach(el => {
    const cs = getComputedStyle(el);
    const r = el.getBoundingClientRect();
    if (r.height > 0 && (cs.opacity === '0' || cs.visibility === 'hidden')) invisible.push(el.tagName.toLowerCase() + '.' + (typeof el.className === 'string' ? el.className.trim().split(/\s+/)[0] : ''));
  });
  return {
    scrollW: de.scrollWidth, clientW: de.clientWidth, scrollH: de.scrollHeight,
    overflow: over.slice(0, 14), invisible: [...new Set(invisible)].slice(0, 14),
    motion: !!(window.Buenas && window.Buenas.motion), lenis: !!(window.Buenas && window.Buenas.lenis),
    fired: window.Buenas ? window.Buenas.fired : null,
    st: window.ScrollTrigger ? window.ScrollTrigger.getAll().length : 0,
    imgsBroken: [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.currentSrc || i.src).slice(0, 10)
  };
}"""


async def run(p, mode, url, out):
    d = os.path.join(out, mode)
    os.makedirs(d, exist_ok=True)
    browser = await p.chromium.launch(headless=True)
    if mode == "desktop":
        vw, vh = 1440, 900
        ctx = await browser.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=1)
    else:
        vw, vh = 390, 844
        ctx = await browser.new_context(viewport={"width": vw, "height": vh}, device_scale_factor=2, is_mobile=True, has_touch=True)
    page = await ctx.new_page()
    logs, bad = [], []
    page.on("console", lambda m: logs.append(f"[{m.type}] {m.text}") if m.type in ("error", "warning") else None)
    page.on("pageerror", lambda e: logs.append(f"[pageerror] {e}"))
    page.on("response", lambda r: bad.append(f"{r.status} {r.url}") if r.status >= 400 else None)

    await page.goto(url, wait_until="networkidle", timeout=45000)
    await page.wait_for_timeout(3600)
    stuck = await page.evaluate("""() => { const l = document.getElementById('loader');
        if (!l) return false;
        const cs = getComputedStyle(l);
        const vis = cs.display !== 'none' && cs.visibility !== 'hidden' && Number(cs.opacity) > .01 && l.getBoundingClientRect().height > 10;
        if (vis) l.remove();
        return vis; }""")
    if stuck:
        logs.append("[audit] LOADER TRAVADO depois de 3,6s (removido para seguir a auditoria)")
        await page.wait_for_timeout(400)
    await page.screenshot(path=os.path.join(d, "s00_top.png"))

    # scroll em passos, com tempo para o scrub reagir
    step = int(vh * 0.75)
    shots, i, same, last = [], 0, 0, -1
    while i < 60:
        await page.evaluate(f"""() => {{ const l = window.Buenas && window.Buenas.lenis;
            if (l) l.scrollTo(window.scrollY + {step}, {{ immediate: false, duration: .45 }}); else window.scrollBy(0, {step}); }}""")
        await page.wait_for_timeout(950)
        y = await page.evaluate("Math.round(window.scrollY)")
        total = await page.evaluate("document.documentElement.scrollHeight")
        i += 1
        p_ = os.path.join(d, f"s{i:02d}.png")
        await page.screenshot(path=p_)
        shots.append(p_)
        if y == last:
            same += 1
            if same >= 2:
                break
        else:
            same = 0
        last = y
        if y + vh >= total - 6:
            break
    probe = await page.evaluate(PROBE)
    probe["console"] = logs[:25]
    probe["http"] = bad[:25]
    probe["steps"] = i
    with open(os.path.join(d, "report.json"), "w") as f:
        json.dump(probe, f, indent=1)
    await browser.close()
    return mode, probe


async def main():
    args = [a for a in sys.argv[1:]]
    mode = args[0] if args and not args[0].startswith("--") else "both"
    url = URL
    out = OUT
    if "--url" in args:
        url = args[args.index("--url") + 1]
    if "--out" in args:
        out = args[args.index("--out") + 1]
    modes = ["desktop", "mobile"] if mode == "both" else [mode]
    async with async_playwright() as p:
        for m in modes:
            mm, probe = await run(p, m, url, out)
            print(f"=== {mm}: scrollH={probe['scrollH']} scrollW={probe['scrollW']}/{probe['clientW']} "
                  f"steps={probe['steps']} ST={probe['st']} motion={probe['motion']} lenis={probe['lenis']}")
            if probe["overflow"]:
                print("  OVERFLOW:", probe["overflow"])
            if probe["invisible"]:
                print("  INVISÍVEL:", probe["invisible"])
            if probe["imgsBroken"]:
                print("  IMG QUEBRADA:", probe["imgsBroken"])
            for l in probe["console"]:
                print("  console:", l[:180])
            for h in probe["http"]:
                print("  http:", h[:160])


asyncio.run(main())
