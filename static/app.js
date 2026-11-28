"use strict";
(() => {
  // ---------- utilitarios ----------
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const LOC = "pt-PT";
  const NF = {};
  const nf = (d) => (NF[d] ||= new Intl.NumberFormat(LOC, { minimumFractionDigits: d, maximumFractionDigits: d }));
  const ok = (v) => v !== null && v !== undefined && !Number.isNaN(Number(v));
  const fmt = (v, d = 2) => (ok(v) ? (v < 0 ? "−" : "") + nf(d).format(Math.abs(v)) : "—");
  const sgn = (v) => (v > 0 ? "+" : v < 0 ? "−" : "");
  const pct = (v, d = 2, plus = true) => (ok(v) ? (plus && v > 0 ? "+" : v < 0 ? "−" : "") + nf(d).format(Math.abs(v)) + "%" : "—");
  const usd = (v, d = 0) => (ok(v) ? (v < 0 ? "−" : "") + nf(d).format(Math.abs(v)) + " US$" : "—");
  const usdS = (v, d = 0) => (ok(v) ? sgn(v) + nf(d).format(Math.abs(v)) + " US$" : "—");
  const cls = (v) => (v > 0 ? "up" : v < 0 ? "down" : "");
  const css = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  const reduce = matchMedia("(prefers-reduced-motion: reduce)").matches;
  const hora = (iso) => (iso ? new Date(iso).toLocaleTimeString(LOC, { hour: "2-digit", minute: "2-digit" }) : "—");
  const diaHora = (iso) => (iso ? new Date(iso).toLocaleString(LOC, { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—");
  const dh = (iso) => { if (!iso) return "—"; const d = new Date(iso); return d.toLocaleDateString(LOC, { day: "2-digit", month: "2-digit" }) + " " + d.toLocaleTimeString(LOC, { hour: "2-digit", minute: "2-digit" }); };
  const quando = (iso) => { if (!iso) return "—"; const d = new Date(iso), hoje = d.toDateString() === new Date().toDateString(); return (hoje ? "" : d.toLocaleDateString(LOC, { weekday: "long" }).split("-")[0] + " ") + d.toLocaleTimeString(LOC, { hour: "2-digit", minute: "2-digit" }); };
  const dataCurta = (s) => !/^\d{4}-/.test(String(s)) ? String(s) : new Date(String(s).slice(0, 10) + "T12:00:00").toLocaleDateString(LOC, { day: "numeric", month: "short" });
  const vol = (v) => (v >= 1e9 ? fmt(v / 1e9, 1) + " mM" : v >= 1e6 ? fmt(v / 1e6, 1) + " M" : v >= 1e3 ? fmt(v / 1e3, 0) + " mil" : fmt(v, 0));
  const MARK = '<svg class="mark" viewBox="0 0 40 40" aria-hidden="true"><path class="m-1" d="M7 18h2v5h-2z M4 23h8v11H4z M7 34h2v4h-2z M19 10h2v4h-2z M16 14h8v13h-8z M19 27h2v5h-2z"/><path class="m-2" d="M31 2h2v3h-2z M28 5h8v14h-8z M31 19h2v5h-2z"/></svg>';
  const NOME = { Cacador: "Caçador", GestorRisco: "Gestor de Risco" };
  const AGENTES = [
    ["TradingMaster", "Coordena a equipa, toma a decisão final e é o único que envia ordens.", "Decisão final"],
    ["Estratega", "Lê o regime de mercado, os eventos macro e define a agressividade do dia.", "Recomenda"],
    ["Cacador", "Procura os melhores candidatos a swing trade em 600 ações e ETFs.", "Recomenda"],
    ["Analista", "Transforma candidatos em planos: entrada, stop, alvo e tese.", "Recomenda"],
    ["GestorRisco", "Tamanho das posições, exposição e correlação. Pode vetar.", "Veto"],
    ["Auditor", "Diário de trading, métricas e revisão semanal do playbook.", "Recomenda"],
  ];
  const CICLOS = [
    { dias: [1, 2, 3, 4, 5], h: 13, m: 27, nome: "Preparação" },
    { dias: [1, 2, 3, 4, 5], h: 14, m: 52, nome: "Ordens" },
    { dias: [1, 2, 3, 4, 5], h: 16, m: 41, nome: "Vigia" },
    { dias: [1, 2, 3, 4, 5], h: 18, m: 41, nome: "Vigia" },
    { dias: [1, 2, 3, 4, 5], h: 20, m: 13, nome: "Fecho" },
    { dias: [1, 2, 3, 4, 5], h: 21, m: 17, nome: "Diário" },
    { dias: [6], h: 11, m: 7, nome: "Revisão semanal" },
  ];

  const S = {
    tudo: null, mercado: null, sparks: {}, velas: null, ticker: "SPY", dias: 126,
    camadas: { mm20: true, mm50: true, mm200: true, vol: true }, primeiro: true, fita: "",
  };

  // ---------- tema ----------
  $("themeBtn").addEventListener("click", () => {
    const atual = document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const novo = atual === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = novo;
    try { localStorage.setItem("tm-tema", novo); } catch (e) { /* sem armazenamento */ }
    redesenhar();
  });

  // ---------- relogios, cabecalho, proximo ciclo ----------
  function relogios() {
    const opt = { hour: "2-digit", minute: "2-digit" };
    $("clkLis").textContent = new Date().toLocaleTimeString(LOC, { ...opt, timeZone: "Europe/Lisbon" });
    $("clkNy").textContent = new Date().toLocaleTimeString(LOC, { ...opt, timeZone: "America/New_York" });
    const p = proximoCiclo();
    $("nextCycle").textContent = p ? `Próximo ciclo: ${p.nome} · ${p.quando}` : "";
  }
  function proximoCiclo() {
    const agora = new Date();
    let melhor = null;
    for (let add = 0; add < 8; add++) {
      const d = new Date(agora); d.setDate(d.getDate() + add);
      for (const c of CICLOS) {
        if (!c.dias.includes(d.getDay())) continue;
        const t = new Date(d); t.setHours(c.h, c.m, 0, 0);
        if (t > agora && (!melhor || t < melhor.t)) melhor = { t, nome: c.nome };
      }
      if (melhor) break;
    }
    if (!melhor) return null;
    const hoje = melhor.t.toDateString() === agora.toDateString();
    const quando = (hoje ? "hoje" : melhor.t.toLocaleDateString(LOC, { weekday: "short" })) + " às " + melhor.t.toLocaleTimeString(LOC, { hour: "2-digit", minute: "2-digit" });
    return { nome: melhor.nome, quando };
  }
  addEventListener("scroll", () => $("hdr").classList.toggle("is-solid", scrollY > 8), { passive: true });

  // ---------- revelacao e contadores ----------
  const io = "IntersectionObserver" in window && !reduce
    ? new IntersectionObserver((es) => es.forEach((e) => { if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); } }), { threshold: 0.08, rootMargin: "0px 0px -6% 0px" })
    : null;
  document.querySelectorAll(".rv").forEach((el) => (io ? io.observe(el) : el.classList.add("in")));
  setTimeout(() => document.querySelectorAll(".mark-anim").forEach((m) => m.classList.add("is-in")), 150);

  const navEl = document.querySelector(".nav"), navLinks = [...navEl.querySelectorAll("a")];
  // no telemovel o menu e uma faixa que desliza: manter a seccao atual a vista
  const centrarNav = (a) => {
    if (navEl.scrollWidth <= navEl.clientWidth + 2) return;
    navEl.scrollTo({ left: a.offsetLeft - (navEl.clientWidth - a.offsetWidth) / 2, behavior: reduce ? "auto" : "smooth" });
  };
  if ("IntersectionObserver" in window) {
    const nio = new IntersectionObserver((es) => es.forEach((e) => {
      if (e.isIntersecting) navLinks.forEach((a) => {
        const on = a.getAttribute("href") === "#" + e.target.id;
        if (on && !a.classList.contains("is-on")) centrarNav(a);
        a.classList.toggle("is-on", on);
      });
    }), { rootMargin: "-45% 0px -50% 0px" });
    document.querySelectorAll("main section[id]").forEach((s) => nio.observe(s));
  }

  function contar(el, alvo, formato, dur = 1200) {
    if (!el) return;
    const de = el._v ?? 0;
    el._v = alvo;
    if (reduce || !ok(alvo) || de === alvo) { el.textContent = formato(alvo); return; }
    const t0 = performance.now();
    const passo = (t) => {
      const k = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - k, 3);
      el.textContent = formato(de + (alvo - de) * e);
      if (k < 1 && el._v === alvo) requestAnimationFrame(passo);
    };
    requestAnimationFrame(passo);
  }

  // ---------- markdown minimo ----------
  function md(src) {
    const L = String(src || "").replace(/\r/g, "").split("\n");
    let out = "", i = 0;
    const inl = (s) => esc(s)
      .replace(/`([^`]+)`/g, "<code>$1</code>")
      .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, "$1<em>$2</em>")
      .replace(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    while (i < L.length) {
      const l = L[i];
      if (/^```/.test(l)) { const b = []; i++; while (i < L.length && !/^```/.test(L[i])) b.push(L[i++]); i++; out += "<pre><code>" + esc(b.join("\n")) + "</code></pre>"; continue; }
      const h = l.match(/^(#{1,6})\s+(.*)/);
      if (h) { const n = Math.min(3, h[1].length); out += `<h${n}>${inl(h[2])}</h${n}>`; i++; continue; }
      if (/^\s*\|.*\|\s*$/.test(l)) {
        const rows = []; while (i < L.length && /^\s*\|.*\|\s*$/.test(L[i])) rows.push(L[i++]);
        const cells = (r) => r.trim().replace(/^\||\|$/g, "").split("|").map((c) => c.trim());
        out += "<table>" + rows.filter((r) => !/^\s*\|?\s*:?-{2,}/.test(r)).map((r, k) => "<tr>" + cells(r).map((c) => `<${k ? "td" : "th"}>${inl(c)}</${k ? "td" : "th"}>`).join("") + "</tr>").join("") + "</table>";
        continue;
      }
      if (/^\s*([-*]|\d+\.)\s+/.test(l)) {
        const ord = /^\s*\d+\./.test(l), it = [];
        while (i < L.length && /^\s*([-*]|\d+\.)\s+/.test(L[i])) it.push(L[i++].replace(/^\s*([-*]|\d+\.)\s+/, ""));
        out += (ord ? "<ol>" : "<ul>") + it.map((x) => "<li>" + inl(x) + "</li>").join("") + (ord ? "</ol>" : "</ul>");
        continue;
      }
      if (!l.trim()) { i++; continue; }
      const p = []; while (i < L.length && L[i].trim() && !/^(#{1,6}\s|```|\s*\||\s*([-*]|\d+\.)\s)/.test(L[i])) p.push(L[i++]);
      out += "<p>" + inl(p.join(" ")) + "</p>";
    }
    return out;
  }
  async function abrir(caminho, titulo) {
    $("dlgTitle").textContent = titulo || caminho;
    $("dlgBody").innerHTML = '<p class="muted">A carregar…</p>';
    $("dlg").showModal();
    try {
      const j = await (await fetch(ONLINE ? "data/f/" + caminho + ".json" : "/api/ficheiro?caminho=" + encodeURIComponent(caminho))).json();
      $("dlgBody").innerHTML = caminho.endsWith(".json") ? "<pre><code>" + esc(j.texto) + "</code></pre>" : md(j.texto);
    } catch (e) { $("dlgBody").innerHTML = '<p class="muted">Não foi possível abrir o ficheiro.</p>'; }
  }
  $("dlgClose").addEventListener("click", () => $("dlg").close());
  $("dlg").addEventListener("click", (e) => { if (e.target === $("dlg")) $("dlg").close(); });

  // ---------- escalas ----------
  function niceTicks(min, max, n = 5) {
    if (!(max > min)) { min -= 1; max += 1; }
    const span = max - min, raw = span / n, mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => span / s <= n) || 10 * mag;
    const out = [];
    for (let v = Math.ceil(min / step) * step; v <= max + step * 1e-9; v += step) out.push(+v.toFixed(10));
    return { ticks: out, step };
  }
  const casas = (step) => (Number.isInteger(+step.toFixed(6)) ? 0 : Number.isInteger(+(step * 10).toFixed(6)) ? 1 : 2);

  // ---------- grafico de velas ----------
  function desenharVelas() {
    const el = $("candle"), V = S.velas;
    if (!V || !V.velas || !V.velas.length) return;
    const W = Math.max(300, el.clientWidth), estreito = W < 640;
    const H = estreito ? 340 : 470;
    const volH = S.camadas.vol ? (estreito ? 52 : 76) : 0, gap = volH ? 12 : 0;
    const m = { l: 4, r: 66, t: 10, b: 24 };
    const ph = H - m.t - m.b - volH - gap, iw = W - m.l - m.r;
    const K = V.velas, n = K.length, bw = iw / n;
    const X = (i) => m.l + bw * (i + 0.5);
    let lo = Infinity, hi = -Infinity;
    K.forEach((k) => { lo = Math.min(lo, k.l); hi = Math.max(hi, k.h); });
    const linhasMM = [["mm20", "--accent"], ["mm50", "--spy"], ["mm200", "--m200"]];
    linhasMM.forEach(([k]) => { if (S.camadas[k]) (V[k] || []).forEach((v) => { if (ok(v)) { lo = Math.min(lo, v); hi = Math.max(hi, v); } }); });
    const N = V.niveis || {};
    [N.entrada, N.stop, N.alvo].forEach((v) => { if (ok(v) && v > 0) { lo = Math.min(lo, v); hi = Math.max(hi, v); } });
    const pad = (hi - lo) * 0.06 || hi * 0.02; lo -= pad; hi += pad;
    const { ticks, step } = niceTicks(lo, hi, estreito ? 4 : 6);
    const dc = casas(step);
    const Y = (v) => m.t + ph - ((v - lo) / (hi - lo)) * ph;
    const vy0 = m.t + ph + gap, maxV = Math.max(1, ...K.map((k) => k.v || 0));
    const cUp = css("--up"), cDown = css("--down"), cLine = css("--line"), cSurf = css("--white"), cInk = css("--ink"), cMute = css("--mute");
    let g = "";
    ticks.forEach((t) => {
      g += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(t).toFixed(1)}" y2="${Y(t).toFixed(1)}" stroke="${cLine}" stroke-width="1"/>`;
      g += `<text x="${W - m.r + 8}" y="${(Y(t) + 4).toFixed(1)}">${fmt(t, dc)}</text>`;
    });
    // eixo do tempo
    let ultimoX = -999;
    for (let i = 0; i < n; i++) {
      const d = new Date(K[i].d + "T12:00:00"), dPrev = i ? new Date(K[i - 1].d + "T12:00:00") : null;
      const curto = n <= 30;
      const marca = curto ? i % Math.ceil(n / 6) === 0 : (dPrev && d.getMonth() !== dPrev.getMonth());
      if (marca && X(i) - ultimoX > 58) {
        const txt = curto ? d.toLocaleDateString(LOC, { day: "numeric", month: "short" }) : d.toLocaleDateString(LOC, { month: "short" }) + (d.getMonth() === 0 ? " " + d.getFullYear() : "");
        g += `<line x1="${X(i).toFixed(1)}" x2="${X(i).toFixed(1)}" y1="${m.t}" y2="${m.t + ph}" stroke="${cLine}" stroke-width="1"/>`;
        g += `<text x="${X(i).toFixed(1)}" y="${H - 6}" text-anchor="middle">${esc(txt)}</text>`;
        ultimoX = X(i);
      }
    }
    // volume
    if (volH) {
      K.forEach((k, i) => {
        const h = Math.max(1, (k.v / maxV) * volH), up = k.c >= k.o;
        g += `<rect x="${(X(i) - Math.max(0.5, bw * 0.34)).toFixed(1)}" y="${(vy0 + volH - h).toFixed(1)}" width="${Math.max(1, bw * 0.68).toFixed(1)}" height="${h.toFixed(1)}" fill="${up ? cUp : cDown}" fill-opacity=".32"/>`;
      });
      g += `<text x="${W - m.r + 8}" y="${vy0 + 10}">${vol(maxV)}</text>`;
    }
    // medias
    linhasMM.forEach(([k, cor]) => {
      if (!S.camadas[k]) return;
      let d = "", aberto = false;
      (V[k] || []).forEach((v, i) => {
        if (!ok(v)) { aberto = false; return; }
        d += (aberto ? "L" : "M") + X(i).toFixed(1) + "," + Y(v).toFixed(1); aberto = true;
      });
      if (d) g += `<path d="${d}" fill="none" stroke="${css(cor)}" stroke-width="${k === "mm200" ? 2 : 1.6}" stroke-linejoin="round" stroke-linecap="round"/>`;
    });
    // velas (subida: corpo oco; descida: corpo cheio)
    const cw = Math.max(1, Math.min(16, bw * 0.66));
    K.forEach((k, i) => {
      const up = k.c >= k.o, cor = up ? cUp : cDown, x = X(i);
      const yT = Y(Math.max(k.o, k.c)), yB = Y(Math.min(k.o, k.c));
      g += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${Y(k.h).toFixed(1)}" y2="${Y(k.l).toFixed(1)}" stroke="${cor}" stroke-width="1.1"/>`;
      g += `<rect x="${(x - cw / 2).toFixed(1)}" y="${yT.toFixed(1)}" width="${cw.toFixed(1)}" height="${Math.max(1, yB - yT).toFixed(1)}" rx="${cw > 6 ? 1.2 : 0}" fill="${up ? cSurf : cor}" stroke="${cor}" stroke-width="${up ? 1.2 : 0}"/>`;
    });
    // niveis da posicao (texto escuro sobre verde/vermelho claros no tema escuro)
    const escuro = css("--paper").toLowerCase() === "#171a20";
    const txtSemaforo = escuro ? "#0e0f12" : "#fff";
    const chip = (v, cor, txtCor = txtSemaforo) => {
      const y = Y(v);
      return `<rect x="${W - m.r + 3}" y="${(y - 9).toFixed(1)}" width="${m.r - 4}" height="18" rx="5" fill="${cor}"/><text class="t-chip" x="${W - m.r + 8}" y="${(y + 4).toFixed(1)}" style="fill:${txtCor}">${fmt(v, 2)}</text>`;
    };
    const nivel = (v, cor, rot, txt = txtSemaforo) => {
      if (!ok(v) || v <= 0) return "";
      const y = Y(v);
      return `<line x1="${m.l}" x2="${W - m.r}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}" stroke="${cor}" stroke-width="1.4"/>` +
        `<text x="${m.l + 6}" y="${(y - 6).toFixed(1)}" style="fill:${cor};font-weight:500">${esc(rot)}</text>` + chip(v, cor, txt);
    };
    g += nivel(N.alvo, cUp, "Alvo") + nivel(N.stop, cDown, "Stop") + nivel(N.entrada, cInk, N.estado === "pendente" ? "Entrada pendente" : "Entrada", css("--paper"));
    // ultimo preco
    const ult = K[n - 1].c, cAcc = css("--accent");
    g += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(ult).toFixed(1)}" y2="${Y(ult).toFixed(1)}" stroke="${cAcc}" stroke-width="1" stroke-opacity=".55"/>` + chip(ult, cAcc, "#fff");
    // mira
    g += `<g id="cx" visibility="hidden"><line id="cxV" y1="${m.t}" y2="${vy0 + volH}" stroke="${cMute}" stroke-width="1"/><line id="cxH" x1="${m.l}" x2="${W - m.r}" stroke="${cMute}" stroke-width="1"/>` +
      `<rect id="cxPr" x="${W - m.r + 3}" width="${m.r - 4}" height="18" rx="5" fill="${cInk}"/><text id="cxPt" class="t-chip" x="${W - m.r + 8}" style="fill:${css("--paper")}"></text></g>`;
    g += `<rect id="cxHit" x="${m.l}" y="${m.t}" width="${iw}" height="${vy0 + volH - m.t}" fill="transparent"/>`;
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="Velas diárias de ${esc(V.ticker)}: último fecho ${fmt(ult, 2)}">${g}</svg>`;
    el.classList.remove("is-loading");
    legenda(n - 1);

    const svg = el.querySelector("svg"), cx = svg.querySelector("#cx");
    const mover = (ev) => {
      const r = svg.getBoundingClientRect();
      const x = (ev.clientX - r.left) * (W / r.width), y = (ev.clientY - r.top) * (H / r.height);
      const i = Math.max(0, Math.min(n - 1, Math.floor((x - m.l) / bw)));
      cx.setAttribute("visibility", "visible");
      svg.querySelector("#cxV").setAttribute("x1", X(i)); svg.querySelector("#cxV").setAttribute("x2", X(i));
      const yy = Math.max(m.t, Math.min(m.t + ph, y));
      svg.querySelector("#cxH").setAttribute("y1", yy); svg.querySelector("#cxH").setAttribute("y2", yy);
      svg.querySelector("#cxPr").setAttribute("y", yy - 9);
      const pt = svg.querySelector("#cxPt"); pt.setAttribute("y", yy + 4);
      pt.textContent = fmt(lo + ((m.t + ph - yy) / ph) * (hi - lo), 2);
      legenda(i);
    };
    const hit = svg.querySelector("#cxHit");
    hit.addEventListener("pointermove", mover);
    hit.addEventListener("pointerdown", mover);
    hit.addEventListener("pointerleave", () => { cx.setAttribute("visibility", "hidden"); legenda(n - 1); });
  }

  function legenda(i) {
    const V = S.velas; if (!V) return;
    const k = V.velas[i], prev = V.velas[i - 1];
    const ch = prev ? (k.c / prev.c - 1) * 100 : null;
    const mm = [["mm20", "MM20", "--accent"], ["mm50", "MM50", "--spy"], ["mm200", "MM200", "--m200"]]
      .filter(([c]) => S.camadas[c] && ok(V[c][i]))
      .map(([c, n, cor]) => `<span><i style="display:inline-block;width:10px;height:3px;border-radius:2px;background:var(${cor});vertical-align:middle;margin-right:5px"></i>${n} <b>${fmt(V[c][i], 2)}</b></span>`).join("");
    $("cvLegend").innerHTML = `<span><b>${esc(dataCurta(k.d))}</b></span><span>A <b>${fmt(k.o, 2)}</b></span><span>M <b>${fmt(k.h, 2)}</b></span><span>m <b>${fmt(k.l, 2)}</b></span><span>F <b>${fmt(k.c, 2)}</b></span>` +
      (ch !== null ? `<span class="${cls(ch)}">${pct(ch)}</span>` : "") + `<span>Vol <b>${vol(k.v)}</b></span>` + mm;
  }

  function lateral() {
    const V = S.velas; if (!V) return;
    const F = V.ficha || {}, N = V.niveis || {};
    let niveis = "";
    if (N.entrada) {
      const r = N.stop && N.entrada > N.stop ? (F.preco - N.entrada) / (N.entrada - N.stop) : null;
      niveis = `<div class="side__lv"><p class="label">${N.estado === "pendente" ? "Entrada pendente" : "Posição aberta"}${N.setup ? " · " + esc(N.setup) : ""}</p>
        <dl class="kv"><dt>Entrada</dt><dd>${fmt(N.entrada)}</dd><dt>Stop</dt><dd class="down">${fmt(N.stop)}</dd>
        <dt>Alvo</dt><dd class="up">${N.alvo ? fmt(N.alvo) : "trailing"}</dd>${r !== null && N.estado !== "pendente" ? `<dt>Resultado</dt><dd class="${cls(r)}">${sgn(r)}${fmt(Math.abs(r), 2)}R</dd>` : ""}</dl></div>`;
    }
    $("cvSide").innerHTML = `<p class="label">${esc(V.setor || "")}${V.tema ? " · " + esc(V.tema) : ""}</p>
      <h3 style="margin-top:12px">${esc(V.ticker)}</h3><p class="side__name">${esc(V.nome || "")}</p>
      <p class="side__price">${fmt(F.preco, 2)}</p>
      <p class="side__chg"><span class="${cls(F.var_1d)}">${pct(F.var_1d)} no dia</span> · <span class="${cls(F.var_5d)}">${pct(F.var_5d)} em 5 dias</span></p>
      <dl class="kv">
        <dt>3 meses</dt><dd class="${cls(F.var_3m)}">${pct(F.var_3m)}</dd>
        <dt>vs média 50 dias</dt><dd>${pct(F.vs_mm50)}</dd>
        <dt>vs média 200 dias</dt><dd>${pct(F.vs_mm200)}</dd>
        <dt>RSI (14)</dt><dd>${fmt(F.rsi14, 1)}</dd>
        <dt>ATR (14)</dt><dd>${fmt(F.atr14)} · ${pct(F.atr_pct, 1, false)}</dd>
        <dt>Máximo 52 semanas</dt><dd>${fmt(F.max_52s)} <span class="muted">(${pct(F.dist_max_52s, 1)})</span></dd>
        <dt>Próximos resultados</dt><dd>${F.proximos_resultados ? esc(dataCurta(F.proximos_resultados)) : "—"}</dd>
      </dl>${niveis}
      <p class="label" style="margin-top:18px">Dados até ${esc(F.data_dados ? dataCurta(F.data_dados) : "—")} · atraso até 20 min</p>`;
  }

  async function carregarVelas(t, rolar = false) {
    t = String(t || "").trim().toUpperCase();
    if (!t) return;
    S.ticker = t;
    $("cvTitle").textContent = t;
    $("candle").classList.add("is-loading");
    marcarChips();
    if (rolar) $("velas").scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
    try {
      const r = await fetch(ONLINE ? `data/velas/${encodeURIComponent(t)}.json` : `/api/velas?ticker=${encodeURIComponent(t)}&dias=${S.dias}`);
      if (!r.ok) throw new Error(r.status);
      const j = await r.json();
      if (ONLINE) {  // a versao online publica um ano de velas; o periodo corta-se aqui
        const n = S.dias;
        j.velas = j.velas.slice(-n); j.mm20 = j.mm20.slice(-n); j.mm50 = j.mm50.slice(-n); j.mm200 = j.mm200.slice(-n);
      }
      if (j.ticker !== S.ticker) return;
      if (DEMO) {
        const p = ((S.tudo || {}).estado?.posicoes || []).find((x) => x.ticker === j.ticker);
        if (p) j.niveis = { estado: "aberta", entrada: p.preco_medio, stop: p.stop, alvo: p.alvo, setup: p.setup };
      }
      S.velas = j;
      desenharVelas(); lateral();
    } catch (e) {
      $("candle").classList.remove("is-loading");
      $("candle").innerHTML = ONLINE
        ? `<div class="empty"><b>Sem velas de ${esc(t)} na versão online</b>Aqui só há os índices, os setores, as posições e a watchlist. O painel local mostra qualquer ticker.</div>`
        : `<div class="empty"><b>Sem dados para ${esc(t)}</b>Confirme o ticker (ações e ETFs dos EUA, por exemplo AAPL ou XLK).</div>`;
      $("cvLegend").innerHTML = ""; $("cvSide").innerHTML = "";
    }
  }

  function chipsVelas() {
    const D = S.tudo || {}, E = D.estado || {};
    const carteira = [...new Set([...(E.posicoes || []).map((p) => p.ticker), ...(E.pendentes || []).map((p) => p.ticker)])];
    const wl = listaWatch().map((w) => w.ticker).filter((t) => t && !carteira.includes(t)).slice(0, 8);
    const grupo = (rot, lista) => (lista.length ? `<span class="label">${rot}</span>` + lista.map((t) => `<button type="button" class="chip" data-tk="${esc(t)}" aria-pressed="false">${esc(t)}</button>`).join("") : "");
    $("grpIdx").innerHTML = grupo("Índices", ["SPY", "QQQ", "IWM", "DIA"]);
    $("grpPos").innerHTML = grupo("Carteira", carteira);
    $("grpWatch").innerHTML = grupo("Watchlist", wl);
    marcarChips();
  }
  function marcarChips() {
    document.querySelectorAll("[data-tk]").forEach((b) => { if (b.classList.contains("chip")) b.setAttribute("aria-pressed", String(b.dataset.tk === S.ticker)); });
  }
  function controlosVelas() {
    const RANGES = [[21, "1M"], [63, "3M"], [126, "6M"], [252, "1A"]];
    $("grpRange").innerHTML = `<span class="label">Período</span>` + RANGES.map(([d, r]) => `<button type="button" class="chip" data-dias="${d}" aria-pressed="${d === S.dias}">${r}</button>`).join("");
    const T = [["mm20", "MM20", "--accent"], ["mm50", "MM50", "--spy"], ["mm200", "MM200", "--m200"], ["vol", "Volume", "--mute"]];
    $("grpTools").innerHTML = T.map(([k, r, c]) => `<button type="button" class="chip" data-camada="${k}" aria-pressed="${S.camadas[k]}"><i class="k" style="background:var(${c})"></i>${r}</button>`).join("");
  }
  document.addEventListener("click", (e) => {
    const b = e.target.closest("[data-tk],[data-dias],[data-camada],[data-c],[data-ir]");
    if (!b) return;
    if (b.dataset.tk) carregarVelas(b.dataset.tk, b.dataset.rolar === "1");
    else if (b.dataset.dias) { S.dias = +b.dataset.dias; controlosVelas(); carregarVelas(S.ticker); }
    else if (b.dataset.camada) { S.camadas[b.dataset.camada] = !S.camadas[b.dataset.camada]; controlosVelas(); desenharVelas(); legenda((S.velas?.velas.length || 1) - 1); }
    else if (b.dataset.c) abrir(b.dataset.c, b.dataset.t);
    else if (b.dataset.ir) $(b.dataset.ir).scrollIntoView({ behavior: reduce ? "auto" : "smooth" });
  });
  $("cvForm").addEventListener("submit", (e) => { e.preventDefault(); carregarVelas($("cvSearch").value); $("cvSearch").value = ""; });

  // ---------- grafico de linhas (desempenho) ----------
  function linhas(el, { datas, series, height = 250, fmtV = (v) => pct(v, 1), refs = [], area = false }) {
    el.innerHTML = "";
    const W = Math.max(280, el.clientWidth), H = height, m = { l: 48, r: 74, t: 10, b: 24 };
    const iw = W - m.l - m.r, ih = H - m.t - m.b, n = datas.length;
    const vals = series.flatMap((s) => s.values).concat(refs.map((r) => r.y)).concat([0]);
    const mn = Math.min(...vals), mx = Math.max(...vals), folga = (mx - mn) * 0.08 || 1;
    const y0 = mn - folga, y1 = mx + folga;
    const { ticks } = niceTicks(y0, y1, 5);
    const X = (i) => m.l + (n <= 1 ? iw / 2 : (i / (n - 1)) * iw);
    const Y = (v) => m.t + ih - ((v - y0) / (y1 - y0 || 1)) * ih;
    const cLine = css("--line"), cMute = css("--mute"), cSurf = css("--white");
    let g = "";
    ticks.forEach((t) => {
      g += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(t)}" y2="${Y(t)}" stroke="${t === 0 ? cMute : cLine}" stroke-opacity="${t === 0 ? 0.5 : 1}" stroke-width="1"/>`;
      g += `<text x="${m.l - 8}" y="${Y(t) + 4}" text-anchor="end">${esc(pct(t, Number.isInteger(t) ? 0 : 1, false))}</text>`;
    });
    refs.forEach((r) => {
      g += `<line x1="${m.l}" x2="${W - m.r}" y1="${Y(r.y)}" y2="${Y(r.y)}" stroke="${cMute}" stroke-opacity=".6" stroke-width="1"/><text x="${W - m.r + 8}" y="${Y(r.y) + 4}">${esc(r.label)}</text>`;
    });
    const nt = Math.min(n, Math.max(2, Math.floor(iw / 90)));
    for (let k = 0; k < nt; k++) {
      const i = n <= 1 ? 0 : Math.round((k / (nt - 1)) * (n - 1));
      g += `<text x="${X(i)}" y="${H - 6}" text-anchor="middle">${esc(dataCurta(datas[i]))}</text>`;
    }
    series.forEach((s) => {
      const d = s.values.map((v, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(v).toFixed(1)}`).join("");
      if (area) g += `<path d="${d}L${X(n - 1)},${Y(0)}L${X(0)},${Y(0)}Z" fill="${css(s.cor)}" fill-opacity=".1"/>`;
      g += `<path d="${d}" fill="none" stroke="${css(s.cor)}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round"/>`;
    });
    const fins = series.map((s) => ({ s, y: Y(s.values[n - 1]) })).sort((a, b) => a.y - b.y);
    for (let k = 1; k < fins.length; k++) if (fins[k].y - (fins[k - 1].ly || fins[k - 1].y) < 15) fins[k].ly = (fins[k - 1].ly || fins[k - 1].y) + 15;
    fins.forEach((f) => {
      g += `<circle cx="${X(n - 1)}" cy="${f.y}" r="4" fill="${css(f.s.cor)}" stroke="${cSurf}" stroke-width="2"/>`;
      g += `<text class="t-end" x="${X(n - 1) + 10}" y="${(f.ly || f.y) + 4}">${esc(fmtV(f.s.values[n - 1]))}</text>`;
    });
    g += `<line id="lx" y1="${m.t}" y2="${m.t + ih}" stroke="${cMute}" stroke-width="1" visibility="hidden"/><g id="ld"></g><rect id="lh" x="${m.l}" y="${m.t}" width="${iw}" height="${ih}" fill="transparent"/>`;
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" height="${H}" role="img" aria-label="${esc(series.map((s) => s.nome + ": " + fmtV(s.values[n - 1])).join(", "))}">${g}</svg><div class="tip-l" style="position:absolute;top:6px;left:56px;font-family:var(--f-mono);font-size:12px;color:var(--mute);pointer-events:none"></div>`;
    const svg = el.querySelector("svg"), tip = el.querySelector(".tip-l"), lx = svg.querySelector("#lx"), ld = svg.querySelector("#ld");
    const mostrar = (ev) => {
      const r = svg.getBoundingClientRect(), x = (ev.clientX - r.left) * (W / r.width);
      const i = Math.max(0, Math.min(n - 1, Math.round(((x - m.l) / iw) * (n - 1))));
      lx.setAttribute("x1", X(i)); lx.setAttribute("x2", X(i)); lx.setAttribute("visibility", "visible");
      ld.innerHTML = series.map((s) => `<circle cx="${X(i)}" cy="${Y(s.values[i])}" r="4" fill="${css(s.cor)}" stroke="${cSurf}" stroke-width="2"/>`).join("");
      tip.innerHTML = `<b style="color:var(--ink);font-weight:500">${esc(dataCurta(datas[i]))}</b> · ` + series.map((s) => `${esc(s.nome)} <b style="color:var(--ink);font-weight:500">${esc(fmtV(s.values[i]))}</b>`).join(" · ");
    };
    svg.querySelector("#lh").addEventListener("pointermove", mostrar);
    svg.querySelector("#lh").addEventListener("pointerleave", () => { lx.setAttribute("visibility", "hidden"); ld.innerHTML = ""; tip.innerHTML = ""; });
  }

  // ---------- mini graficos ----------
  function spark(vals, cor = "--accent", w = 96, h = 28) {
    const v = (vals || []).filter(ok);
    if (v.length < 2) return "";
    const lo = Math.min(...v), hi = Math.max(...v), X = (i) => (i / (v.length - 1)) * (w - 4) + 2, Y = (x) => h - 3 - ((x - lo) / (hi - lo || 1)) * (h - 6);
    const d = v.map((x, i) => `${i ? "L" : "M"}${X(i).toFixed(1)},${Y(x).toFixed(1)}`).join("");
    return `<svg class="spark" viewBox="0 0 ${w} ${h}" aria-hidden="true"><path d="${d}" fill="none" stroke="var(${cor})" stroke-width="1.6" stroke-linejoin="round" stroke-linecap="round"/><circle cx="${X(v.length - 1)}" cy="${Y(v[v.length - 1])}" r="2.6" fill="var(${cor})"/></svg>`;
  }
  function miniVelas(sp, niveis) {
    if (!sp || !sp.c || sp.c.length < 5) return "";
    const n = sp.c.length, w = 320, h = 74, bw = w / n;
    const extra = [niveis.stop, niveis.entrada, niveis.alvo].filter((x) => ok(x) && x > 0);
    const lo = Math.min(...sp.l, ...extra), hi = Math.max(...sp.h, ...extra);
    const Y = (v) => h - 3 - ((v - lo) / (hi - lo || 1)) * (h - 6);
    let g = "";
    const lin = (v, cor) => (ok(v) && v > 0 ? `<line x1="0" x2="${w}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="${cor}" stroke-width="1" stroke-opacity=".8"/>` : "");
    g += lin(niveis.stop, "var(--down-band)") + lin(niveis.entrada, "var(--band-mute)") + lin(niveis.alvo, "var(--up-band)");
    for (let i = 0; i < n; i++) {
      const up = sp.c[i] >= sp.o[i], cor = up ? "var(--up-band)" : "var(--down-band)", x = bw * (i + 0.5), cw = Math.max(1, bw * 0.6);
      const yT = Y(Math.max(sp.o[i], sp.c[i])), yB = Y(Math.min(sp.o[i], sp.c[i]));
      g += `<line x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${Y(sp.h[i]).toFixed(1)}" y2="${Y(sp.l[i]).toFixed(1)}" stroke="${cor}" stroke-width="1"/>`;
      g += `<rect x="${(x - cw / 2).toFixed(1)}" y="${yT.toFixed(1)}" width="${cw.toFixed(1)}" height="${Math.max(1, yB - yT).toFixed(1)}" fill="${up ? "var(--band-2)" : cor}" stroke="${cor}" stroke-width="${up ? 1 : 0}"/>`;
    }
    return `<svg viewBox="0 0 ${w} ${h}" style="width:100%;height:auto;display:block" aria-hidden="true">${g}</svg>`;
  }

  // ---------- seccoes ----------
  function listaWatch() {
    let W = S.tudo && S.tudo.watchlist;
    if (W && !Array.isArray(W)) W = W.candidatos || W.watchlist || W.lista || [];
    return Array.isArray(W) ? W : [];
  }

  function heroi(D) {
    const E = D.estado || {}, L = D.limites || {}, C = D.curva || [];
    const eq = E.equity || 0;
    contar($("heroCap"), eq, (v) => nf(0).format(Math.round(v)), 1400);
    // A comparacao com o S&P 500 so comeca quando o bot abre a primeira posicao (o motor manda curva vazia antes).
    const ult = C.length >= 2 ? C[C.length - 1] : null;
    const pnlDia = E.conta && E.conta.last_equity ? eq - E.conta.last_equity : 0;
    const p = proximoCiclo();
    let lead;
    if (ult) {
      lead = `Desde o primeiro trade (${esc(dataCurta(C[0].data))}), o bot fez <b class="${cls(ult.ret_pct)}">${pct(ult.ret_pct)}</b> e o S&amp;P 500 <b class="${cls(ult.spy_ret_pct)}">${pct(ult.spy_ret_pct)}</b>. Hoje: <b class="${cls(E.pnl_dia_pct)}">${pct(E.pnl_dia_pct)}</b> (${usdS(pnlDia)}).`;
    } else {
      const pend = E.n_pendentes ? ` Há ${E.n_pendentes} entrada(s) à espera de execução.` : "";
      lead = `A conta paper começou a ${esc(dataCurta(D.inicio || new Date().toISOString()))} com <b>${usd(100000)}</b> e está em <b>${usd(eq)}</b>. Ainda não abriu nenhuma posição: a comparação com o S&amp;P 500 começa no primeiro trade.${pend}${p ? ` O próximo ciclo (${esc(p.nome.toLowerCase())}) é ${esc(p.quando)}.` : ""}`;
    }
    $("heroLead").innerHTML = lead;

    const expo = E.exposicao_pct || 0, teto = L.exposicao_bruta_max_pct || 100;
    const risco = E.risco_aberto_pct || 0, tetoR = L.risco_aberto_max_pct || 15;
    const dd = E.drawdown_pct || 0, ddMax = L.drawdown_parar_pct || 20, ddRed = L.drawdown_reduzir_pct || 12;
    const vs = ult ? ult.ret_pct - ult.spy_ret_pct : null;
    const meter = (v, t, aviso) => `<div class="meter ${v >= t ? "is-crit" : v >= aviso ? "is-warn" : ""}"><i style="transform:scaleX(${Math.max(0, Math.min(1, v / t)).toFixed(3)})"></i></div>`;
    const F = [
      ["Hoje", `<span class="${cls(E.pnl_dia_pct)}">${pct(E.pnl_dia_pct)}</span>`, usdS(pnlDia)],
      ["Bot vs S&amp;P 500", ok(vs) ? `<span class="${cls(vs)}">${sgn(vs)}${fmt(Math.abs(vs), 2)} pp</span>` : "—", ult ? `bot ${pct(ult.ret_pct)} · SPY ${pct(ult.spy_ret_pct)} desde o 1.º trade` : "começa no primeiro trade"],
      ["Queda desde o máximo", pct(dd, 2, false), meter(-dd, ddMax, ddRed) + `<div class="fact__n">reduz a −${ddRed}% · pára a −${ddMax}%</div>`],
      ["Exposição", pct(expo, 0, false), meter(expo, teto, teto * 0.9) + `<div class="fact__n">máx. ${teto}% (${L.exposicao_bruta_max_alavancada_pct || 150}% em risk-on)</div>`],
      ["Risco aberto", pct(risco, 1, false), meter(risco, tetoR, tetoR * 0.8) + `<div class="fact__n">se todos os stops dispararem · máx. ${tetoR}%</div>`],
      ["Posições", `${E.n_posicoes || 0}<span class="muted" style="font-size:.55em"> / ${L.max_posicoes || 8}</span>`, `${E.n_pendentes || 0} entrada(s) pendente(s)`],
    ];
    $("facts").innerHTML = F.map(([l, v, n]) => `<div class="fact"><p class="label">${l}</p><p class="fact__v">${v}</p>${n.startsWith("<") ? n : `<p class="fact__n">${n}</p>`}</div>`).join("");

    const al = (E.alertas || []).map((a) => {
      const crit = a.startsWith("ALERTA");
      return `<div class="alert ${crit ? "is-crit" : ""}"><span class="ic">!</span><div><b>${crit ? "Alerta" : "Aviso"}</b>${esc(a.replace(/^ALERTA:\s*/, ""))}</div></div>`;
    });
    if (E.modo_risco && E.modo_risco !== "normal") al.unshift(`<div class="alert is-crit"><span class="ic">!</span><div><b>Modo de risco: ${esc(E.modo_risco)}</b>queda de ${pct(dd)} desde o máximo; hoje ${pct(E.pnl_dia_pct)}.</div></div>`);
    $("alerts").innerHTML = al.join("");

    const rel = E.relogio, pill = $("mkt");
    pill.classList.toggle("is-open", !!(rel && rel.aberto));
    // o detalhe (hora) esconde-se no telemovel para caber no cabecalho
    pill.querySelector("span").innerHTML = rel ? (rel.aberto ? `Aberta<span class="pill__x"> · fecha ${esc(hora(rel.proximo_fecho))}</span>` : `Fechada<span class="pill__x"> · abre ${esc(quando(rel.proxima_abertura))}</span>`) : "Sem ligação";
    $("ftSync").textContent = ONLINE && D.publicado ? `versão online, publicada às ${hora(D.publicado)} (atualiza a cada 10 min com a bolsa aberta)`
      : D.sync && D.sync.ultimo ? `sincronizado às ${hora(D.sync.ultimo)}` : `atualizado às ${hora(D.agora)}`;
  }

  function fita() {
    const M = S.mercado || {}, D = S.tudo || {}, E = D.estado || {};
    const itens = [];
    (M.indices || []).forEach((i) => itens.push([i.ticker, i.preco, i.var_1d]));
    if (M.vix) itens.push(["VIX", M.vix.nivel, null, M.vix.var_1d]);
    const extra = [...(E.posicoes || []).map((p) => p.ticker), ...listaWatch().map((w) => w.ticker)];
    [...new Set(extra)].forEach((t) => { const s = S.sparks[t]; if (s) itens.push([t, s.preco, s.var_1d]); });
    (M.setores || []).slice(0, 6).forEach((s) => itens.push([s.etf, null, s.var_1d]));
    if (!itens.length) return;
    const html = itens.map(([t, p, v, dv]) => `<span class="tape__item">${MARK}<b>${esc(t)}</b>${ok(p) ? fmt(p, 2) : ""}${ok(v) ? ` <span class="${cls(v)}">${pct(v)}</span>` : ""}${ok(dv) ? ` <span class="${cls(-dv)}">${sgn(dv)}${fmt(Math.abs(dv), 2)}</span>` : ""}</span>`).join("");
    if (html === S.fita) return;
    S.fita = html;
    $("tape").innerHTML = html + html;
  }

  function desempenho(D) {
    const C = D.curva || [], M = D.metricas || {}, L = D.limites || {};
    const ddRed = L.drawdown_reduzir_pct || 20, ddPara = L.drawdown_parar_pct || 35;
    $("ddLbl").textContent = `−${ddRed}% reduz · −${ddPara}% pára`;
    if (C.length < 2) {
      $("eqLegend").innerHTML = "";
      $("eqChart").innerHTML = `<div class="empty"><b>A comparação começa no primeiro trade.</b>Quando o bot abrir a primeira posição, aparece aqui o capital do bot ao lado do S&amp;P 500, a partir desse minuto.</div>`;
      $("ddChart").innerHTML = ""; $("eqTable").innerHTML = "";
    } else {
      const datas = C.map((p) => (p.inicio ? "1.º trade" : p.data));
      $("eqLegend").innerHTML = `<span><i style="background:var(--accent)"></i>Bot</span><span><i style="background:var(--spy)"></i>S&amp;P 500 (SPY)</span>`;
      linhas($("eqChart"), { datas, series: [{ nome: "Bot", cor: "--accent", values: C.map((p) => p.ret_pct) }, { nome: "S&P 500", cor: "--spy", values: C.map((p) => p.spy_ret_pct) }] });
      linhas($("ddChart"), { datas, height: 140, area: true, refs: [{ y: -ddRed, label: `−${ddRed}%` }, { y: -ddPara, label: `−${ddPara}%` }], series: [{ nome: "Queda", cor: "--dd", values: C.map((p) => p.drawdown_pct) }] });
      $("eqTable").innerHTML = "<table><thead><tr><th>Data</th><th class='n'>Capital</th><th class='n'>Bot</th><th class='n'>S&amp;P 500</th><th class='n'>Queda</th></tr></thead><tbody>" +
        C.slice().reverse().map((p) => `<tr><td>${esc(p.data)}${p.inicio ? " (1.º trade)" : ""}</td><td class="n">${usd(p.equity)}</td><td class="n">${pct(p.ret_pct)}</td><td class="n">${pct(p.spy_ret_pct)}</td><td class="n">${pct(p.drawdown_pct, 2, false)}</td></tr>`).join("") + "</tbody></table>";
    }
    const ult = C.length >= 2 ? C[C.length - 1] : null;
    const ddMax = C.length ? Math.min(...C.map((p) => p.drawdown_pct)) : 0;
    const T = [
      ["Retorno", ult ? `<span class="${cls(ult.ret_pct)}">${pct(ult.ret_pct)}</span>` : "—", "desde o primeiro trade"],
      ["S&amp;P 500", ult ? `<span class="${cls(ult.spy_ret_pct)}">${pct(ult.spy_ret_pct)}</span>` : "—", "no mesmo período"],
      ["Queda máxima", pct(ddMax, 2, false), "pior momento até agora"],
      ["Trades fechados", String(M.n || 0), M.n ? `${pct(M.acerto_pct, 0, false)} com lucro` : "ainda nenhum"],
      ["R médio", ok(M.r_medio) ? `<span class="${cls(M.r_medio)}">${sgn(M.r_medio)}${fmt(Math.abs(M.r_medio), 2)}R</span>` : "—", "ganho médio por unidade de risco"],
      ["Profit factor", ok(M.profit_factor) ? fmt(M.profit_factor, 2) : "—", "lucros ÷ perdas"],
      ["P&amp;L realizado", M.n ? `<span class="${cls(M.pnl_total)}">${usdS(M.pnl_total)}</span>` : "—", "trades já fechados"],
      ["Melhor · pior", M.n ? `${esc(M.melhor)} · ${esc(M.pior)}` : "—", "por P&amp;L"],
    ];
    $("stats").innerHTML = T.map(([l, v, n]) => `<div class="stat"><p class="label">${l}</p><p class="stat__v">${v}</p><p class="stat__n">${n}</p></div>`).join("");
  }

  function posicoes(D) {
    const E = D.estado || {}, P = E.posicoes || [], R = D.regime || {}, M = S.mercado || {};
    const regime = R.regime || M.leitura;
    $("posAside").textContent = P.length ? `${P.length} posição(ões) · exposição ${pct(E.exposicao_pct, 0, false)} · risco aberto ${pct(E.risco_aberto_pct, 1, false)}` : "Cada posição tem stop na corretora desde o primeiro minuto.";
    if (!P.length) {
      $("posGrid").innerHTML = `<div class="empty"><b>Sem posições abertas.</b>${regime === "risk-off" ? "Com o mercado em risk-off, ficar de fora também é uma decisão." : "As entradas aparecem aqui assim que a corretora as executar."}</div>`;
    } else {
      $("posGrid").innerHTML = `<div class="pos-grid">` + P.map((p) => {
        const stop = p.stop || p.stop_inicial, ent = p.preco_medio, alvo = p.alvo;
        const topo = alvo || (stop && ent > stop ? ent + 3 * (ent - stop) : ent * 1.1);
        const lo = Math.min(stop || ent * 0.9, p.preco), hi = Math.max(topo, p.preco);
        const pos = (v) => (((v - lo) / (hi - lo || 1)) * 100).toFixed(2) + "%";
        const sp = S.sparks[p.ticker];
        return `<article class="pcard">
          <div class="pcard__top"><div><div class="pcard__tk">${esc(p.ticker)}</div><div class="pcard__nm">${esc(p.setor || "")}</div></div>${p.setup ? `<span class="tag">${esc(p.setup)}</span>` : ""}</div>
          <div class="pcard__pl"><b class="${cls(p.pnl)}">${usdS(p.pnl)}</b><span class="${cls(p.pnl_pct)}">${pct(p.pnl_pct)}</span>${ok(p.r) ? `<span>${sgn(p.r)}${fmt(Math.abs(p.r), 2)}R</span>` : ""}${p.sem_stop ? `<span class="tag tag--bad">sem stop</span>` : ""}</div>
          ${miniVelas(sp, { stop, entrada: ent, alvo })}
          <div><div class="ruler" aria-hidden="true"><div class="ruler__track"></div>${stop ? `<i class="ruler__tick" style="left:${pos(stop)}"></i>` : ""}<i class="ruler__tick" style="left:${pos(ent)}"></i>${alvo ? `<i class="ruler__tick" style="left:${pos(alvo)}"></i>` : ""}<i class="ruler__now" style="left:${pos(p.preco)}"></i></div>
          <div class="ruler__lbl"><span>Stop <b>${fmt(stop)}</b></span><span>Entrada <b>${fmt(ent)}</b></span><span>${alvo ? `Alvo <b>${fmt(alvo)}</b>` : "Alvo <b>trailing</b>"}</span></div></div>
          <div class="pcard__foot"><span>${fmt(p.qtd, 0)} ações · ${usd(p.valor)} · agora ${fmt(p.preco)}</span><button type="button" class="link" data-tk="${esc(p.ticker)}" data-rolar="1">Ver velas <span class="ar">→</span></button></div>
        </article>`;
      }).join("") + `</div>`;
    }
    const PE = E.pendentes || [];
    $("pend").innerHTML = PE.length ? `<p class="label" style="margin-bottom:12px">Entradas pendentes</p><div class="scroll"><table class="tcards"><thead><tr><th>Ativo</th><th>Tipo</th><th class="n">Qtd</th><th class="n">Preço</th><th class="n">Stop</th><th class="n">Valor</th><th>Enviada</th></tr></thead><tbody>` +
      PE.map((p) => `<tr class="is-click" data-tk="${esc(p.ticker)}" data-rolar="1"><td class="tk">${esc(p.ticker)}</td><td data-l="Tipo">${esc(p.tipo)}</td><td class="n" data-l="Qtd">${fmt(p.qtd, 0)}</td><td class="n" data-l="Preço">${fmt(p.entrada)}</td><td class="n" data-l="Stop">${fmt(p.stop)}</td><td class="n" data-l="Valor">${usd(p.valor)}</td><td class="n" data-l="Enviada">${dh(p.submetida)}</td></tr>`).join("") + "</tbody></table></div>" : "";
  }

  function regime(D) {
    const R = D.regime, M = S.mercado || {};
    const palavra = (R && R.regime) || M.leitura || "—";
    const ag = R ? R.agressividade || 0 : null;
    const spy = (M.indices || []).find((i) => i.ticker === "SPY");
    const lead = R && R.resumo ? esc(R.resumo)
      : spy ? `Leitura mecânica do motor: SPY ${pct(spy.vs_mm50, 1)} face à média de 50 dias e ${pct(spy.vs_mm200, 1)} face à de 200${M.vix ? `, VIX a ${fmt(M.vix.nivel, 1)}` : ""}. O Estratega publica a leitura dele no ciclo de preparação.` : "A carregar o mercado…";
    const cols = R ? `<div class="reg__cols">
        <div><h4>Favorecer</h4><div class="reg__chips">${(R.setores_favorecer || []).map((s) => `<span>${esc(s)}</span>`).join("") || "<span>—</span>"}</div></div>
        <div><h4>Evitar</h4><div class="reg__chips">${(R.setores_evitar || []).map((s) => `<span>${esc(s)}</span>`).join("") || "<span>—</span>"}</div></div>
        <div><h4>Próximos eventos</h4><div class="reg__ev">${(R.eventos || []).slice(0, 5).map((e) => `<div><b>${esc(e.data ? dataCurta(e.data) : "")}</b><span>${esc(e.evento)}${e.impacto ? ` · ${esc(e.impacto)}` : ""}</span></div>`).join("") || "<div>—</div>"}</div></div>
      </div>` : "";
    $("regMain").innerHTML = `<p class="label">05 — Regime de mercado · ${R ? `pelo Estratega · ${esc(diaHora(R.atualizado))}` : "leitura mecânica do motor"}</p>
      <p class="reg__word">${esc(palavra)}</p>
      ${R ? `<div class="reg__aggr">Agressividade <span>${[1, 2, 3, 4, 5].map((k) => `<i class="${k <= ag ? "on" : ""}"></i>`).join("")}</span> ${ag}/5 · exposição máx. ${R.exposicao_max_pct ?? "—"}%${R.bloquear_entradas ? " · entradas bloqueadas" : ""}</div>` : ""}
      <p class="reg__lead">${lead}</p>${cols}`;
    $("regMkt").innerHTML = (M.indices || []).length ? `<div class="mkt">
        ${M.vix ? `<div class="mkt__vix"><div><p class="label">VIX · medo do mercado</p><strong>${fmt(M.vix.nivel, 1)}</strong></div><span class="label">percentil ${fmt(M.vix.percentil_1a, 0)} em 1 ano</span></div>` : ""}
        ${M.indices.map((i) => `<div class="mkt__row"><b>${esc(i.ticker)}</b><span>${fmt(i.preco, 2)}</span><span class="c">${pct(i.var_1d)}</span><span class="c">${pct(i.vs_mm50, 1)} vs MM50</span></div>`).join("")}
        <p class="label" style="margin-top:12px">Dados até ${esc(M.data_dados ? dataCurta(M.data_dados) : "—")}</p></div>` : "";
    const SE = M.setores || [];
    if (SE.length) {
      const mx = Math.max(...SE.map((s) => Math.abs(s.vs_spy_1m || 0)), 1);
      $("regBars").innerHTML = `<h4>Setores contra o S&amp;P 500 · último mês</h4>` + SE.map((s) => {
        const v = s.vs_spy_1m || 0, w = (Math.abs(v) / mx) * 50;
        return `<div class="bar"><span>${esc(s.nome)} <span style="opacity:.6;font-family:var(--f-mono);font-size:11.5px">${esc(s.etf)}</span></span><div class="bar__track"><i class="bar__fill ${v < 0 ? "neg" : ""}" style="left:${v < 0 ? 50 - w : 50}%;width:${w}%"></i></div><span class="bar__v">${sgn(v)}${fmt(Math.abs(v), 1)} pp</span></div>`;
      }).join("");
    }
  }

  function decisoes(D) {
    const DEC = D.decisoes || [], n = DEC.length, p = proximoCiclo();
    if (!n) {
      $("decs").innerHTML = `<div class="dec is-first"><div class="dec__n">00</div><div><div class="dec__meta"><span class="tag tag--acc">à espera</span></div><h3 class="dec__title">Ainda não há decisões.</h3><p class="dec__just">${p ? `O próximo ciclo é ${esc(p.nome.toLowerCase())}, ${esc(p.quando)}. ` : ""}A primeira decisão aparece aqui com a justificação completa e o que foi enviado à corretora.</p></div></div>`;
      return;
    }
    $("decs").innerHTML = DEC.map((d, k) => {
      const env = (d.resultado && d.resultado.enviados) || [], ok2 = env.filter((e) => e.enviado).length;
      const tr = (d.conteudo && d.conteudo.trades) || [];
      const titulo = tr.length ? (ok2 ? `${ok2} ordem(ns) enviada(s) de ${tr.length} proposta(s)` : `${tr.length} proposta(s), nenhuma enviada`) : "Sem trades neste ciclo";
      return `<article class="dec ${k === 0 ? "is-first" : ""}"><div class="dec__n">${String(n - k).padStart(2, "0")}</div><div>
        <div class="dec__meta"><span class="tag tag--acc">${esc(d.ciclo)}</span><span class="label">${esc(diaHora(d.ts))}</span></div>
        <h3 class="dec__title">${titulo}</h3>
        ${d.conteudo && d.conteudo.justificacao ? `<p class="dec__just">${esc(d.conteudo.justificacao)}</p>` : ""}
        ${tr.length ? `<div class="scroll"><table class="tcards"><thead><tr><th>Ativo</th><th>Setup</th><th class="n">Entrada</th><th class="n">Stop</th><th class="n">Alvo</th><th>Conv.</th><th>Corretora</th></tr></thead><tbody>` +
          tr.map((t) => { const e = env.find((x) => x.ticker === String(t.ticker).toUpperCase()) || {};
            return `<tr class="is-click" data-tk="${esc(String(t.ticker).toUpperCase())}" data-rolar="1"><td class="tk">${esc(t.ticker)}${t.tese ? `<span class="sub">${esc(t.tese)}</span>` : ""}</td><td data-l="Setup">${esc(t.setup || "")}</td><td class="n" data-l="Entrada">${fmt(t.entrada)}</td><td class="n" data-l="Stop">${fmt(t.stop)}</td><td class="n" data-l="Alvo">${t.alvo ? fmt(t.alvo) : "trailing"}</td><td data-l="Conv.">${esc(t.conviccao || "")}</td>
            <td data-l="Corretora">${e.enviado ? `<span class="tag tag--ok">${fmt(e.qtd, 0)} ações</span>` : `<span class="tag tag--bad">não enviada</span>${e.motivo ? `<span class="sub">${esc(e.motivo)}</span>` : ""}`}</td></tr>`; }).join("") + "</tbody></table></div>" : ""}
      </div></article>`;
    }).join("");
  }

  function equipa(D) {
    const RL = D.relatorios || [], DEC = D.decisoes || [];
    $("team").innerHTML = AGENTES.map(([a, papel, poder], k) => {
      const boss = a === "TradingMaster";
      const r = boss ? null : RL.find((x) => x.agente === a);
      const ultimo = boss ? (DEC[0] ? `<span>última decisão</span><b>${esc(DEC[0].ciclo)}</b>` : "<span>sem decisões ainda</span>")
        : r ? `<span>${esc(r.nome)}</span><b>${esc(dh(new Date(r.mtime * 1000).toISOString()))}</b>` : "<span>sem relatórios ainda</span>";
      const attrs = boss ? `data-ir="decisoes"` : r ? `data-c="${esc(r.caminho)}" data-t="${esc((NOME[a] || a) + " · " + r.nome)}"` : "disabled";
      return `<button type="button" class="agent ${boss ? "agent--boss" : ""}" ${attrs}>
        <div class="agent__top"><span class="agent__n">${String(k + 1).padStart(2, "0")}</span><span class="tag ${poder === "Veto" ? "tag--bad" : poder === "Decisão final" ? "" : "tag--acc"}">${esc(poder)}</span></div>
        <h3>${esc(NOME[a] || a)}</h3><p>${esc(papel)}</p><div class="agent__last">${ultimo}</div></button>`;
    }).join("");
    $("repCount").textContent = RL.length ? `${RL.length} ficheiro(s)` : "";
    $("reports").innerHTML = RL.length ? RL.slice(0, 10).map((r) => `<button type="button" data-c="${esc(r.caminho)}" data-t="${esc((NOME[r.agente] || r.agente) + " · " + r.nome)}"><span><b>${esc(NOME[r.agente] || r.agente)}</b> · ${esc(r.nome)}</span><span class="when">${esc(dh(new Date(r.mtime * 1000).toISOString()))}</span></button>`).join("") : `<p class="muted" style="font-size:14.5px">Os relatórios aparecem a partir do primeiro ciclo.</p>`;
    const DI = D.diarios || [];
    $("diary").innerHTML = DI.length ? DI.map((r) => `<button type="button" data-c="${esc(r.caminho)}" data-t="Diário · ${esc(r.nome)}"><span>${esc(dataCurta(r.nome))}</span><span class="when">${esc(r.nome)}</span></button>`).join("") : `<p class="muted" style="font-size:14.5px">O Auditor escreve o diário no fim de cada dia de trading.</p>`;
  }

  function historico(D) {
    const F = D.trades_fechados || [];
    $("closedCount").textContent = F.length ? `${F.length} trade(s)` : "";
    $("closed").innerHTML = F.length ? `<table class="tcards"><thead><tr><th>Ativo</th><th>Setup</th><th class="n">Entrada</th><th class="n">Saída</th><th class="n">Qtd</th><th class="n">P&amp;L</th><th class="n">R</th><th>Motivo</th><th>Fecho</th></tr></thead><tbody>` +
      F.map((t) => `<tr class="is-click" data-tk="${esc(t.ticker)}" data-rolar="1"><td class="tk">${esc(t.ticker)}</td><td data-l="Setup">${esc(t.setup || "")}</td><td class="n" data-l="Entrada">${fmt(t.preco_entrada)}</td><td class="n" data-l="Saída">${fmt(t.preco_saida)}</td><td class="n" data-l="Qtd">${fmt(t.qtd, 0)}</td>
        <td class="n ${cls(t.pnl)}" data-l="P&amp;L">${usdS(t.pnl)}</td><td class="n" data-l="R">${ok(t.r) ? sgn(t.r) + fmt(Math.abs(t.r), 2) + "R" : "—"}</td><td class="span2" data-l="Motivo">${esc(t.motivo_saida || "")}</td><td class="n" data-l="Fecho">${esc(dh(t.fechado))}</td></tr>`).join("") + "</tbody></table>"
      : `<div class="empty"><b>Ainda não há trades fechados.</b>Cada trade fechado aparece aqui com o resultado em dólares e em R.</div>`;
    const W = listaWatch();
    $("watch").innerHTML = W.length ? `<table class="tcards"><thead><tr><th>Ativo</th><th>Setup</th><th>40 dias</th><th class="n">Dia</th><th>Catalisador</th></tr></thead><tbody>` +
      W.slice(0, 15).map((w) => { const s = S.sparks[w.ticker] || {};
        return `<tr class="is-click" data-tk="${esc(w.ticker)}" data-rolar="1"><td class="tk">${esc(w.ticker)}${ok(w.pontuacao) ? `<span class="sub">pont. ${esc(w.pontuacao)}</span>` : ""}</td><td data-l="Setup">${esc(w.setup || "")}</td><td data-l="40 dias">${spark(s.c)}</td><td class="n ${cls(s.var_1d)}" data-l="Dia">${pct(s.var_1d)}</td><td class="wide" style="min-width:14em" data-l="Catalisador">${esc(w.catalisador || w.motivo || "")}</td></tr>`; }).join("") + "</tbody></table>"
      : `<div class="empty"><b>O Caçador ainda não publicou candidatos.</b>A watchlist é atualizada em cada ciclo de preparação.</div>`;
    const EV = D.eventos || [];
    $("events").innerHTML = EV.length ? EV.map((e) => `<div><span class="t">${esc(dh(e.ts))}</span><span class="y">${esc(e.tipo)}</span><span>${esc(e.mensagem)}</span></div>`).join("") : `<p class="muted" style="font-size:14.5px">Sem eventos ainda.</p>`;
  }

  function redesenhar() {
    if (S.velas) desenharVelas();
    if (S.tudo) desempenho(S.tudo);
  }

  function render() {
    const D = S.tudo; if (!D) return;
    heroi(D); desempenho(D); posicoes(D); regime(D); decisoes(D); equipa(D); historico(D);
    chipsVelas(); fita();
  }

  // ---------- modo de demonstracao (?demo): dados ficticios so no browser, para ver o painel cheio ----------
  const DEMO = new URLSearchParams(location.search).has("demo");
  // Versao online (GitHub Pages): so leitura, os dados vem de ficheiros JSON publicados pelo painel local (bot/publicar.py)
  const ONLINE = !!document.querySelector('meta[name="tm-online"]');
  if (DEMO) {
    document.documentElement.classList.add("is-demo");
    const bar = document.createElement("a");
    bar.className = "demo-bar";
    bar.href = location.pathname;
    bar.innerHTML = "<b>Demonstração</b> Estes números são inventados. <u>Abrir a conta real</u>";
    document.body.appendChild(bar);
    const pill = document.querySelector(".pill--paper");
    if (pill) pill.textContent = "Demo";
  }
  function demo(D) {
    const C = []; let e = 100000, s = 0, pk = e;
    const d0 = new Date(D.inicio + "T12:00:00");
    for (let i = 0; C.length < 26; i++) {
      const d = new Date(d0); d.setDate(d.getDate() + i);
      if (d.getDay() % 6 === 0) continue;
      e *= 1 + Math.sin(i / 3) * 0.006 + 0.0022; s += Math.cos(i / 4) * 0.35 - 0.05; pk = Math.max(pk, e);
      C.push({ data: d.toISOString().slice(0, 10), equity: e, ret_pct: (e / 100000 - 1) * 100, spy_ret_pct: s, drawdown_pct: (e / pk - 1) * 100 });
    }
    const agora = new Date().toISOString();
    return { ...D,
      curva: C,
      estado: { ...D.estado, equity: e, pnl_dia_pct: 0.42, drawdown_pct: -1.2, exposicao_pct: 46, risco_aberto_pct: 3.1, n_posicoes: 2, n_pendentes: 1,
        alertas: ["Dados de demonstração: nada disto é real. Tire ?demo do endereço para voltar à conta."],
        posicoes: [
          { ticker: "MTD", setor: "Health Care", qtd: 14, preco_medio: 1690, preco: 1741.2, valor: 24377, pnl: 716.8, pnl_pct: 3.03, r: 0.82, stop: 1628, stop_inicial: 1628, alvo: 1876, setup: "recuo" },
          { ticker: "TMO", setor: "Health Care", qtd: 36, preco_medio: 688, preco: 681.5, valor: 24534, pnl: -234, pnl_pct: -0.94, r: -0.33, stop: 668.5, stop_inicial: 668.5, alvo: null, setup: "recuo" },
        ],
        pendentes: [{ ticker: "BBY", tipo: "limit", qtd: 120, entrada: 98.4, stop: 93.2, valor: 11808, submetida: agora }] },
      regime: { regime: "risk-off", agressividade: 2, exposicao_max_pct: 50, bloquear_entradas: false, atualizado: agora,
        resumo: "VIX no percentil 98 e o SPY 6% abaixo da média de 50 dias. Só setups A+ em setores defensivos, com metade do risco.",
        setores_favorecer: ["Health Care", "Consumer Staples"], setores_evitar: ["Information Technology", "Consumer Discretionary"],
        eventos: [{ data: "2026-11-25", evento: "PCE de outubro", impacto: "alto" }, { data: "2026-11-26", evento: "Bolsa fechada (Thanksgiving)", impacto: "—" }] },
      watchlist: [
        { ticker: "MTD", setup: "recuo", pontuacao: 88, catalisador: "Recuo até à MM20 com volume a descer" },
        { ticker: "TMO", setup: "recuo", pontuacao: 87.6, catalisador: "Líder de saúde, força relativa 97" },
        { ticker: "BIIB", setup: "recuo", pontuacao: 86.4, catalisador: "Resultados acima do esperado em outubro" },
        { ticker: "GILD", setup: "recuo", pontuacao: 86.3, catalisador: "Revisões em alta dos analistas" },
      ],
      decisoes: [
        { ciclo: "demo-abertura", ts: agora, conteudo: { justificacao: "Regime risk-off: duas entradas defensivas com metade do risco e uma entrada limite no BBY, abaixo do preço.",
          trades: [{ ticker: "MTD", setup: "recuo", entrada: 1690, stop: 1628, alvo: 1876, conviccao: "A", tese: "Líder de saúde a recuar até à MM20 com volume a descer." },
                   { ticker: "TMO", setup: "recuo", entrada: 688, stop: 668.5, alvo: null, conviccao: "A", tese: "Força relativa 97, recuo de 5% até à MM20." },
                   { ticker: "WST", setup: "recuo", entrada: 300, stop: 296, alvo: 330, conviccao: "B", tese: "Stop demasiado apertado." }] },
          resultado: { enviados: [{ ticker: "MTD", enviado: true, qtd: 14 }, { ticker: "TMO", enviado: true, qtd: 36 }, { ticker: "WST", enviado: false, motivo: "stop demasiado apertado: 4,00 < 0,75 ATR" }] } },
        { ciclo: "demo-pre", ts: agora, conteudo: { justificacao: "Nenhum trade: o Estratega bloqueou entradas antes do CPI.", trades: [] }, resultado: { enviados: [] } },
      ],
      trades_fechados: [
        { ticker: "WMT", setup: "rompimento", preco_entrada: 98.2, preco_saida: 104.9, qtd: 200, pnl: 1340, r: 2.1, motivo_saida: "alvo", fechado: agora },
        { ticker: "KO", setup: "recuo", preco_entrada: 71.4, preco_saida: 70.1, qtd: 300, pnl: -390, r: -1, motivo_saida: "stop", fechado: agora },
      ],
      metricas: { n: 2, acerto_pct: 50, pnl_total: 950, r_medio: 0.55, profit_factor: 3.44, melhor: "WMT", pior: "KO" },
      eventos: [{ ts: agora, tipo: "ordem", mensagem: "Compra 14 MTD (limite 1690), stop 1628, alvo 1876, risco 0,87%" }, { ts: agora, tipo: "stop", mensagem: "Stop de MTD: 1628 → 1690 (break-even +1R)" }, ...(D.eventos || [])],
    };
  }

  // ---------- dados ----------
  async function carregarTudo() {
    try {
      S.tudo = await (await fetch(ONLINE ? "data/tudo.json" : "/api/tudo", { cache: "no-store" })).json();
      if (DEMO) S.tudo = demo(S.tudo);
      render();
      carregarSparks();
    } catch (e) {
      $("heroLead").textContent = "Sem ligação ao motor. O painel está a correr? (python -m bot painel)";
    }
  }
  async function carregarMercado() {
    try {
      S.mercado = await (await fetch(ONLINE ? "data/mercado.json" : "/api/mercado", { cache: "no-store" })).json();
      if (S.tudo) { regime(S.tudo); posicoes(S.tudo); }
      fita();
    } catch (e) { /* tenta outra vez no proximo ciclo */ }
  }
  let ultimoSparks = "";
  async function carregarSparks(forcar = false) {
    const E = (S.tudo || {}).estado || {};
    const lista = [...new Set([...(E.posicoes || []).map((p) => p.ticker), ...listaWatch().map((w) => w.ticker)])].filter(Boolean).slice(0, 30);
    const chave = lista.join(",");
    if (!lista.length || (chave === ultimoSparks && !forcar)) return;
    ultimoSparks = chave;
    try {
      S.sparks = await (await fetch(ONLINE ? "data/sparks.json" : "/api/sparks?n=40&tickers=" + encodeURIComponent(chave), { cache: "no-store" })).json();
      if (S.tudo) { posicoes(S.tudo); historico(S.tudo); }
      fita();
    } catch (e) { ultimoSparks = ""; }
  }

  controlosVelas();
  chipsVelas();
  relogios();
  setInterval(relogios, 15000);
  // links com #seccao (ex.: partilhados no telemovel): o browser salta antes de os dados chegarem e
  // a pagina cresce por cima do alvo; depois da primeira carga volta-se ao sitio certo, se a pessoa nao tiver mexido
  let mexeu = false;
  ["wheel", "touchstart", "keydown"].forEach((ev) => addEventListener(ev, () => { mexeu = true; }, { once: true, passive: true }));
  carregarTudo().then(() => carregarVelas(S.ticker)).then(() => {
    const alvo = location.hash.length > 1 && document.getElementById(decodeURIComponent(location.hash.slice(1)));
    if (alvo && !mexeu && alvo.id !== "geral") alvo.scrollIntoView({ behavior: "auto" });
  });
  carregarMercado();
  setInterval(() => { if (!document.hidden) carregarTudo(); }, 30000);
  setInterval(() => { if (!document.hidden) { carregarMercado(); carregarSparks(true); if (S.ticker) carregarVelas(S.ticker); } }, 300000);
  let rz; addEventListener("resize", () => { clearTimeout(rz); rz = setTimeout(redesenhar, 160); });
})();
