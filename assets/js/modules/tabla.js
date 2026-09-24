/* ==========================================================================
   ¡Buenas! Taquería · módulo "La Tabla"
   O programa de fidelidade virou um tabuleiro de lotería que joga de verdade:
   o visitante marca a carta com FEIJÃO, fecha linha / coluna / diagonal,
   chove papel picado e aparece o cartaz "¡Buenas!".

   Conecta em (já existe no index.html, nada é criado lá):
     #tabla                    seção (position:relative, vem do main.css)
     [data-tabla-board]        grid 3×3 com 9 .tcell (button[aria-pressed])
     [data-tabla-win]          cartaz de vitória (nasce hidden)
     [data-tabla-hint]         dica viva
     [data-tabla-reset]        botão "Play again"
     [data-rewards]            CTA (só ganha um estalo no tabuleiro)
     <path id="bean-path">     o feijão, no sprite SVG do topo do documento

   Sem GSAP ou com prefers-reduced-motion (Buenas.motion === false) o jogo
   CONTINUA funcionando: marca, desmarca, vence e reseta — sem coreografia,
   sem confete, sem tremida. Nada nasce invisível.
   Deps: nenhuma nova. Usa o GSAP/ScrollTrigger que o main.js já registrou.
   ========================================================================== */
(() => {
  "use strict";

  const B = window.Buenas || {};
  const gsap = B.gsap || null;
  const ScrollTrigger = B.ScrollTrigger || null;
  const motion = !!B.motion && !!gsap;
  const finePointer = !!B.finePointer;

  const section = document.getElementById("tabla");
  if (!section) return;
  const board = section.querySelector("[data-tabla-board]");
  const win = section.querySelector("[data-tabla-win]");
  const hint = section.querySelector("[data-tabla-hint]");
  const resetBtn = section.querySelector("[data-tabla-reset]");
  const rewards = section.querySelector("[data-rewards]");
  const cells = board ? [...board.querySelectorAll(".tcell")] : [];
  if (!board || !win || cells.length !== 9) return;

  const SVGNS = "http://www.w3.org/2000/svg";
  const LINES = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  const HINTS = {
    start: "Try it: tap three cards in a row.",
    one: "Good start. Two more and the row is yours.",
    close: "One more…",
    more: "Rows, columns and diagonals all count.",
    win: "¡Buenas! You called a full row.",
  };

  /* tokens: uma fonte da verdade só, o :root do main.css */
  const rootStyle = getComputedStyle(document.documentElement);
  const token = (name, fallback) => (rootStyle.getPropertyValue(name) || "").trim() || fallback;
  /* rosa fora da lista: o fundo da seção é rosa e o confete sumiria nele */
  const PICADO_COLORS = [
    token("--cempa", "#F6A019"),
    token("--cobalto", "#1E3FAF"),
    token("--verde", "#2F7446"),
    token("--maiz", "#F5CD3A"),
    token("--papel-3", "#FBF5EA"),
  ];

  const hasBeanPath = !!document.getElementById("bean-path");
  const rand = (a, b) => a + Math.random() * (b - a);

  /* ---------------------------------------------------------------- estado */
  const marks = new Array(9).fill(false);
  let won = false;
  let winLine = null;
  let userTouched = false;
  let inView = false;
  let demoTl = null;
  let demoDone = false;

  /* ================================================================ o feijão */
  function makeBean(ghost) {
    const svg = document.createElementNS(SVGNS, "svg");
    svg.setAttribute("class", "tbean" + (ghost ? " tbean--ghost" : ""));
    svg.setAttribute("viewBox", "-5 -6 50 36");
    svg.setAttribute("aria-hidden", "true");
    svg.setAttribute("focusable", "false");

    if (hasBeanPath) {
      const shade = document.createElementNS(SVGNS, "use");
      shade.setAttribute("href", "#bean-path");
      shade.setAttribute("class", "tbean__shade");
      shade.setAttribute("transform", "translate(2.4 3)");
      const body = document.createElementNS(SVGNS, "use");
      body.setAttribute("href", "#bean-path");
      body.setAttribute("class", "tbean__body");
      svg.append(shade, body);
    } else {
      /* seguro: se o sprite sumir, o marcador ainda existe */
      const shade = document.createElementNS(SVGNS, "ellipse");
      shade.setAttribute("class", "tbean__shade");
      shade.setAttribute("cx", "22.4"); shade.setAttribute("cy", "14");
      shade.setAttribute("rx", "19"); shade.setAttribute("ry", "11.5");
      const body = document.createElementNS(SVGNS, "ellipse");
      body.setAttribute("class", "tbean__body");
      body.setAttribute("cx", "20"); body.setAttribute("cy", "11");
      body.setAttribute("rx", "19"); body.setAttribute("ry", "11.5");
      svg.append(shade, body);
    }

    const eye = document.createElementNS(SVGNS, "ellipse");
    eye.setAttribute("class", "tbean__eye");
    eye.setAttribute("cx", "19.5"); eye.setAttribute("cy", "14.8");
    eye.setAttribute("rx", "3.4"); eye.setAttribute("ry", "1.5");
    svg.appendChild(eye);
    return svg;
  }

  /* posição e giro levemente aleatórios: nenhum feijão cai igual ao outro.
     O centro vem do `translate` (propriedade CSS independente); o transform
     fica livre pro GSAP, então os dois nunca se atropelam. */
  function placeBean(bean) {
    bean.style.left = (50 + rand(-9, 9)).toFixed(1) + "%";
    bean.style.top = (50 + rand(-7, 7)).toFixed(1) + "%";
    return rand(-38, 38);
  }

  function dropBean(cell, bean, rot) {
    if (!motion) { bean.style.transform = `rotate(${rot.toFixed(1)}deg)`; return null; }
    cell.classList.add("is-busy");
    /* estado inicial aplicado JÁ, de forma síncrona: o feijão nunca pisca
       na posição final antes da queda (vale também pro demo, que tem delay) */
    gsap.set(bean, { willChange: "transform", y: -96, scale: 0.6, rotation: rot - 70, opacity: 0 });
    const tl = gsap.timeline({
      onComplete: () => { cell.classList.remove("is-busy"); gsap.set(bean, { willChange: "auto" }); },
    });
    tl.to(bean, { opacity: 1, duration: 0.1, ease: "none" }, 0)
      /* a queda */
      .to(bean, { y: 0, scale: 1, rotation: rot + 9, duration: 0.29, ease: "power2.in" }, 0)
      /* o baque */
      .to(bean, { scaleX: 1.32, scaleY: 0.66, duration: 0.07, ease: "power2.out" })
      /* o quique */
      .to(bean, { y: -17, scaleX: 0.93, scaleY: 1.12, rotation: rot - 5, duration: 0.16, ease: "power2.out" })
      .to(bean, { y: 0, scaleX: 1.09, scaleY: 0.91, duration: 0.13, ease: "power2.in" })
      .to(bean, { scaleX: 1, scaleY: 1, rotation: rot, duration: 0.52, ease: "elastic.out(1, .5)" });
    return tl;
  }

  /* ================================================== traço da linha vencedora */
  let lineSvg = null, linePaths = null;

  function ensureLineSvg() {
    if (lineSvg) return lineSvg;
    lineSvg = document.createElementNS(SVGNS, "svg");
    lineSvg.setAttribute("class", "tabla__line");
    lineSvg.setAttribute("aria-hidden", "true");
    lineSvg.setAttribute("focusable", "false");
    lineSvg.setAttribute("preserveAspectRatio", "none");
    const back = document.createElementNS(SVGNS, "path");
    back.setAttribute("class", "tabla__line-back");
    back.setAttribute("vector-effect", "non-scaling-stroke");
    back.setAttribute("transform", "translate(2.5 3.5)");   /* a sombra sólida da casa */
    const ink = document.createElementNS(SVGNS, "path");
    ink.setAttribute("class", "tabla__line-ink");
    ink.setAttribute("vector-effect", "non-scaling-stroke");
    lineSvg.append(back, ink);
    board.appendChild(lineSvg);
    linePaths = [back, ink];
    return lineSvg;
  }

  /* geometria medida na CAIXA DE PADDING do tabuleiro, que é o bloco que
     contém o overlay absoluto — daí descontar a borda. */
  function lineGeometry(line) {
    const br = board.getBoundingClientRect();
    const cs = getComputedStyle(board);
    const ox = br.left + (parseFloat(cs.borderLeftWidth) || 0);
    const oy = br.top + (parseFloat(cs.borderTopWidth) || 0);
    const at = (i) => {
      const r = cells[i].getBoundingClientRect();
      return { x: r.left - ox + r.width / 2, y: r.top - oy + r.height / 2 };
    };
    const a = at(line[0]), c = at(line[2]);
    const dx = c.x - a.x, dy = c.y - a.y;
    const len = Math.hypot(dx, dy) || 1;
    const ex = (dx / len) * 11, ey = (dy / len) * 11;      /* ponta passando da carta */
    const x1 = a.x - ex, y1 = a.y - ey, x2 = c.x + ex, y2 = c.y + ey;
    /* leve barriga na perpendicular: traço de mão, não régua */
    const mx = (x1 + x2) / 2 - (dy / len) * 7;
    const my = (y1 + y2) / 2 + (dx / len) * 7;
    return {
      w: board.clientWidth,
      h: board.clientHeight,
      d: `M${x1.toFixed(1)} ${y1.toFixed(1)} Q${mx.toFixed(1)} ${my.toFixed(1)} ${x2.toFixed(1)} ${y2.toFixed(1)}`,
    };
  }

  function paintLine(line, animate) {
    const svg = ensureLineSvg();
    const g = lineGeometry(line);
    svg.setAttribute("viewBox", `0 0 ${g.w} ${g.h}`);
    linePaths.forEach((p) => p.setAttribute("d", g.d));
    svg.hidden = false;
    const L = linePaths[1].getTotalLength() || 1;
    if (!motion || !animate) {
      linePaths.forEach((p) => { p.style.strokeDasharray = "none"; p.style.strokeDashoffset = "0"; });
      return;
    }
    gsap.fromTo(linePaths,
      { strokeDasharray: L, strokeDashoffset: L },
      { strokeDashoffset: 0, duration: 0.5, ease: "power2.out", stagger: 0.04 });
  }

  function hideLine() {
    if (lineSvg) lineSvg.hidden = true;
  }

  /* ====================================================== papel picado (canvas)
     Teto de partículas, um único rAF, morre sozinho e cancela o frame.
     Camada pointer-events:none, nunca bloqueia clique. */
  let picadoCanvas = null, picadoRaf = 0;

  function stopPicado() {
    if (picadoRaf) { cancelAnimationFrame(picadoRaf); picadoRaf = 0; }
    if (picadoCanvas) { picadoCanvas.remove(); picadoCanvas = null; }
  }

  function flagPath(w, h) {
    const p = new Path2D();
    p.moveTo(-w / 2, -h / 2);
    p.lineTo(w / 2, -h / 2);
    p.lineTo(w / 2, h / 2);
    for (let k = 3; k > 0; k--) {                    /* festão: mesma receita do picado do main.js */
      const x0 = -w / 2 + (w / 3) * k;
      const x1 = -w / 2 + (w / 3) * (k - 1);
      p.quadraticCurveTo((x0 + x1) / 2, h / 2 - h * 0.23, x1, h / 2);
    }
    p.closePath();
    const hole = (cx, cy, r) => { p.moveTo(cx + r, cy); p.arc(cx, cy, r, 0, Math.PI * 2); };
    hole(-w * 0.2, -h * 0.16, w * 0.13);             /* furos: evenodd devolve o vazado */
    hole(w * 0.2, -h * 0.16, w * 0.13);
    hole(0, h * 0.06, w * 0.1);
    return p;
  }

  function rainPicado() {
    if (!motion || !inView || document.hidden) return;
    if (typeof Path2D === "undefined") return;
    stopPicado();

    const w = section.clientWidth;
    const h = section.clientHeight;
    if (!w || !h) return;

    const cv = document.createElement("canvas");
    cv.className = "tabla__picado";
    cv.setAttribute("aria-hidden", "true");
    const dpr = Math.min(1.75, window.devicePixelRatio || 1);
    cv.width = Math.round(w * dpr);
    cv.height = Math.round(h * dpr);
    section.appendChild(cv);
    picadoCanvas = cv;

    const ctx = cv.getContext("2d", { alpha: true });
    if (!ctx) { stopPicado(); return; }
    ctx.scale(dpr, dpr);

    const MAX = finePointer ? 84 : 48;               /* teto duro de partículas */
    const FLAG = flagPath(15, 19);
    const STRIP = flagPath(9, 13);
    const ps = [];
    for (let i = 0; i < MAX; i++) {
      ps.push({
        x: rand(-20, w + 20),
        y: -30 - Math.random() * h * 0.7,
        vx: rand(-26, 26),
        vy: rand(110, 250),
        s: rand(0.62, 1.2),
        rot: rand(0, Math.PI * 2),
        vr: rand(-3.4, 3.4),
        ph: rand(0, Math.PI * 2),
        sw: rand(2.2, 4.6),
        c: PICADO_COLORS[i % PICADO_COLORS.length],
        big: i % 3 !== 0,
      });
    }

    const LIFE = 3.8;
    let elapsed = 0;
    let last = performance.now();

    const frame = (now) => {
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt;
      ctx.clearRect(0, 0, w, h);

      let alive = 0;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        p.vy = Math.min(p.vy + 250 * dt, 520);
        p.y += p.vy * dt;
        p.ph += p.sw * dt;
        p.x += p.vx * dt + Math.sin(p.ph) * 30 * dt;
        p.rot += p.vr * dt;
        if (p.y > h + 40) continue;
        alive++;
        if (p.y < -40) continue;

        const flip = Math.cos(p.ph * 1.15);            /* o papel vira de lado */
        if (Math.abs(flip) < 0.06) continue;           /* de perfil: some, como papel mesmo */
        const fade = elapsed > LIFE - 0.8 ? Math.max(0, (LIFE - elapsed) / 0.8) : 1;
        ctx.save();
        ctx.globalAlpha = fade;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rot);
        ctx.scale(p.s * flip, p.s);
        ctx.fillStyle = p.c;
        ctx.fill(p.big ? FLAG : STRIP, "evenodd");
        ctx.restore();
      }

      if (!alive || elapsed > LIFE || document.hidden || !inView) { stopPicado(); return; }
      picadoRaf = requestAnimationFrame(frame);
    };
    picadoRaf = requestAnimationFrame(frame);
  }

  /* ================================================================ dica viva */
  let lastHint = hint ? hint.textContent.trim() : "";
  function paintHint() {
    if (!hint) return;
    let txt;
    if (won) txt = HINTS.win;
    else {
      const n = marks.reduce((a, v) => a + (v ? 1 : 0), 0);
      if (!n) txt = HINTS.start;
      else if (n === 1) txt = HINTS.one;
      else txt = LINES.some((l) => l.reduce((a, i) => a + (marks[i] ? 1 : 0), 0) === 2) ? HINTS.close : HINTS.more;
    }
    if (txt === lastHint) return;
    lastHint = txt;
    hint.textContent = txt;
    hint.classList.toggle("is-win", won);
    if (motion) gsap.fromTo(hint, { y: 9, opacity: 0 }, { y: 0, opacity: 1, duration: 0.34, overwrite: true });
  }

  /* ============================================================ cartaz da vitória
     Ancorado no centro do tabuleiro, medido em tempo real — funciona nas duas
     colunas do desktop e na coluna única do celular. */
  function placeWin() {
    const sr = section.getBoundingClientRect();
    const br = board.getBoundingClientRect();
    win.style.setProperty("--win-x", (br.left - sr.left + br.width / 2).toFixed(1) + "px");
    win.style.setProperty("--win-y", (br.top - sr.top + br.height / 2).toFixed(1) + "px");
  }

  function showWin() {
    const word = win.querySelector(".tabla__win-word");
    if (word && !word.dataset.text) word.dataset.text = word.textContent;
    win.setAttribute("tabindex", "-1");
    placeWin();
    win.hidden = false;
    if (motion) {
      gsap.fromTo(win,
        { scale: 0.68, rotation: -9, y: 26, opacity: 0 },
        { scale: 1, rotation: -2, y: 0, opacity: 1, duration: 0.72, ease: "back.out(1.7)", clearProps: "opacity" });
    }
    try { win.focus({ preventScroll: true }); } catch (e) { /* sem foco, sem drama */ }
  }

  function hideWin(after) {
    if (win.hidden) { after && after(); return; }
    if (!motion) { win.hidden = true; after && after(); return; }
    gsap.to(win, {
      scale: 0.82, y: 14, opacity: 0, duration: 0.28, ease: "power2.in",
      onComplete: () => { win.hidden = true; gsap.set(win, { clearProps: "transform,opacity" }); after && after(); },
    });
  }

  /* ==================================================================== jogo */
  function checkWin() {
    return LINES.find((l) => l.every((i) => marks[i])) || null;
  }

  function lock(state) {
    cells.forEach((c) => { c.disabled = state; });
  }

  function toggle(i) {
    if (won) return;
    userTouched = true;
    if (demoTl) { demoTl.kill(); demoTl = null; }
    section.querySelectorAll(".tbean--ghost").forEach((g) => g.remove());
    cells.forEach((c) => c.classList.remove("is-demo", "is-busy"));

    const cell = cells[i];
    const old = cell.querySelector(".tbean:not(.tbean--ghost)");

    if (marks[i]) {
      marks[i] = false;
      cell.classList.remove("is-marked");
      cell.setAttribute("aria-pressed", "false");
      if (old) {
        if (!motion) old.remove();
        else gsap.to(old, {
          x: rand(-70, 70), y: rand(-110, -60), rotation: rand(-300, 300),
          scale: 0.45, opacity: 0, duration: 0.42, ease: "power2.in",
          onComplete: () => old.remove(),
        });
      }
      paintHint();
      return;
    }

    marks[i] = true;
    cell.classList.add("is-marked");
    cell.setAttribute("aria-pressed", "true");
    if (old) old.remove();
    const bean = makeBean(false);
    const rot = placeBean(bean);
    cell.appendChild(bean);
    dropBean(cell, bean, rot);

    const line = checkWin();
    if (!line) { paintHint(); return; }

    won = true;
    winLine = line;
    line.forEach((k) => cells[k].classList.add("is-win"));
    paintHint();
    lock(true);
    const go = () => { paintLine(line, true); rainPicado(); showWin(); };
    if (motion) gsap.delayedCall(0.42, go); else go();
  }

  function reset() {
    stopPicado();
    hideLine();
    const wasWon = won;
    won = false;
    winLine = null;
    lock(false);

    cells.forEach((cell, i) => {
      marks[i] = false;
      cell.classList.remove("is-marked", "is-win", "is-busy", "is-demo");
      cell.setAttribute("aria-pressed", "false");
      /* querySelectorAll: pode haver um feijão novo e outro ainda saindo de cena */
      cell.querySelectorAll(".tbean").forEach((bean) => {
        if (!motion) { bean.remove(); return; }
        gsap.to(bean, {
          x: rand(-150, 150), y: rand(-230, -130), rotation: rand(-520, 520),
          scale: 0.42, opacity: 0, duration: 0.6, delay: i * 0.028,
          ease: "power2.in", overwrite: true, onComplete: () => bean.remove(),
        });
      });
    });

    paintHint();
    hideWin(() => {
      if (!wasWon) return;
      const first = cells[0];
      if (first) { try { first.focus({ preventScroll: true }); } catch (e) { /* ok */ } }
    });
  }

  /* ========================================================= eventos do tabuleiro */
  board.addEventListener("click", (e) => {
    const cell = e.target.closest(".tcell");
    if (!cell || !board.contains(cell)) return;
    const i = cells.indexOf(cell);
    if (i > -1) toggle(i);
  });

  /* setas andam pelo grid 3×3; Home/End vão pras pontas.
     Todos os botões continuam tabuláveis — a seta é atalho, não substituto. */
  board.addEventListener("keydown", (e) => {
    const i = cells.indexOf(document.activeElement);
    if (i < 0) return;
    const row = Math.floor(i / 3), col = i % 3;
    let next = -1;
    if (e.key === "ArrowRight") next = row * 3 + ((col + 1) % 3);
    else if (e.key === "ArrowLeft") next = row * 3 + ((col + 2) % 3);
    else if (e.key === "ArrowDown") next = ((row + 1) % 3) * 3 + col;
    else if (e.key === "ArrowUp") next = ((row + 2) % 3) * 3 + col;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = 8;
    if (next < 0) return;
    e.preventDefault();
    cells[next].focus();
  });

  resetBtn?.addEventListener("click", (e) => { e.preventDefault(); reset(); });

  /* o CTA dá um estalo no tabuleiro: o clique tem resposta física */
  rewards?.addEventListener("click", () => {
    if (!motion) return;
    gsap.to(board, {
      keyframes: [
        { rotation: -1.3, duration: 0.09 },
        { rotation: 1.3, duration: 0.12 },
        { rotation: 0, duration: 0.38, ease: "elastic.out(1, .45)" },
      ],
      overwrite: "auto",   /* não mata o reveal de entrada, que anima y/opacity */
    });
  });

  /* ============================================== entrada + feijão de demonstração */
  if ("IntersectionObserver" in window) {
    /* seção na tela: só aí o canvas do confete tem permissão de rodar */
    new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        inView = en.isIntersecting;
        if (!inView) stopPicado();
      });
    }, { threshold: 0 }).observe(section);

    /* tabuleiro bem visível: hora de ensinar a mecânica, uma vez só */
    const demoIo = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (!en.isIntersecting) return;
        demoIo.disconnect();
        demo();
      });
    }, { threshold: 0.55 });
    demoIo.observe(board);
  } else {
    inView = true;
  }

  /* um feijão cai sozinho na carta do meio e sai: ensina a mecânica sem marcar */
  function demo() {
    if (!motion || userTouched || demoDone) return;
    const cell = cells[4];
    if (!cell || marks[4]) return;
    demoDone = true;
    const bean = makeBean(true);
    const rot = placeBean(bean);
    cell.appendChild(bean);
    cell.classList.add("is-demo");
    /* espera o reveal das cartas assentar antes de ensinar */
    demoTl = gsap.timeline({ delay: 1.2 });
    const drop = dropBean(cell, bean, rot);   /* já esconde o feijão de forma síncrona */
    if (drop) demoTl.add(drop, 0);
    demoTl.to(bean, {
      y: -54, scale: 0.4, rotation: rot + 150, opacity: 0, duration: 0.45, ease: "power2.in",
    }, "+=0.95")
      .add(() => { bean.remove(); cell.classList.remove("is-demo"); demoTl = null; });
  }

  if (motion && ScrollTrigger) {
    gsap.from(board, {
      y: 46, opacity: 0, duration: 0.8,
      scrollTrigger: { trigger: board, start: "top 90%", once: true },
    });
    gsap.from(cells, {
      opacity: 0, scale: 0.7, y: -22,
      rotation: () => rand(-14, 14),
      duration: 0.72, ease: "back.out(1.6)",
      stagger: { each: 0.05, from: "center", grid: [3, 3] },
      scrollTrigger: { trigger: board, start: "top 86%", once: true },
      onComplete() { gsap.set(cells, { clearProps: "transform,opacity" }); },
    });
  }

  /* ============================================================== manutenção */
  if (hint) hint.setAttribute("aria-live", "polite");

  let rsT = 0;
  addEventListener("resize", () => {
    clearTimeout(rsT);
    rsT = setTimeout(() => {
      if (!won) return;
      if (winLine) paintLine(winLine, false);
      if (!win.hidden) placeWin();
    }, 180);
  }, { passive: true });

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) stopPicado();
  }, { passive: true });
})();
