/* ¡Buenas! Taquería · módulo: O BARALHO
   1. distribuição: as 8 cartas saem de um monte no centro e se espalham até a
      posição real do grid, no scroll (scrub, sem pin). FLIP-like: o layout
      nunca muda, só transform a partir da posição medida.
   2. virar: hover no ponteiro fino (CSS) + clique/toque/teclado aqui.
   3. celular: grid de 2 colunas com cascata por lote, sem sequestrar o scroll.
   4. acabamento: sombra que segue a inclinação e a carta campeã acesa.
   Sem movimento (reduced-motion ou sem GSAP): o grid nasce correto e estático. */
(() => {
  const B = window.Buenas;
  const stage = document.querySelector("[data-deck-stage]");
  if (!B || !stage) return;

  const cards = [...stage.querySelectorAll("[data-card]")];
  if (!cards.length) return;

  /* ---------------------------------------------------------------- virar
     Um listener delegado. O alvo é um <button>, então Enter e Espaço já
     disparam click: teclado funciona sem nenhum handler extra. */
  stage.addEventListener("click", (e) => {
    const btn = e.target.closest(".lcard__flip");
    if (!btn || !stage.contains(btn)) return;
    const card = btn.closest("[data-card]");
    if (!card) return;
    const on = !card.classList.contains("is-flipped");
    card.classList.toggle("is-flipped", on);
    btn.setAttribute("aria-pressed", String(on));
  });

  /* ------------------------------------------------------- carta campeã
     El Pastor, No. 01. O brilho de foil só roda com a carta na tela. */
  const champ = cards.find((c) => (c.querySelector(".lcard__num b")?.textContent || "").trim() === "01");
  if (champ) {
    champ.classList.add("is-champ");
    if (B.motion && "IntersectionObserver" in window) {
      new IntersectionObserver(
        ([en]) => champ.classList.toggle("is-lit", en.isIntersecting),
        { threshold: 0.22 }
      ).observe(champ);
    }
  }

  /* ================================================================ movimento
     A partir daqui é só enfeite. Sem isso o baralho continua inteiro. */
  if (!B.motion || !B.gsap || !B.ScrollTrigger) return;
  const { gsap, ScrollTrigger } = B;
  const ease = window.CustomEase ? "slot" : "power2.inOut";

  /* ângulo de repouso de cada carta: vem do CSS (--rest), pra não existir
     valor solto no JS e pra bater com o estado sem movimento */
  const rest = cards.map((c) => parseFloat(getComputedStyle(c).getPropertyValue("--rest")) || 0);

  /* monte: deslocamento e giro de cada carta empilhada, em ordem de dealer */
  const PILE = [
    { dx: -7, dy: -5, rot: -14 },
    { dx: 8, dy: 3, rot: 11 },
    { dx: -3, dy: 7, rot: -6 },
    { dx: 11, dy: -4, rot: 17 },
    { dx: -10, dy: 2, rot: -9 },
    { dx: 5, dy: 8, rot: 6 },
    { dx: -6, dy: -7, rot: -18 },
    { dx: 9, dy: 5, rot: 13 },
  ];

  /* posição do monte em relação ao lugar final da carta.
     offsetLeft/offsetTop são valores de LAYOUT: não sofrem com o transform
     que o GSAP já aplicou, então remedir no refresh é sempre confiável. */
  const pileOf = (i) => {
    const card = cards[i];
    const p = PILE[i % PILE.length];
    return {
      x: stage.clientWidth / 2 - (card.offsetLeft + card.offsetWidth / 2) + p.dx,
      y: stage.clientHeight / 2 - (card.offsetTop + card.offsetHeight / 2) + p.dy,
    };
  };

  const mm = gsap.matchMedia();

  /* --------------------------------------------- desktop e tablet: o monte abre
     760.02px é o complemento exato do (max-width: 760px) do CSS: em tela
     fracionada (760.5px) nenhuma das duas consultas pode ficar de fora. */
  mm.add("(min-width: 760.02px)", () => {
    stage.classList.add("is-deal");
    let dealt = false;
    const setDealt = (v) => {
      if (v === dealt) return;
      dealt = v;
      stage.classList.toggle("is-dealt", v);
    };

    const tl = gsap.timeline({
      scrollTrigger: {
        trigger: stage,
        start: () => "top " + Math.round(innerHeight * 0.92),
        end: () => "top " + Math.round(innerHeight * 0.3),
        scrub: 0.55,
        invalidateOnRefresh: true,
        /* .is-live liga o will-change só enquanto a faixa está ativa */
        onToggle: (self) => stage.classList.toggle("is-live", self.isActive),
        onUpdate: (self) => setDealt(self.progress > 0.93),
        onLeave: () => setDealt(true),
        onLeaveBack: () => setDealt(false),
        /* cobre o carregamento já rolado abaixo da seção: sem isso as cartas
           ficariam presas no estado "distribuindo" e o hover não viraria */
        onRefresh: (self) => setDealt(self.progress > 0.93),
      },
    });

    cards.forEach((card, i) => {
      const p = PILE[i % PILE.length];
      tl.fromTo(
        card,
        {
          x: () => pileOf(i).x,
          y: () => pileOf(i).y,
          rotation: p.rot,
          scale: 1.06,
          "--sx": (p.rot * 0.9).toFixed(1) + "px",
        },
        {
          x: 0,
          y: 0,
          rotation: rest[i],
          scale: 1,
          "--sx": (rest[i] * 0.9).toFixed(1) + "px",
          duration: 1,
          ease,
          /* 2D puro: translate3d no pai de um preserve-3d achata a virada no
             Safari. A promoção de camada vem do will-change no deck.css. */
          force3D: false,
        },
        i * 0.14
      );
    });

    /* profundidade de "carta no ar", uma escrita por frame no palco inteiro */
    tl.fromTo(stage, { "--lift": 1 }, { "--lift": 0, duration: tl.duration(), ease: "power1.out" }, 0);

    return () => stage.classList.remove("is-deal", "is-live", "is-dealt");
  });

  /* --------------------------------------------------------- celular: cascata
     Por que grid e não carrossel: o baralho precisa ler como TABLA de lotería,
     e faixa horizontal com snap dentro de página vertical rouba o gesto
     diagonal. O grid nunca briga com o scroll da página. As cartas caem de
     duas em duas, com o mesmo empurrão lateral do monte do desktop. */
  mm.add("(max-width: 760px)", () => {
    const triggers = ScrollTrigger.batch(cards, {
      start: "top 94%",
      once: true,
      batchMax: 2,
      interval: 0.08,
      onEnter: (batch) =>
        gsap.from(batch, {
          y: 44,
          x: (i, t) => (cards.indexOf(t) % 2 ? 18 : -18),
          rotation: (i, t) => {
            const k = cards.indexOf(t);
            return rest[k] + (k % 2 ? 8 : -8);
          },
          scale: 0.9,
          duration: 0.72,
          ease: "power3.out",
          stagger: 0.09,
          overwrite: true,
          force3D: false,
          /* will-change só nas duas cartas que estão caindo, e só enquanto caem */
          onStart: () => batch.forEach((t) => (t.style.willChange = "transform")),
          onComplete: () => batch.forEach((t) => (t.style.willChange = "")),
        }),
    });
    return () => triggers.forEach((t) => t.kill());
  });
})();
