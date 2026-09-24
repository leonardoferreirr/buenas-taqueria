/* ¡Buenas! Taquería · El Diablito (salsas)
   Escolher uma salsa troca a cor da seção (e da borda recortada), a descrição
   e o medidor de ardência. Na 4ª a seção dá uma tremida e carimba o selo "¡Ay!".

   Sem GSAP ou com prefers-reduced-motion: a troca continua inteira (cor, texto,
   ardência, ARIA), só perde o movimento. Nada nasce invisível. */
(() => {
  const section = document.querySelector('[data-module="salsas"]');
  if (!section) return;

  const B = window.Buenas || {};
  const gsap = B.gsap || window.gsap || null;
  const ST = B.ScrollTrigger || window.ScrollTrigger || null;
  const motion = !!B.motion && !!gsap;

  const picker = section.querySelector("[data-salsa-picker]");
  const options = picker ? [...picker.querySelectorAll('[role="radio"]')] : [];
  if (!picker || !options.length) return;

  const descEl = section.querySelector("[data-salsa-desc]");
  const meter = section.querySelector("[data-heat-meter]");
  const chiles = meter ? [...meter.querySelectorAll("img")] : [];
  const card = section.querySelector(".salsas__card .lcard");
  const MAX = chiles.length || 4;

  /* ---------------------------------------------------------------- copy */
  const COPY = {
    verde: "Bright, tangy, friendly. Tomatillo, serrano, cilantro, lime.",
    roja: "Smoky and charred, with a little attitude. Roasted tomato, chile de árbol, garlic.",
    habanero: "Sunny and dangerous. Habanero, carrot, a squeeze of orange.",
    macha: "Chile oil, toasted garlic, peanuts, sesame. Sign the waiver.",
  };

  /* -------------------------------------------- contraste (token-lock)
     O laranja do habanero não segura texto creme (2.7:1). Em vez de chutar,
     mede: creme com ≥4.5:1 fica creme, senão a seção vira tinta. */
  const CREME = "#FBF5EA", TINTA = "#1D1511";
  const toRgb = (hex) => {
    const s = String(hex).trim().replace("#", "");
    const v = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
    const n = parseInt(v, 16);
    return Number.isFinite(n) ? [(n >> 16) & 255, (n >> 8) & 255, n & 255] : [47, 116, 70];
  };
  const lum = (hex) => {
    const [r, g, b] = toRgb(hex).map((v) => {
      const c = v / 255;
      return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
    });
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const contrast = (a, b) => {
    const la = lum(a), lb = lum(b);
    return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
  };
  const rgba = (hex, a) => { const [r, g, b] = toRgb(hex); return `rgba(${r}, ${g}, ${b}, ${a})`; };

  /* ---------------------------------------------------------------- estado */
  const SALSAS = options.map((btn) => {
    const key = btn.dataset.salsa || "";
    const bg = (btn.dataset.bg || "#2F7446").trim();
    const claro = contrast(CREME, bg) >= 4.5;
    const ink = claro ? CREME : TINTA;
    return {
      btn, key, bg, ink,
      heat: Math.min(MAX, Math.max(1, Number(btn.dataset.heat) || 1)),
      hl: claro ? "var(--maiz)" : "var(--cobalto-deep)",
      ink40: rgba(ink, 0.4),
      ink12: rgba(ink, 0.12),
      desc: COPY[key] || (descEl ? descEl.textContent : ""),
      bowl: btn.querySelector(".salsa__bowl"),
      name: btn.querySelector(".salsa__name"),
    };
  });

  let index = Math.max(0, options.findIndex((b) => b.getAttribute("aria-checked") === "true"));

  /* ---------------------------------------------------------------- ardência */
  function paintHeat(heat, animate) {
    let acendendo = 0, apagando = 0;
    chiles.forEach((img, k) => {
      const lit = k < heat;
      const estava = img.classList.contains("is-lit");
      img.classList.toggle("is-lit", lit);
      img.classList.toggle("is-off", !lit);
      if (!animate || !motion) return;
      if (lit && !estava) {
        gsap.fromTo(img,
          { scale: 0.42, y: 16, rotate: -12 },
          { scale: 1, y: 0, rotate: 18, duration: 0.62, ease: "back.out(3)", delay: acendendo++ * 0.075, overwrite: "auto" });
      } else if (!lit && estava) {
        gsap.fromTo(img,
          { scale: 1, y: 0, rotate: 18 },
          { scale: 0.84, y: 4, rotate: 7, duration: 0.24, ease: "power2.in", delay: apagando++ * 0.05, yoyo: true, repeat: 1, overwrite: "auto" });
      }
    });
  }

  /* ---------------------------------------------------------------- pintura */
  function paint(i, animate) {
    const s = SALSAS[i];
    section.style.setProperty("--salsa-bg", s.bg);
    section.style.setProperty("--salsa-ink", s.ink);
    section.style.setProperty("--salsa-hl", s.hl);
    section.style.setProperty("--salsa-ink-40", s.ink40);
    section.style.setProperty("--salsa-ink-12", s.ink12);
    section.classList.toggle("is-hot", s.heat >= MAX);

    options.forEach((b, k) => {
      b.setAttribute("aria-checked", k === i ? "true" : "false");
      b.tabIndex = k === i ? 0 : -1;
    });
    if (descEl) descEl.textContent = s.desc;
    if (meter) meter.setAttribute("aria-label", `Heat level ${s.heat} of ${MAX}`);
    paintHeat(s.heat, animate);
  }

  /* ---------------------------------------------------------------- respingo */
  let splashLayer = null, splashTimer = 0;
  const DX = [-13, 3, 15], DY = [27, 40, 31], DW = [7, 9, 6];
  function splash(s) {
    if (!motion || !s.bowl) return;
    if (splashLayer) { splashLayer.remove(); clearTimeout(splashTimer); }
    const layer = document.createElement("span");
    layer.className = "salsa__splash";
    layer.setAttribute("aria-hidden", "true");
    const ring = document.createElement("i");
    ring.className = "salsa__ring";
    layer.appendChild(ring);
    for (let k = 0; k < 3; k++) {
      const d = document.createElement("i");
      d.className = "salsa__drop";
      d.style.setProperty("--dx", DX[k] + "px");
      d.style.setProperty("--dy", DY[k] + "px");
      d.style.setProperty("--dw", DW[k] + "px");
      d.style.setProperty("--dd", (0.6 + k * 0.1).toFixed(2) + "s");
      d.style.setProperty("--ddelay", (k * 0.055).toFixed(3) + "s");
      layer.appendChild(d);
    }
    s.bowl.appendChild(layer);
    splashLayer = layer;
    splashTimer = setTimeout(() => { layer.remove(); if (splashLayer === layer) splashLayer = null; }, 1100);
  }

  /* ---------------------------------------------------------------- selo "¡Ay!" */
  const NS = "http://www.w3.org/2000/svg";
  const svgEl = (tag, attrs, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    parent && parent.appendChild(n);
    return n;
  };
  let seal = null, sealTimers = [];
  function buildSeal() {
    if (seal) return seal;
    const host = card || section.querySelector(".salsas__card");
    if (!host) return null;
    const svg = svgEl("svg", { class: "salsas__seal", viewBox: "0 0 200 200", "aria-hidden": "true", focusable: "false" });
    const spin = svgEl("g", { class: "seal__spin" }, svg);
    const pts = [], spikes = 16;
    for (let i = 0; i < spikes * 2; i++) {
      const a = (i * Math.PI) / spikes - Math.PI / 2, r = i % 2 ? 76 : 96;
      pts.push(`${(100 + Math.cos(a) * r).toFixed(1)},${(100 + Math.sin(a) * r).toFixed(1)}`);
    }
    svgEl("polygon", { class: "seal__star", points: pts.join(" ") }, spin);
    svgEl("circle", { class: "seal__disc", cx: 100, cy: 100, r: 62 }, svg);
    const t = svgEl("text", { class: "seal__word", x: 100, y: 118, "text-anchor": "middle" }, svg);
    t.textContent = "¡Ay!";
    host.appendChild(svg);
    seal = svg;
    return svg;
  }
  function stamp() {
    const el = buildSeal();
    if (!el) return;
    sealTimers.forEach(clearTimeout);
    sealTimers = [];
    el.classList.remove("is-on", "is-leaving");
    requestAnimationFrame(() => requestAnimationFrame(() => el.classList.add("is-on")));
    sealTimers.push(setTimeout(() => el.classList.add("is-leaving"), 1600));
    sealTimers.push(setTimeout(() => el.classList.remove("is-on", "is-leaving"), 1960));
  }

  /* ---------------------------------------------------------------- tremida
     Só a seção treme (transform curto, limpo no fim) — a página não mexe,
     então o scroll e as medidas do ScrollTrigger continuam de pé. */
  function shake() {
    if (!motion) return;
    gsap.killTweensOf(section);
    section.style.willChange = "transform";
    gsap.fromTo(section, { x: 0, y: 0, rotate: 0 }, {
      ease: "none",
      keyframes: [
        { x: -9, y: 3, rotate: -0.34, duration: 0.06 },
        { x: 8, y: -4, rotate: 0.32, duration: 0.06 },
        { x: -7, y: 3, rotate: -0.24, duration: 0.06 },
        { x: 6, y: -2, rotate: 0.18, duration: 0.06 },
        { x: -3, y: 1, rotate: -0.1, duration: 0.06 },
        { x: 0, y: 0, rotate: 0, duration: 0.1, ease: "power2.out" },
      ],
      onComplete() {
        gsap.set(section, { clearProps: "transform" });
        section.style.willChange = "";
      },
    });
  }

  /* ---------------------------------------------------------------- seleção */
  function select(i, focus) {
    if (i < 0 || i >= SALSAS.length) return;
    if (i === index) { if (focus) options[i].focus(); return; }
    index = i;
    paint(i, true);
    splash(SALSAS[i]);
    if (focus) options[i].focus();
    if (SALSAS[i].heat >= MAX) { shake(); stamp(); }
  }

  picker.addEventListener("click", (e) => {
    const btn = e.target.closest('[role="radio"]');
    if (btn && picker.contains(btn)) select(options.indexOf(btn), false);
  });

  /* setas navegam e selecionam, Home/End vão às pontas (padrão ARIA radiogroup).
     Enter e Espaço não entram aqui: em <button> eles já disparam o click. */
  picker.addEventListener("keydown", (e) => {
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const n = options.length;
    let next = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") next = (index + 1) % n;
    else if (e.key === "ArrowLeft" || e.key === "ArrowUp") next = (index - 1 + n) % n;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = n - 1;
    else return;
    e.preventDefault();
    select(next, true);
  });

  /* estado inicial coerente com o DOM, sem transição e sem piscar */
  paint(index, false);

  /* ================================================================ entrada */
  if (!motion || !ST) return;

  gsap.set(chiles, { rotate: 18, transformOrigin: "50% 82%" });

  const bowls = SALSAS.map((s) => s.bowl).filter(Boolean);
  const names = SALSAS.map((s) => s.name).filter(Boolean);

  /* Reveal sem opacidade: se algo falhar, o pior caso é ficar deslocado,
     nunca invisível. clearProps devolve o transform pro CSS (tilt e wobble). */
  const tl = gsap.timeline({
    scrollTrigger: { trigger: section, start: "top 80%", once: true },
    defaults: { ease: "back.out(1.7)" },
  });
  if (card) tl.from(card, { yPercent: 10, rotate: -7, scale: 0.9, duration: 0.95, clearProps: "transform" }, 0);
  tl.from(bowls, { scale: 0.28, y: 20, duration: 0.7, stagger: 0.07, clearProps: "transform" }, 0.12)
    .from(names, { y: 14, duration: 0.5, ease: "power3.out", stagger: 0.07, clearProps: "transform" }, 0.22)
    .from(chiles.filter((c) => c.classList.contains("is-lit")), { scale: 0.4, y: 12, duration: 0.55, stagger: 0.06 }, 0.34);

  /* failsafe: se o gatilho nunca rodar (refresh perdido), joga pro estado final */
  setTimeout(() => { if (tl.progress() === 0 && !tl.isActive()) tl.progress(1); }, 4200);
})();
