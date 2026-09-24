/* ¡Buenas! Taquería · módulo: abertura (loader)
   Roda depois do main.js. Coreografia de 1,88s, uma vez por sessão:
     1. o monte de 3 cartas embaralha (riffle) e abre em leque, caindo na mesa
        com quique;
     2. as cartas viram (flip 3D) mostrando El Pastor, La Birria e El Cazo;
     3. "¡BUENAS!" bate na tela — o eixo de largura da Anybody estica de 52 pra
        132 e assenta em 94, com esmagamento no impacto — e os feijões dos
        pingos (¡ e !) caem e quicam, junto com feijões soltos;
     4. a cortina de papel recortado sobe e revela o hero.
   Fecha SEMPRE com Buenas.markFired("intro:done").

   Performance: nenhum listener de scroll, tudo no ticker do GSAP; will-change
   ligado por classe e liberado quando o nó é removido; scroll travado via
   lenis.stop() + overflow hidden; failsafe por setTimeout derruba a abertura
   mesmo se o GSAP engasgar (aba em segundo plano, por exemplo). */
(() => {
  "use strict";

  const doc = document.documentElement;
  const loader = document.getElementById("loader");
  const B = window.Buenas;
  const KEY = "buenas:intro";

  /* --------------------------------------------------------- saídas rápidas */
  if (!loader) { B && B.markFired("intro:done"); return; }

  /* Esconde sem flash: síncrono, antes de qualquer pintura. */
  const skip = () => {
    doc.classList.add("no-intro");
    loader.remove();
    B && B.markFired("intro:done");
  };

  if (!B || !B.gsap || !B.motion || B.reduced) { skip(); return; }

  let seen = false;
  try { seen = sessionStorage.getItem(KEY) === "1"; } catch (e) { /* storage bloqueado */ }

  /* Link direto pra uma seção não merece abertura: o visitante já sabe onde vai. */
  const deep = location.hash && location.hash !== "#" && location.hash !== "#top";

  if (seen || deep) { skip(); return; }

  const gsap = B.gsap;
  const cards = [...loader.querySelectorAll(".loader__card")];
  const deck = loader.querySelector(".loader__deck");
  const word = loader.querySelector(".loader__word");
  if (!cards.length || !deck || !word) { skip(); return; }

  /* ------------------------------------------------------------ easings dos
     tokens: lê o cubic-bezier direto do CSS pra não haver curva solta no JS. */
  const cs = getComputedStyle(doc);
  const bez = (name, fallback) => {
    const v = (cs.getPropertyValue(name) || "").trim();
    const m = v.match(/cubic-bezier\(([^)]+)\)/);
    return m ? m[1] : fallback;
  };
  const CE = window.CustomEase;
  const mk = (id, token, fallbackCurve, fallbackEase) => {
    if (!CE) return fallbackEase;
    try { CE.create(id, bez(token, fallbackCurve)); return id; } catch (e) { return fallbackEase; }
  };
  const easeMain = mk("buenas", "--ease", ".625,.05,0,1", "power3.inOut");      /* --ease */
  const easeSlot = mk("slot", "--ease-slot", ".5,0,0,1", "power4.out");          /* --ease-slot */
  const easeBack = mk("buenasBack", "--ease-back", ".34,1.56,.64,1", "back.out(1.7)"); /* --ease-back */

  /* ---------------------------------------------------------------- montagem
     A frente da carta não existe no HTML (só a arte). Monta aqui a mesma
     anatomia do .lcard do main.css: moldura + número + arte + nome. */
  const CARDS = {
    "el-pastor": ["01", "El Pastor"],
    "la-birria": ["02", "La Birria"],
    "el-cazo": ["03", "El Cazo"],
  };
  const titleize = (slug) => slug.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");

  cards.forEach((card, i) => {
    const img = card.querySelector("img");
    const file = img ? (img.getAttribute("src") || "").split("/").pop() : "";
    const slug = file.replace(/-\d+\.\w+$/, "").replace(/\.\w+$/, "");
    const meta = CARDS[slug] || [String(i + 1).padStart(2, "0"), slug ? titleize(slug) : "¡Buenas!"];

    const face = document.createElement("span");
    face.className = "loader__face";
    face.innerHTML =
      '<span class="loader__frame">' +
        '<span class="loader__num">No.<b>' + meta[0] + "</b></span>" +
        '<span class="loader__art"></span>' +
        '<span class="loader__name">' + meta[1] + "</span>" +
      "</span>";
    if (img) face.querySelector(".loader__art").appendChild(img);
    card.appendChild(face);
  });

  /* -------------------------------------------------------- feijões soltos
     Reaproveita o #bean-path que já está nos <defs> do documento. Se o path
     não existir, a abertura roda sem eles (nada quebra). */
  const NS = "http://www.w3.org/2000/svg";
  const TINTS = ["rosa", "maiz", "verde", "cempa"];
  let beans = [];
  let beansBox = null;

  if (document.getElementById("bean-path")) {
    beansBox = document.createElement("div");
    beansBox.className = "loader__beans";
    beansBox.setAttribute("aria-hidden", "true");
    beans = TINTS.map((tint) => {
      const b = document.createElement("i");
      b.className = "loader__bean";
      b.dataset.tint = tint;
      const svg = document.createElementNS(NS, "svg");
      svg.setAttribute("viewBox", "-2 -4 46 32");
      const sh = document.createElementNS(NS, "use");
      sh.setAttribute("href", "#bean-path");
      sh.setAttribute("class", "sh");
      sh.setAttribute("x", "2.6");
      sh.setAttribute("y", "2.6");
      const top = document.createElementNS(NS, "use");
      top.setAttribute("href", "#bean-path");
      svg.appendChild(sh);
      svg.appendChild(top);
      b.appendChild(svg);
      beansBox.appendChild(b);
      return b;
    });
    loader.appendChild(beansBox);
  }

  /* -------------------------------------------------------------- geometria
     Uma medida só, antes de o loader ficar visível. */
  const cw = cards[0].getBoundingClientRect().width || 120;
  const dw = deck.getBoundingClientRect().width || innerWidth;
  const spread = Math.max(58, Math.min(cw * 1.02, (dw - cw) / 2 - 6));

  const REST_R = [-3.5, 1, 4];                        /* monte fechado, leve bagunça */
  const RIFF_X = [-cw * 0.26, cw * 0.15, -cw * 0.09];
  const RIFF_Y = [-cw * 0.14, -cw * 0.22, -cw * 0.08];
  const RIFF_R = [-11, 6.5, -4];
  const FAN_X = [-spread, 0, spread];
  const FAN_Y = [spread * 0.13, -spread * 0.06, spread * 0.13];
  const FAN_R = [-14, 1.5, 14];

  if (beansBox) {
    const wr = word.getBoundingClientRect();
    const lr = loader.getBoundingClientRect();
    beansBox.style.left = (wr.left - lr.left + wr.width / 2).toFixed(1) + "px";
    beansBox.style.top = (wr.top - lr.top + wr.height * 0.84).toFixed(1) + "px";
  }
  const BEAN_X = [-spread * 0.82, -spread * 0.33, spread * 0.37, spread * 0.86];
  const BEAN_UP = [-spread * 0.42, -spread * 0.58, -spread * 0.54, -spread * 0.36];
  const BEAN_DN = [spread * 0.17, spread * 0.21, spread * 0.19, spread * 0.14];
  const BEAN_R = [-165, 120, -135, 190];

  const excls = [...word.querySelectorAll(".excl")];

  /* --------------------------------------------------------- estado inicial */
  gsap.set(cards, {
    xPercent: -50, yPercent: -50,
    x: 0, y: 0,
    rotateY: 180, rotate: (i) => REST_R[i],
    scale: 0.9,
    transformOrigin: "50% 50%",
  });
  gsap.set(excls, { yPercent: -420, rotate: (i) => (i ? 16 : -16) });
  if (beans.length) gsap.set(beans, { xPercent: -50, yPercent: -50, x: 0, y: 0, scale: 0.35, rotate: 0, opacity: 0 });

  loader.classList.add("is-ready");

  /* -------------------------------------------------------------- trava tudo
     Marca a sessão AGORA, não no fim: quem sair no meio da abertura também não
     vê ela de novo ao voltar. */
  try { sessionStorage.setItem(KEY, "1"); } catch (e) { /* noop */ }
  try { window.scrollTo(0, 0); } catch (e) { /* noop */ }
  B.lenis && B.lenis.stop();
  document.body.style.overflow = "hidden";

  /* ------------------------------------------------------------- encerramento
     Idempotente: onComplete, failsafe e qualquer erro caem todos aqui. */
  let done = false;
  let tl = null;
  const killer = setTimeout(() => finish(), 2400);

  function finish() {
    if (done) return;
    done = true;
    clearTimeout(killer);
    removeEventListener("keydown", onKey);
    try { tl && tl.kill(); } catch (e) { /* noop */ }
    loader.remove();
    document.body.style.overflow = "";
    B.lenis && B.lenis.start();
    B.markFired("intro:done");
    B.ScrollTrigger && B.ScrollTrigger.refresh();
  }

  /* Quem já viu não precisa ver de novo: toque ou tecla acelera 3,4x. */
  const hurry = () => { if (tl) tl.timeScale(3.4); };
  const onKey = (e) => { if (e.key === "Escape" || e.key === " " || e.key === "Enter") hurry(); };
  loader.addEventListener("pointerdown", hurry, { passive: true });
  addEventListener("keydown", onKey, { passive: true });

  /* ------------------------------------------------------------- coreografia */
  const T = {
    riffle: 0.00,
    fan: 0.26,
    flip: 0.54,
    word: 0.82,
    excl: 0.88,
    beans: 0.88,
    out: 1.40,
    curtain: 1.48,
    fire: 1.56,
  };

  try {
    tl = gsap.timeline({ onComplete: finish });

    /* 1 · embaralha: as cartas saltam do monte e voltam a encaixar */
    tl.to(cards, {
      x: (i) => RIFF_X[i], y: (i) => RIFF_Y[i], rotate: (i) => RIFF_R[i],
      duration: 0.15, stagger: 0.04, ease: "power2.out",
    }, T.riffle)
      .to(cards, {
        x: 0, y: 0, rotate: (i) => REST_R[i],
        duration: 0.18, stagger: 0.04, ease: easeMain,
      }, T.riffle + 0.15);

    /* 2 · abre em leque, com o overshoot do --ease-back */
    tl.to(cards, {
      x: (i) => FAN_X[i], y: (i) => FAN_Y[i], rotate: (i) => FAN_R[i], scale: 1,
      duration: 0.58, stagger: 0.06, ease: easeBack,
    }, T.fan);

    /* 3 · viram e batem na mesa: mergulho curto + quique */
    tl.to(cards, { rotateY: 0, duration: 0.46, stagger: 0.07, ease: easeSlot }, T.flip)
      .to(cards, {
        y: (i) => FAN_Y[i] + cw * 0.075, scale: 1.05,
        duration: 0.13, stagger: 0.07, ease: "power2.in",
      }, T.flip + 0.30)
      .to(cards, {
        y: (i) => FAN_Y[i],
        duration: 0.34, stagger: 0.07, ease: "bounce.out",
      }, T.flip + 0.43)
      .to(cards, { scale: 1, duration: 0.3, stagger: 0.07, ease: easeBack }, T.flip + 0.43);

    /* 4 · o grito: chega grande, esmaga no impacto e volta ao lugar.
       Tudo em transform. Animar o eixo de largura da fonte num texto do
       tamanho da tela reflui a linha inteira a cada quadro: some com a nota de
       performance e faz a página pular. O transform faz o mesmo efeito de
       graça, na placa de vídeo. */
    tl.fromTo(word,
      { opacity: 0, scaleX: 0.86, scaleY: 1.5 },
      { opacity: 1, scaleX: 1.24, scaleY: 1.02, duration: 0.28, ease: "power4.out" }, T.word)
      .to(word, { scaleY: 0.84, scaleX: 1.32, duration: 0.08, ease: "power2.in" }, T.word + 0.28)
      .to(word, { scaleY: 1, scaleX: 1, duration: 0.46, ease: "elastic.out(1, .55)" }, T.word + 0.36);

    /* 5 · os feijões dos pingos caem e quicam */
    tl.to(excls, {
      yPercent: 0, rotate: 0,
      duration: 0.46, stagger: 0.09, ease: "bounce.out",
    }, T.excl);

    /* 6 · feijões soltos: arco pra fora e quique no chão */
    if (beans.length) {
      tl.to(beans, {
        x: (i) => BEAN_X[i], rotate: (i) => BEAN_R[i], scale: 1, opacity: 1,
        duration: 0.44, stagger: 0.04, ease: "power2.out",
      }, T.beans)
        .to(beans, {
          y: (i) => BEAN_UP[i], duration: 0.22, stagger: 0.04, ease: "power2.out",
        }, T.beans)
        .to(beans, {
          y: (i) => BEAN_DN[i], duration: 0.34, stagger: 0.04, ease: "bounce.out",
        }, T.beans + 0.22);
    }

    /* 7 · saída: o conteúdo sobe e some, a cortina recortada sobe atrás */
    tl.to([deck, word], {
      y: -54, scale: 0.94, opacity: 0,
      duration: 0.28, ease: "power2.in", overwrite: "auto",
    }, T.out);
    if (beans.length) tl.to(beans, { opacity: 0, duration: 0.2, ease: "none" }, T.out);

    tl.add(() => loader.classList.add("is-leaving"), T.curtain - 0.02)
      .to(loader, { yPercent: -100, duration: 0.40, ease: easeMain }, T.curtain)
      /* dispara com a cortina no meio do caminho: o hero já entra em movimento
         antes de ficar visível, e a emenda some. */
      .add(() => B.markFired("intro:done"), T.fire);
  } catch (e) {
    console.error("[loader]", e);
    finish();
  }
})();
