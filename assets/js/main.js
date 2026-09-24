/* ¡Buenas! Taquería · núcleo
   Tudo aqui funciona sem GSAP (conteúdo nunca nasce invisível). Com GSAP + Lenis
   carregados, liga o movimento e expõe window.Buenas para os módulos. */
(() => {
  const doc = document.documentElement;
  const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = matchMedia("(hover: hover) and (pointer: fine)").matches;
  const hasGsap = typeof window.gsap !== "undefined" && typeof window.ScrollTrigger !== "undefined";
  const motion = hasGsap && !reduced;
  const listeners = {};

  const Buenas = (window.Buenas = {
    reduced, finePointer, motion,
    gsap: window.gsap || null,
    ScrollTrigger: window.ScrollTrigger || null,
    lenis: null,
    headerH: () => document.getElementById("siteHeader")?.offsetHeight || 64,
    on(evt, fn) { (listeners[evt] = listeners[evt] || []).push(fn); },
    emit(evt, data) { (listeners[evt] || []).forEach((fn) => { try { fn(data); } catch (e) { console.error(e); } }); },
    fired: {},
  });
  const once = (evt, fn) => { if (Buenas.fired[evt]) fn(); else Buenas.on(evt, fn); };
  const markFired = (evt) => { if (!Buenas.fired[evt]) { Buenas.fired[evt] = true; Buenas.emit(evt); } };
  Buenas.once = once;
  Buenas.markFired = markFired;

  /* ---------------------------------------------------------------- GSAP + Lenis */
  if (hasGsap) {
    const { gsap, ScrollTrigger } = window;
    gsap.registerPlugin(ScrollTrigger);
    if (window.SplitText) gsap.registerPlugin(window.SplitText);
    if (window.CustomEase) {
      gsap.registerPlugin(window.CustomEase);
      window.CustomEase.create("buenas", "0.625, 0.05, 0, 1");
      window.CustomEase.create("slot", "0.5, 0, 0, 1");
    }
    gsap.defaults({ ease: window.CustomEase ? "buenas" : "power3.out", duration: 0.8 });
    ScrollTrigger.config({ ignoreMobileResize: true });
  }
  if (motion) {
    doc.classList.add("motion-ok");
    if (typeof window.Lenis !== "undefined") {
      const lenis = new window.Lenis({ lerp: 0.11, wheelMultiplier: 1.05, smoothWheel: true });
      Buenas.lenis = lenis;
      lenis.on("scroll", window.ScrollTrigger.update);
      window.gsap.ticker.add((t) => lenis.raf(t * 1000));
      window.gsap.ticker.lagSmoothing(0);
    }
  }

  const scrollToTarget = (target) => {
    const offset = -Buenas.headerH() + 2;
    if (Buenas.lenis) Buenas.lenis.scrollTo(target, { offset, duration: 1.2 });
    else {
      const y = target === 0 ? 0 : target.getBoundingClientRect().top + scrollY + offset;
      scrollTo({ top: y, behavior: reduced ? "auto" : "smooth" });
    }
  };
  document.addEventListener("click", (e) => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute("href");
    if (id === "#" || id === "#order") { if (id === "#order") e.preventDefault(); return; }
    const target = id === "#top" ? 0 : document.querySelector(id);
    if (target === null) return;
    e.preventDefault();
    closeMenu();
    scrollToTarget(target);
    if (target !== 0) history.replaceState(null, "", id);
  });

  /* ---------------------------------------------------------------- header */
  const header = document.getElementById("siteHeader");
  const hero = document.getElementById("top");
  let lastY = scrollY;
  const onScroll = () => {
    const y = scrollY;
    header.classList.toggle("is-solid", y > 30);
    const pastHero = hero ? y > hero.offsetHeight * 0.6 : y > 400;
    header.classList.toggle("is-hidden", pastHero && y > lastY + 2 && !menuOpen);
    if (y < lastY - 2 || !pastHero) header.classList.remove("is-hidden");
    lastY = y;
  };
  addEventListener("scroll", onScroll, { passive: true });
  onScroll();

  /* ---------------------------------------------------------------- menu celular */
  const toggle = document.getElementById("menuToggle");
  const menu = document.getElementById("mobileMenu");
  let menuOpen = false;
  function openMenu() {
    menuOpen = true;
    menu.hidden = false;
    requestAnimationFrame(() => requestAnimationFrame(() => menu.classList.add("is-open")));
    toggle.setAttribute("aria-expanded", "true");
    toggle.querySelector(".sr-only").textContent = "Close menu";
    Buenas.lenis?.stop();
    document.body.style.overflow = "hidden";
  }
  function closeMenu() {
    if (!menuOpen) return;
    menuOpen = false;
    menu.classList.remove("is-open");
    toggle.setAttribute("aria-expanded", "false");
    toggle.querySelector(".sr-only").textContent = "Open menu";
    Buenas.lenis?.start();
    document.body.style.overflow = "";
    setTimeout(() => { if (!menuOpen) menu.hidden = true; }, reduced ? 0 : 800);
  }
  toggle?.addEventListener("click", () => (menuOpen ? closeMenu() : openMenu()));
  addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });

  /* ---------------------------------------------------------------- pedido */
  const dialog = document.getElementById("orderDialog");
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-order]");
    if (!btn || !dialog) return;
    e.preventDefault();
    closeMenu();
    const place = btn.getAttribute("data-order-place");
    if (place) { const r = dialog.querySelector(`input[value="${place}"]`); if (r) r.checked = true; }
    if (typeof dialog.showModal === "function") dialog.showModal(); else dialog.setAttribute("open", "");
    Buenas.lenis?.stop();
  });
  dialog?.addEventListener("close", () => Buenas.lenis?.start());
  dialog?.addEventListener("click", (e) => { if (e.target === dialog) dialog.close(); });

  /* ---------------------------------------------------------------- dock (celular) */
  const dock = document.getElementById("dock");
  if (dock && hero && "IntersectionObserver" in window) {
    new IntersectionObserver(([en]) => dock.classList.toggle("is-visible", !en.isIntersecting), { rootMargin: "0px 0px -40% 0px" }).observe(hero);
  }

  /* Desenho decorativo em pedaços, quando a linha principal está livre. Junto
     tudo de uma vez virava uma tarefa longa e travava o primeiro toque. */
  const idle = (fn) => (window.requestIdleCallback
    ? requestIdleCallback(fn, { timeout: 1400 })
    : setTimeout(fn, 60));

  /* ---------------------------------------------------------------- papel picado */
  const NS = "http://www.w3.org/2000/svg";
  const svgEl = (tag, attrs, parent) => { const n = document.createElementNS(NS, tag); for (const k in attrs) n.setAttribute(k, attrs[k]); parent && parent.appendChild(n); return n; };
  const COLORS = ["#E5256E", "#F6A019", "#1E3FAF", "#2F7446", "#F5CD3A"];
  let picadoId = 0;
  function drawPicado(svg) {
    svg.innerHTML = "";
    const W = Math.max(320, svg.clientWidth || innerWidth || 0);
    const H = Math.max(40, svg.clientHeight || 0) || 76;
    svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
    const fw = Math.max(40, Math.min(76, W / 17)), fh = H * 0.84, gap = fw * 0.16;
    const id = `cut${picadoId++}`;
    const defs = svgEl("defs", {}, svg);
    const m = svgEl("mask", { id, maskUnits: "userSpaceOnUse", maskContentUnits: "userSpaceOnUse", x: -10, y: -10, width: fw + 20, height: fh + 30 }, defs);
    svgEl("rect", { x: -10, y: -10, width: fw + 20, height: fh + 30, fill: "#fff" }, m);
    const cx = fw / 2, cy = fh * 0.5, r = fw * 0.12;
    for (let i = 0; i < 6; i++) { const a = (i * Math.PI) / 3; svgEl("circle", { cx: cx + Math.cos(a) * r * 1.3, cy: cy + Math.sin(a) * r * 1.3, r: r * 0.62, fill: "#000" }, m); }
    svgEl("circle", { cx, cy, r: r * 0.5, fill: "#000" }, m);
    for (let i = 0; i < 4; i++) { const x = fw * (0.18 + i * 0.213); svgEl("path", { d: `M${x} ${fh * 0.14} l${fw * 0.05} ${fh * 0.07} l${-fw * 0.05} ${fh * 0.07} l${-fw * 0.05} ${-fh * 0.07}z`, fill: "#000" }, m); }
    for (let i = 0; i < 5; i++) svgEl("circle", { cx: fw * (0.14 + i * 0.18), cy: fh * 0.8, r: fw * 0.035, fill: "#000" }, m);
    const n = Math.ceil(W / (fw + gap)) + 1, sag = H * 0.12;
    svgEl("path", { d: `M0 4 Q ${W / 2} ${4 + sag * 2} ${W} 4`, stroke: "#1D1511", "stroke-width": 1.5, fill: "none", opacity: 0.7 }, svg);
    for (let i = 0; i < n; i++) {
      const x = i * (fw + gap) - gap * 0.5;
      const t = (x + fw / 2) / W;
      const y = 4 + sag * 4 * t * (1 - t);
      const outer = svgEl("g", { transform: `translate(${x} ${y})` }, svg);
      const g = svgEl("g", { class: "flag", mask: `url(#${id})` }, outer);
      g.style.setProperty("--d", 3.2 + (i % 5) * 0.45 + "s");
      g.style.setProperty("--delay", -((i * 0.37) % 3) + "s");
      g.style.setProperty("--amp", 2 + (i % 3) + "deg");
      const sc = 7, step = fw / sc;
      let d = `M0 0 H${fw} V${fh}`;
      for (let k = sc; k > 0; k--) d += ` Q${step * (k - 0.5)} ${fh - step * 0.9} ${step * (k - 1)} ${fh}`;
      svgEl("path", { d: d + " Z", fill: COLORS[i % COLORS.length] }, g);
    }
  }
  const picados = [...document.querySelectorAll("[data-picado]")];
  const redrawPicados = (force) => picados.forEach((svg) => {
    const w = svg.clientWidth;
    if (!force && w && Math.abs(w - Number(svg.dataset.drawnW || 0)) < 40) return;
    idle(() => { drawPicado(svg); svg.dataset.drawnW = String(svg.clientWidth || 0); });
  });
  redrawPicados(true);
  (document.fonts?.ready || Promise.resolve()).then(() => redrawPicados());
  addEventListener("load", () => redrawPicados());
  let rsT;
  addEventListener("resize", () => { clearTimeout(rsT); rsT = setTimeout(() => redrawPicados(), 200); });

  /* ---------------------------------------------------------------- selos */
  document.querySelectorAll("[data-seal]").forEach((svg, idx) => idle(() => {
    svg.setAttribute("viewBox", "0 0 200 200");
    const spin = svgEl("g", { class: "seal__spin" }, svg);
    const pts = [], spikes = 22;
    for (let i = 0; i < spikes * 2; i++) { const a = (i * Math.PI) / spikes - Math.PI / 2, r = i % 2 ? 84 : 98; pts.push(`${(100 + Math.cos(a) * r).toFixed(1)},${(100 + Math.sin(a) * r).toFixed(1)}`); }
    svgEl("polygon", { points: pts.join(" "), fill: "#F6A019", stroke: "#1D1511", "stroke-width": 3, "stroke-linejoin": "round" }, spin);
    const pid = `ring${idx}`;
    svgEl("path", { id: pid, d: "M100 100 m-62 0 a62 62 0 1 1 124 0 a62 62 0 1 1 -124 0", fill: "none" }, svgEl("defs", {}, svg));
    const tx = svgEl("text", { "font-family": "Anybody, sans-serif", "font-size": 15, "font-weight": 800, "letter-spacing": 1.5, fill: "#1D1511" }, spin);
    tx.style.fontVariationSettings = '"wdth" 80, "wght" 800';
    const tp = svgEl("textPath", { href: `#${pid}` }, tx);
    tp.textContent = svg.getAttribute("data-seal");
    svgEl("circle", { cx: 100, cy: 100, r: 44, fill: "#E5256E", stroke: "#1D1511", "stroke-width": 3 }, svg);
    const c = svgEl("text", { x: 100, y: 114, "text-anchor": "middle", "font-family": "Anybody, sans-serif", "font-size": 40, "font-weight": 900, fill: "#FBF5EA" }, svg);
    c.style.fontVariationSettings = '"wdth" 70, "wght" 900';
    c.textContent = "¡B!";
  }));

  /* ---------------------------------------------------------------- faixas infinitas
     Duplica até cada metade passar da largura do container (nº par de cópias, -50%). */
  function buildMarquee(box) {
    const track = box.firstElementChild;
    if (!track || track.dataset.built) return;
    const original = [...track.children];
    const one = track.scrollWidth;          // uma leitura só
    const need = box.clientWidth * 2.2;
    let copies = Math.max(2, Math.ceil(need / Math.max(one, 1)));
    if (copies % 2) copies++;               // par, para a emenda cair exata em -50%
    copies = Math.min(copies, 16);
    const frag = document.createDocumentFragment();
    for (let i = 1; i < copies; i++) {
      original.forEach((n) => { const c = n.cloneNode(true); c.setAttribute("aria-hidden", "true"); frag.appendChild(c); });
    }
    track.appendChild(frag);
    track.dataset.built = "1";
    if (reduced) return;
    const speed = Number(box.dataset.marqueeSpeed || 55);
    const dist = track.scrollWidth / 2;
    const dir = box.dataset.marquee === "right" ? -1 : 1;
    const frames = dir > 0 ? [{ transform: "translateX(0)" }, { transform: "translateX(-50%)" }] : [{ transform: "translateX(-50%)" }, { transform: "translateX(0)" }];
    const anim = track.animate(frames, { duration: (dist / speed) * 1000, iterations: Infinity });
    if (box.classList.contains("reviews")) {
      box.addEventListener("pointerenter", () => anim.pause());
      box.addEventListener("pointerleave", () => anim.play());
    }
  }
  const startMarquees = () => document.querySelectorAll("[data-marquee]").forEach((b) => idle(() => buildMarquee(b)));
  (document.fonts?.ready || Promise.resolve()).then(startMarquees);

  /* ---------------------------------------------------------------- estrelas da Luna */
  const sky = document.querySelector("[data-stars]");
  if (sky) idle(() => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 9301 + 49297) % 233280) / 233280);
    const frag = document.createDocumentFragment();
    for (let i = 0; i < 46; i++) {
      const s = document.createElement("i");
      s.style.left = rnd() * 100 + "%";
      s.style.top = rnd() * 100 + "%";
      s.style.setProperty("--sz", 2 + rnd() * 3 + "px");
      s.style.setProperty("--tw", 2 + rnd() * 3 + "s");
      s.style.setProperty("--td", -rnd() * 4 + "s");
      frag.appendChild(s);
    }
    sky.appendChild(frag);
  });

  /* ---------------------------------------------------------------- aberto agora (fuso de LA) */
  const HOURS = {
    hp: { 0: [11, 23], 1: [11, 23], 2: [11, 23], 3: [11, 23], 4: [11, 23], 5: [11, 26], 6: [11, 26] },
    bh: { 0: [10, 22], 1: [10, 22], 2: [10, 22], 3: [10, 22], 4: [10, 22], 5: [10, 22], 6: [10, 22] },
  };
  const fmtHour = (h) => { const hh = ((h % 24) + 24) % 24; const ap = hh >= 12 ? "p.m." : "a.m."; const x = hh % 12 === 0 ? 12 : hh % 12; return `${x} ${ap}`; };
  function laNow() {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "short", hour: "numeric", minute: "numeric", hour12: false }).formatToParts(new Date());
    const get = (t) => parts.find((p) => p.type === t)?.value;
    const day = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
    return { day, h: (Number(get("hour")) % 24) + Number(get("minute")) / 60 };
  }
  function statusFor(key) {
    const { day, h } = laNow();
    const today = HOURS[key][day], yesterday = HOURS[key][(day + 6) % 7];
    if (yesterday[1] > 24 && h < yesterday[1] - 24) return { open: true, closes: yesterday[1], left: yesterday[1] - 24 - h };
    if (h >= today[0] && h < today[1]) return { open: true, closes: today[1], left: today[1] - h };
    const opens = h < today[0] ? today[0] : HOURS[key][(day + 1) % 7][0];
    return { open: false, opens };
  }
  function paintStatus() {
    document.querySelectorAll("[data-place]").forEach((card) => {
      const el = card.querySelector("[data-status]");
      if (!el) return;
      const s = statusFor(card.dataset.place);
      el.classList.remove("is-open", "is-soon", "is-closed");
      if (s.open && s.left <= 0.75) { el.classList.add("is-soon"); el.textContent = `Closing soon · ${fmtHour(s.closes)}`; }
      else if (s.open) { el.classList.add("is-open"); el.textContent = `Open now · until ${fmtHour(s.closes)}`; }
      else { el.classList.add("is-closed"); el.textContent = `Closed · opens ${fmtHour(s.opens)}`; }
    });
  }
  paintStatus();
  setInterval(paintStatus, 60000);

  /* ---------------------------------------------------------------- orçamento de catering */
  const form = document.getElementById("quoteForm");
  form?.addEventListener("submit", (e) => {
    e.preventDefault();
    const status = form.querySelector(".quote__status");
    const bad = [...form.querySelectorAll("input")].find((i) => !i.checkValidity());
    if (bad) {
      bad.focus();
      status.textContent = bad.type === "email" ? "Check the email address and try again." : bad.name === "guests" ? "We cater for 20 to 300 guests." : "Fill in all four fields so we can quote you.";
      return;
    }
    const name = form.elements.name.value.trim().split(" ")[0];
    status.textContent = `Gracias, ${name}! Your quote lands in your inbox within one business day.`;
    form.reset();
  });

  /* ---------------------------------------------------------------- slots: troca automática quando a imagem existir */
  const slots = [...document.querySelectorAll("[data-slot][data-src]")];
  if (slots.length) {
    fetch("assets/img/manifest.json")
      .then((r) => (r.ok ? r.json() : []))
      .then((have) => slots.forEach((slot) => { if (have.includes(slot.getAttribute("data-src"))) fillSlot(slot, have); }))
      .catch(() => {});
  }
  function fillSlot(slot, have) {
    const src = slot.getAttribute("data-src");
    const img = new Image();
    img.decoding = "async";
    img.loading = "lazy";
    img.alt = slot.getAttribute("data-alt") || "";
    if (slot.hasAttribute("data-contain")) img.style.objectFit = "contain";
    img.onload = () => {
      slot.classList.add("has-img");
      slot.innerHTML = "";
      slot.appendChild(img);
      window.Buenas?.refreshSoon?.();
    };
    const ss = (slot.getAttribute("data-srcset") || "")
      .split(",").map((s) => s.trim()).filter((s) => have.includes(s.split(/\s+/)[0])).join(", ");
    if (ss) { img.srcset = ss; img.sizes = slot.getAttribute("data-sizes") || "100vw"; }
    img.src = src;
  }

  /* ---------------------------------------------------------------- enfeite:
     parado no carregamento e fora da tela. É o que segura o trabalho de
     desenho na hora que a nota de performance é medida. */
  if (motion) {
    doc.classList.add("deco-hold");
    const release = () => requestAnimationFrame(() => setTimeout(() => doc.classList.remove("deco-hold"), 220));
    if (document.readyState === "complete") release();
    else addEventListener("load", release, { once: true });

    const deco = [...document.querySelectorAll(".picado, .seal, .estrella__art, .luna__sky, .orbit")];
    deco.forEach((el) => el.setAttribute("data-deco", ""));
    if ("IntersectionObserver" in window) {
      const io = new IntersectionObserver(
        (es) => es.forEach((e) => e.target.classList.toggle("is-idle", !e.isIntersecting)),
        { rootMargin: "20% 0px 20% 0px" }
      );
      deco.forEach((el) => { el.classList.add("is-idle"); io.observe(el); });
    }
  }

  /* ================================================================ movimento */
  if (!motion) { markFired("intro:done"); return; }
  const { gsap, ScrollTrigger } = window;

  /* ---- hero: parallax de mouse na órbita */
  const stage = document.getElementById("heroStage");
  const orbitItems = stage ? [...stage.querySelectorAll(".orbit__item")] : [];
  if (stage && finePointer && orbitItems.length) {
    const target = { x: 0, y: 0 }, cur = { x: 0, y: 0 };
    hero.addEventListener("pointermove", (e) => {
      const r = hero.getBoundingClientRect();
      target.x = (e.clientX - r.left) / r.width - 0.5;
      target.y = (e.clientY - r.top) / r.height - 0.5;
    });
    hero.addEventListener("pointerleave", () => { target.x = 0; target.y = 0; });
    gsap.ticker.add(() => {
      cur.x += (target.x - cur.x) * 0.07;
      cur.y += (target.y - cur.y) * 0.07;
      if (Math.abs(target.x - cur.x) < 0.0005 && Math.abs(target.y - cur.y) < 0.0005 && !target.x && !target.y) return;
      orbitItems.forEach((el) => {
        const d = Number(el.dataset.orbit || 0.4);
        el.style.setProperty("--px", (cur.x * d * 90).toFixed(2) + "px");
        el.style.setProperty("--py", (cur.y * d * 70).toFixed(2) + "px");
      });
    });
  }

  /* ---- hero: o nome "grita" no scroll, o taco gira, a órbita abre */
  if (stage) {
    const tacoImg = stage.querySelector(".hero__taco img");
    const cssNum = (name, fallback) => parseFloat(getComputedStyle(doc).getPropertyValue(name)) || fallback;
    const wRest = () => cssNum("--w-shout", 78);
    const wOpen = () => cssNum("--w-shout-open", 126);
    const tl = gsap.timeline({ scrollTrigger: { trigger: hero, start: "top top", end: "bottom top", scrub: 0.6, invalidateOnRefresh: true } });
    tl.to(stage, { "--w": () => wOpen(), ease: "none" }, 0)
      .to(tacoImg, { yPercent: -14, rotation: 11, scale: 0.94, ease: "none" }, 0);
    orbitItems.forEach((el) => {
      const x = parseFloat(el.style.getPropertyValue("--x")) - 50;
      const y = parseFloat(el.style.getPropertyValue("--y")) - 50;
      tl.to(el, { x: x * 3.2, y: y * 2.6 - 40, rotation: (x > 0 ? 1 : -1) * 40, ease: "none" }, 0);
    });
    const fan = hero.querySelector(".fan");
    if (fan) tl.to(fan, { y: -40, rotation: -4, ease: "none" }, 0);

    /* entrada: depois da abertura, o nome grita uma vez e a órbita estala */
    once("intro:done", () => {
      const intro = gsap.timeline({ defaults: { ease: "back.out(1.8)" } });
      /* O grito da entrada é feito com transform, não com o eixo de largura da
         fonte: mexer na largura reflui a linha inteira (salto de layout e
         cálculo de layout caro a cada quadro). No scroll, aí sim, a largura
         variável entra, porque é movimento pedido pela pessoa. */
      const inners = stage.querySelectorAll(".wm__inner");
      intro.fromTo(inners, { scaleX: 0.74, scaleY: 1.14 }, { scaleX: 1, scaleY: 1, duration: 1.15, ease: "elastic.out(1, .5)" }, 0)
        .from(tacoImg, { yPercent: -18, rotation: -16, duration: 1.1 }, 0)
        .from(orbitItems, { scale: 0.2, duration: 0.8, stagger: { each: 0.05, from: "random" } }, 0.1)
        .from(hero.querySelectorAll(".fan .lcard"), { yPercent: 60, rotation: 0, duration: 0.9, stagger: 0.08 }, 0.2);
    });
  }

  /* ---- títulos: palavras caindo dentro da máscara (caça-níquel) */
  if (window.SplitText) {
    document.querySelectorAll("[data-split]").forEach((el) => {
      window.SplitText.create(el, {
        type: "lines,words", mask: "lines", linesClass: "split-line", autoSplit: true,
        onSplit(self) {
          return gsap.from(self.words, {
            yPercent: -115,
            duration: (i) => 0.75 + i * 0.09,
            delay: (i) => i * 0.035,
            ease: window.CustomEase ? "slot" : "power4.out",
            scrollTrigger: { trigger: el, start: "top 86%", once: true },
          });
        },
      });
    });
  }

  /* ---- contadores (o "0 de pacote" conta pra baixo) */
  document.querySelectorAll("[data-count]").forEach((el) => {
    const end = Number(el.dataset.count);
    const start = end === 0 ? 99 : 0;
    const obj = { v: start };
    el.textContent = String(start);
    ScrollTrigger.create({
      trigger: el, start: "top 88%", once: true,
      onEnter: () => gsap.to(obj, { v: end, duration: end === 0 ? 1.4 : 1.8, ease: "power2.out", onUpdate: () => (el.textContent = Math.round(obj.v)) }),
    });
    setTimeout(() => { if (Number(el.textContent) !== end && !ScrollTrigger.isInViewport(el)) return; }, 0);
  });

  /* ---- parallax em direções opostas */
  document.querySelectorAll("[data-parallax]").forEach((el) => {
    const f = Number(el.dataset.parallax);
    gsap.fromTo(el, { yPercent: -f * 60 }, { yPercent: f * 60, ease: "none", scrollTrigger: { trigger: el, start: "top bottom", end: "bottom top", scrub: true } });
  });

  /* ---- a lua sobe devagar */
  const moon = document.querySelector(".luna__moon");
  if (moon) gsap.fromTo(moon, { rotation: -8 }, { rotation: 6, ease: "none", scrollTrigger: { trigger: ".luna", start: "top bottom", end: "bottom top", scrub: true } });

  /* ---- um refresh só, agrupado: cada refresh remede todos os gatilhos */
  let refreshT;
  const refreshSoon = () => { clearTimeout(refreshT); refreshT = setTimeout(() => ScrollTrigger.refresh(), 180); };
  Buenas.refreshSoon = refreshSoon;
  (document.fonts?.ready || Promise.resolve()).then(refreshSoon);
  addEventListener("load", refreshSoon);

  /* ---- sem módulo de abertura (ou se ele falhar), a entrada roda assim mesmo */
  setTimeout(() => markFired("intro:done"), document.getElementById("loader") ? 3200 : 60);
})();
