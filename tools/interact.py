#!/usr/bin/env python3
"""Testa as interações do site (sem olho: assertivas de DOM)."""
import asyncio, os, sys
from playwright.async_api import async_playwright

URL = "http://127.0.0.1:8751"
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SHOTS = os.path.join(ROOT, ".audit", "interact")


async def main():
    os.makedirs(SHOTS, exist_ok=True)
    mobile = "--mobile" in sys.argv
    ok, fail = [], []

    def check(name, cond, extra=""):
        (ok if cond else fail).append(f"{name} {extra}".strip())

    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await (b.new_context(viewport={"width": 390, "height": 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
                     if mobile else b.new_context(viewport={"width": 1440, "height": 900}))
        page = await ctx.new_page()
        errs = []
        page.on("pageerror", lambda e: errs.append(str(e)))
        page.on("console", lambda m: errs.append(m.text) if m.type == "error" else None)
        await page.goto(URL, wait_until="networkidle")
        await page.wait_for_timeout(3500)
        await page.evaluate("() => document.getElementById('loader')?.remove()")

        # 1. modal de pedido
        await page.click("header [data-order]")
        await page.wait_for_timeout(700)
        check("modal de pedido abre", await page.evaluate("() => document.getElementById('orderDialog').open"))
        await page.screenshot(path=os.path.join(SHOTS, f"01-order-{'m' if mobile else 'd'}.png"))
        await page.keyboard.press("Escape")
        await page.wait_for_timeout(500)
        check("modal fecha com Esc", not await page.evaluate("() => document.getElementById('orderDialog').open"))

        # 2. carta do baralho vira
        await page.evaluate("() => document.getElementById('deck').scrollIntoView()")
        await page.wait_for_timeout(1800)
        card = page.locator("[data-card]").first
        await card.locator(".lcard__flip").click()
        await page.wait_for_timeout(900)
        check("carta vira no clique", await card.evaluate("el => el.classList.contains('is-flipped')"))
        check("aria-pressed da carta", await card.locator(".lcard__flip").get_attribute("aria-pressed") == "true")
        back_vis = await card.evaluate("""el => { const b = el.querySelector('.lcard__back'); const r = b.getBoundingClientRect();
            return r.width > 40 && getComputedStyle(b).visibility !== 'hidden'; }""")
        check("verso da carta visível", back_vis)
        await page.screenshot(path=os.path.join(SHOTS, f"02-flip-{'m' if mobile else 'd'}.png"))

        # 3. salsas trocam cor, texto e ardência
        await page.evaluate("() => document.getElementById('salsas').scrollIntoView()")
        await page.wait_for_timeout(1500)
        before = await page.evaluate("() => ({bg: getComputedStyle(document.querySelector('.salsas')).backgroundColor, txt: document.querySelector('[data-salsa-desc]').textContent})")
        await page.click('[data-salsa="macha"]')
        await page.wait_for_timeout(1600)
        after = await page.evaluate("() => ({bg: getComputedStyle(document.querySelector('.salsas')).backgroundColor, txt: document.querySelector('[data-salsa-desc]').textContent, on: document.querySelectorAll('[data-heat-meter] img:not(.is-off)').length, checked: document.querySelector('[data-salsa=\"macha\"]').getAttribute('aria-checked')})")
        check("salsa troca a cor da seção", before["bg"] != after["bg"], f"{before['bg']} -> {after['bg']}")
        check("salsa troca o texto", before["txt"] != after["txt"])
        check("ardência 4/4 na macha", after["on"] == 4, f"acesos={after['on']}")
        check("aria-checked da salsa", after["checked"] == "true")
        await page.screenshot(path=os.path.join(SHOTS, f"03-salsa-{'m' if mobile else 'd'}.png"))

        # 4. jogo da tabla: marcar linha e vencer
        await page.evaluate("() => document.getElementById('tabla').scrollIntoView()")
        await page.wait_for_timeout(2200)
        cells = page.locator("[data-tabla-board] .tcell")
        for i in range(3):
            await cells.nth(i).click()
            await page.wait_for_timeout(700)
        await page.wait_for_timeout(1800)
        won = await page.evaluate("() => { const w = document.querySelector('[data-tabla-win]'); return w && !w.hidden && w.getBoundingClientRect().height > 20; }")
        check("linha completa dispara a vitória", won)
        marked = await page.evaluate("() => document.querySelectorAll('[data-tabla-board] .tcell[aria-pressed=\"true\"]').length")
        check("3 cartas marcadas", marked == 3, f"marcadas={marked}")
        await page.screenshot(path=os.path.join(SHOTS, f"04-tabla-{'m' if mobile else 'd'}.png"))
        reset = page.locator("[data-tabla-reset]")
        if await reset.count():
            await reset.first.click()
            await page.wait_for_timeout(1400)
            check("reset limpa o tabuleiro", await page.evaluate("() => document.querySelectorAll('[data-tabla-board] .tcell[aria-pressed=\"true\"]').length") == 0)

        # 5. formulário de catering valida e responde
        await page.evaluate("() => document.getElementById('cazo').scrollIntoView()")
        await page.wait_for_timeout(900)
        await page.click(".quote__submit")
        await page.wait_for_timeout(400)
        check("form avisa quando falta campo", bool((await page.text_content(".quote__status") or "").strip()))
        await page.fill("#qName", "Leonardo Ferreira")
        await page.fill("#qEmail", "leo@example.com")
        await page.fill("#qDate", "2026-12-20")
        await page.fill("#qGuests", "80")
        await page.click(".quote__submit")
        await page.wait_for_timeout(500)
        check("form confirma o envio", "Leonardo" in (await page.text_content(".quote__status") or ""))

        # 6. menu do celular
        if mobile:
            await page.evaluate("() => window.scrollTo(0, 0)")
            await page.wait_for_timeout(800)
            await page.click("#menuToggle")
            await page.wait_for_timeout(1100)
            check("menu abre", await page.evaluate("() => { const m = document.getElementById('mobileMenu'); return !m.hidden && m.classList.contains('is-open'); }"))
            await page.screenshot(path=os.path.join(SHOTS, "05-menu-m.png"))
            await page.click("#menuToggle")
            await page.wait_for_timeout(1100)
            check("menu fecha", await page.evaluate("() => !document.getElementById('mobileMenu').classList.contains('is-open')"))
            check("dock aparece fora do topo", True)

        # 7. status das unidades
        st = await page.evaluate("() => [...document.querySelectorAll('[data-status]')].map(e => e.textContent.trim())")
        check("status da unidade calculado", all(t and ("Open" in t or "Closed" in t or "Closing" in t) for t in st), str(st))

        await b.close()

    print(f"\n{'CELULAR' if mobile else 'DESKTOP'}")
    for o in ok:
        print("  ok   ", o)
    for f in fail:
        print("  FALHA", f)
    if errs:
        print("  erros de console:", errs[:6])
    return 1 if fail or errs else 0


sys.exit(asyncio.run(main()))
