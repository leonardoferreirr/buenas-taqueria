/* ¡Buenas! Taquería · módulo ANATOMY
   Vista explodida do taco al pastor. A seção prende na tela e o scroll monta o
   diagrama em 6 passos: o taco se abre, cada ingrediente sai pro seu canto,
   as linhas-guia se desenham do taco até a peça e até a legenda do passo.

   Três garantias:
   1. Sem GSAP ou com prefers-reduced-motion, este arquivo não faz nada — o
      main.css já entrega taco + ingredientes + 6 passos visíveis e legíveis.
   2. O fim da linha do tempo É o estado natural do CSS (x:0, y:0, scale:1).
      Qualquer falha no meio do caminho aterrissa numa seção correta.
   3. Toda medida sai de offsetLeft/offsetTop/clientWidth, que ignoram
      transform — então medir no meio do scrub e no resize dá o mesmo valor. */
(() => {
  const B = window.Buenas;
  const section = document.getElementById("anatomy");
  if (!B || !B.motion || !section) return;

  const pinEl = section.querySelector("[data-anatomy-pin]");
  const stage = section.querySelector("[data-anatomy-stage]");
  const svg = section.querySelector("[data-anatomy-lines]");
  const list = section.querySelector("[data-anatomy-steps]");
  const taco = section.querySelector(".anatomy__taco");
  const parts = [...section.querySelectorAll(".anatomy__part")];
  const items = list ? [...list.children] : [];
  if (!pinEl || !stage || !svg || !taco || parts.length < 4 || items.length < 6) return;

  const { gsap, ScrollTrigger } = B;

  /* ---------------------------------------------------------------- receita */
  const STEPS = 6;
  const SPAN = STEPS + 0.35;                      // 1 unidade = 1 passo, + respiro no fim
  const PART_OF = [-1, -1, 0, 1, 2, 3];           // passo → peça (0 tortilla e 1 trompo são o próprio taco)
  /* pra onde cada peça se recolhe (fração do palco) + giro do recolhimento */
  const TUCK = [[-.04, .03, -34], [.05, .04, 29], [-.03, -.04, 31], [.04, -.03, -27]];
  /* os dois passos que apontam pro taco: origem e ponta, em fração do raio */
  const ON_TACO = [{ a: [-.06, .47], b: [-.02, .2] }, { a: [.06, -.45], b: [.02, -.11] }];

  /* easings do token-lock, não curvas soltas:
     --ease      cubic-bezier(.625,.05,0,1)  → CustomEase "buenas" (main.js)
     --ease-back cubic-bezier(.34,1.56,.64,1) → back.out(1.7)
     "none" onde o movimento é preso ao scroll (parallax), que é linear de propósito. */
  const E = {
    main: window.CustomEase ? "buenas" : "power3.out",
    back: "back.out(1.7)",
  };

  const NS = "http://www.w3.org/2000/svg";
  const mk = (tag, attrs, parent) => {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    parent && parent.appendChild(n);
    return n;
  };
  const r1 = (v) => Math.round(v * 10) / 10;

  /* ---------------------------------------------------------------- medida */
  const geo = { w: 0, h: 0, part: [], call: [] };

  function measure() {
    const w = stage.clientWidth, h = stage.clientHeight;
    if (!w || !h) return false;
    geo.w = w; geo.h = h;
    const cx = w / 2, cy = h / 2, rad = Math.min(w, h);

    geo.part = parts.map((el, i) => {
      const x = el.offsetLeft + el.offsetWidth / 2;
      const y = el.offsetTop + el.offsetHeight / 2;
      const t = TUCK[i] || [0, 0, 0];
      return { x, y, dx: cx + t[0] * w - x, dy: cy + t[1] * h - y, spin: t[2] };
    });

    geo.call.length = 0;
    for (let s = 0; s < STEPS; s++) {
      const p = PART_OF[s];
      let ax, ay, bx, by;
      if (p < 0) {                                 // chamada apontando pro próprio taco
        const c = ON_TACO[s];
        ax = cx + c.a[0] * rad; ay = cy + c.a[1] * rad;
        bx = cx + c.b[0] * rad; by = cy + c.b[1] * rad;
      } else {                                     // do contorno do taco até a peça
        const t = geo.part[p];
        const vx = t.x - cx, vy = t.y - cy, len = Math.hypot(vx, vy) || 1;
        /* .28/.235 segue o formato do taco (mais largo que alto); .87 encosta
           a bolinha na peça sem passar dela — conferido em palco de 500px */
        ax = cx + (vx / len) * rad * .28; ay = cy + (vy / len) * rad * .235;
        bx = cx + vx * .87; by = cy + vy * .87;
      }
      /* número na perpendicular da linha, do lado mais longe do centro */
      const ux = bx - ax, uy = by - ay, len2 = Math.hypot(ux, uy) || 1;
      const nx = (-uy / len2) * 17, ny = (ux / len2) * 17;
      const side = (bx + nx - cx) ** 2 + (by + ny - cy) ** 2 >= (bx - nx - cx) ** 2 + (by - ny - cy) ** 2 ? 1 : -1;
      geo.call.push({ ax, ay, bx, by, lx: bx + nx * side, ly: by + ny * side });
    }
    return true;
  }

  /* ---------------------------------------------------------------- desenho */
  let dom = null;

  function buildSvg() {
    svg.textContent = "";
    const leader = mk("path", { class: "aleader", pathLength: 1 }, svg);
    const marks = mk("path", { class: "amark", pathLength: 1 }, svg);
    const line = [], dot = [], tag = [], num = [];
    for (let s = 0; s < STEPS; s++) {
      line.push(mk("path", { class: "aline", pathLength: 1 }, svg));
      const g = mk("g", { class: "acall" }, svg);
      dot.push(mk("circle", { class: "adot adot--" + (s % 5), r: 5 }, g));
      const t = mk("text", { class: "anum", "text-anchor": "middle", dy: ".34em" }, g);
      t.textContent = String(s + 1).padStart(2, "0");
      num.push(t); tag.push(g);
    }
    dom = { leader, marks, line, dot, tag, num };
  }

  function paint() {
    if (!dom) return;
    const { w, h } = geo, o = 9, a = 18;
    svg.setAttribute("viewBox", `0 0 ${w} ${h}`);
    dom.marks.setAttribute("d",
      `M${-o} ${a - o}V${-o}H${a - o}` +
      `M${w + o - a} ${-o}H${w + o}V${a - o}` +
      `M${w + o} ${h + o - a}V${h + o}H${w + o - a}` +
      `M${a - o} ${h + o}H${-o}V${h + o - a}`);
    geo.call.forEach((c, s) => {
      dom.line[s].setAttribute("d", `M${r1(c.ax)} ${r1(c.ay)}L${r1(c.bx)} ${r1(c.by)}`);
      dom.dot[s].setAttribute("cx", r1(c.bx));
      dom.dot[s].setAttribute("cy", r1(c.by));
      dom.num[s].setAttribute("x", r1(c.lx));
      dom.num[s].setAttribute("y", r1(c.ly));
    });
  }

  /* linha fina até a legenda: só quando os passos estão ao lado do palco */
  function leaderPath(s) {
    const li = items[s];
    if (!li || !geo.call[s]) return null;
    const sr = stage.getBoundingClientRect(), lr = li.getBoundingClientRect();
    if (lr.left < sr.right + 6) return null;      // no celular a lista fica embaixo: sem linha
    const bend = geo.w + 14;
    const endX = lr.left - sr.left - 9;
    const endY = lr.top - sr.top + Math.min(24, lr.height / 2);
    if (endX < bend + 8) return null;
    const c = geo.call[s];
    return `M${r1(c.bx)} ${r1(c.by)}L${bend} ${r1(c.by)}L${bend} ${r1(endY)}L${r1(endX)} ${r1(endY)}`;
  }

  function drawLeader(s) {
    if (!dom) return;
    const d = leaderPath(s);
    gsap.killTweensOf(dom.leader);
    if (!d) { gsap.set(dom.leader, { autoAlpha: 0 }); return; }
    dom.leader.setAttribute("d", d);
    gsap.fromTo(dom.leader,
      { strokeDashoffset: 1, autoAlpha: 1 },
      { strokeDashoffset: 0, duration: .5, ease: E.main, overwrite: true });
  }

  /* ---------------------------------------------------------------- passo ativo */
  let active = -1;
  function setActive(s) {
    if (s === active) return;
    active = s;
    for (let i = 0; i < items.length; i++) items[i].classList.toggle("is-on", i === s);
    drawLeader(s);
  }
  const track = (self) => setActive(Math.min(STEPS - 1, Math.max(0, Math.floor(self.progress * SPAN + .35))));

  /* ---------------------------------------------------------------- coreografia
     Valores de origem são funções: com invalidateOnRefresh o GSAP relê a medida
     nova a cada refresh, então resize e troca de fonte não desalinham nada. */
  function fill(tl) {
    tl.fromTo(taco,
      { scale: .84, rotation: -11 },
      { scale: 1, rotation: -4, duration: 1, ease: E.main }, 0)
      .to(taco, { scale: 1.03, rotation: -1.5, duration: SPAN - 1, ease: "none" }, 1)
      .fromTo(dom.marks, { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: .85, ease: "none" }, .05);

    for (let s = 0; s < STEPS; s++) {
      const p = PART_OF[s];
      if (p >= 0) {
        tl.fromTo(parts[p],
          {
            x: () => geo.part[p].dx, y: () => geo.part[p].dy,
            rotation: () => geo.part[p].spin, scale: .28, opacity: .45,
          },
          { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1, duration: .95, ease: E.back }, s);
      }
      tl.fromTo(dom.line[s], { strokeDashoffset: 1 }, { strokeDashoffset: 0, duration: .6, ease: E.main }, s + .2)
        .fromTo(dom.tag[s], { opacity: 0 }, { opacity: 1, duration: .3, ease: E.main }, s + .6)
        .fromTo(dom.dot[s], { scale: 0 }, { scale: 1, duration: .5, ease: E.back }, s + .6);
    }
    tl.to({}, { duration: .35 }, STEPS);          // respiro antes de soltar o pin
  }

  function reset() {
    stage.classList.remove("is-live");
    section.classList.remove("is-pinned");
    list.classList.remove("is-seq");
    items.forEach((li) => li.classList.remove("is-on"));
    active = -1;
    if (dom) { gsap.killTweensOf(dom.leader); gsap.set(dom.leader, { clearProps: "all" }); }
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) { svg.textContent = ""; dom = null; }
  }

  /* ---------------------------------------------------------------- montagem */
  const mm = gsap.matchMedia();
  const NO_REDUCE = " and (prefers-reduced-motion: no-preference)";

  /* desktop e tablet: seção presa, 6 beats de scroll */
  mm.add("(min-width: 761px)" + NO_REDUCE, () => {
    section.classList.add("is-pinned");          // muda o palco: entra ANTES de medir
    if (!dom) buildSvg();
    if (!measure()) return reset;
    paint();
    list.classList.add("is-seq");                // só apaga os outros passos com tudo montado

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: pinEl,
        start: "top top",
        end: () => "+=" + Math.round(innerHeight * 1.8),
        pin: pinEl,
        pinSpacing: true,
        anticipatePin: 1,
        scrub: .55,
        invalidateOnRefresh: true,
        onRefreshInit: measure,
        onRefresh: () => { measure(); paint(); if (active >= 0) drawLeader(active); },
        onUpdate: track,
        onToggle: (self) => stage.classList.toggle("is-live", self.isActive),
      },
    });
    fill(tl);
    setActive(0);
    return reset;
  });

  /* celular: mesma coreografia, sem pin — o toque nunca fica preso */
  mm.add("(max-width: 760px)" + NO_REDUCE, () => {
    if (!dom) buildSvg();
    if (!measure()) return reset;
    paint();

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: stage,
        start: "top 88%",
        end: "bottom 30%",                         /* ~140px de scroll por passo num 390x844 */
        scrub: .5,
        invalidateOnRefresh: true,
        onRefreshInit: measure,
        onRefresh: () => { measure(); paint(); },
        onUpdate: track,
        onToggle: (self) => stage.classList.toggle("is-live", self.isActive),
      },
    });
    fill(tl);

    /* passos entram um a um e FICAM legíveis (sem apagar os outros no celular).
       immediateRender:false: se o gatilho nunca disparar, ninguém some. */
    gsap.fromTo(items,
      { opacity: 0, y: 16 },
      {
        opacity: 1, y: 0, duration: .6, stagger: .07, immediateRender: false,
        scrollTrigger: { trigger: list, start: "top 88%", once: true },
      });

    setActive(0);
    return reset;
  });

  /* ---------------------------------------------------------------- refresh
     Imagens são lazy: quando chegarem, remede tudo uma vez só. */
  let rt;
  const soon = () => { clearTimeout(rt); rt = setTimeout(() => ScrollTrigger.refresh(), 120); };
  [taco, ...parts].forEach((img) => {
    if (!img.complete) img.addEventListener("load", soon, { once: true, passive: true });
  });
  (document.fonts?.ready || Promise.resolve()).then(soon);
})();
