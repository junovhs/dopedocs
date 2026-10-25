// dopedocs kit — shared rendering + widgets every layout can snap in.
(function () {
  const D = window.DOC;
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];

  const P = 'fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"';
  const ICONS = {
    spark: `<path d="M12 3v4M12 17v4M3 12h4M17 12h4M6.3 6.3l2.5 2.5M15.2 15.2l2.5 2.5M6.3 17.7l2.5-2.5M15.2 8.8l2.5-2.5"/>`,
    cup: `<path d="M4 9h13v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z"/><path d="M17 11h1.5a2.5 2.5 0 0 1 0 5H17M8 3v3M12 3v3"/>`,
    leaf: `<path d="M5 19c0-8 5-13 15-14-1 10-6 15-14 15"/><path d="M5 19 13 11"/>`,
    wrench: `<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L4 16.8 7.2 20l5.3-5.3a4 4 0 0 0 5.2-5.4l-2.5 2.5-2.4-.6-.6-2.4 2.5-2.5Z"/>`,
    book: `<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2V5Z"/><path d="M4 19a2 2 0 0 1 2-2h13"/>`,
    search: `<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.2-4.2"/>`,
    chev: `<path d="m9 6 6 6-6 6"/>`, chevd: `<path d="m6 9 6 6 6-6"/>`,
    left: `<path d="M19 12H5M11 6l-6 6 6 6"/>`, right: `<path d="M5 12h14M13 6l6 6-6 6"/>`,
    check: `<path d="m5 12.5 4.5 4.5L19 7.5"/>`, menu: `<path d="M4 7h16M4 12h16M4 17h10"/>`, x: `<path d="M6 6l12 12M18 6 6 18"/>`,
    sun: `<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>`,
    moon: `<path d="M20 14.5A8 8 0 0 1 9.5 4 8 8 0 1 0 20 14.5Z"/>`,
    clock: `<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>`,
    copy: `<rect x="8" y="8" width="12" height="12" rx="2.5"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>`,
    hash: `<path d="M5 9h14M5 15h14M10 4 8 20M16 4l-2 16"/>`,
    doc: `<path d="M7 3h7l5 5v13H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2Z"/><path d="M14 3v5h5M9 13h6M9 17h4"/>`,
    tip: `<path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z"/>`,
    warn: `<path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 10v4M12 17.5v.01"/>`,
    info: `<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 7.5v.01"/>`,
    thumb: `<path d="M7 11v9H4v-9h3Zm0 0 4-8c1.5 0 2.5 1 2.5 2.5V9H19a2 2 0 0 1 2 2.3l-1.2 7A2 2 0 0 1 17.8 20H7"/>`,
    play: `<path d="M8 5v14l11-7L8 5Z"/>`, flag: `<path d="M5 21V4M5 4h11l-2 4 2 4H5"/>`,
    layers: `<path d="m12 3 9 5-9 5-9-5 9-5Z"/><path d="m3 13 9 5 9-5"/>`, focus: `<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3"/><circle cx="12" cy="12" r="3"/>`,
    sparkle: `<path d="M12 3c.5 4.5 2.5 6.5 7 7-4.5.5-6.5 2.5-7 7-.5-4.5-2.5-6.5-7-7 4.5-.5 6.5-2.5 7-7Z"/>`,
    grid: `<rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/>`,
    cols: `<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M9 4v16M15 4v16"/>`, az: `<path d="M4 17 7.5 7 11 17M5.2 14h4.6M14 7h6l-6 10h6"/>`,
    msg: `<path d="M5 5h14a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1h-7l-4 3v-3H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Z"/>`,
    bolt: `<path d="M13 3 5 14h6l-1 7 8-11h-6l1-7Z"/>`, up: `<path d="M12 19V5M6 11l6-6 6 6"/>`,
  };
  const icon = (n, cls = "") => `<span class="ico ${cls}"><svg viewBox="0 0 24 24" ${P}>${ICONS[n] || ""}</svg></span>`;

  // Flat index of sections with chapter context.
  const flat = [];
  D.chapters.forEach((c, ci) => c.sections.forEach((s, si) => flat.push(Object.assign(s, { chapter: c, ci, si, i: flat.length }))));
  const byId = Object.fromEntries(flat.map(s => [s.id, s]));
  const subs = s => s.blocks.filter(b => b.kind === "h3");

  const esc = t => String(t).replace(/[&<>"]/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[m]));
  const plain = t => String(t).replace(/\{fact:(\w+)\}/g, (_, k) => D.facts[k]).replace(/\*\*|`|\[\[|\]\]/g, "").replace(/\[([^\]]+)\]\(#[\w-]+\)/g, "$1");
  function inline(t) {
    return esc(t)
      .replace(/\{fact:(\w+)\}/g, (_, k) => `<span class="fact" data-fact="${k}">${esc(D.facts[k])}</span>`)
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/`(.+?)`/g, "<code>$1</code>")
      .replace(/\[\[(.+?)\]\]/g, "<kbd>$1</kbd>")
      .replace(/\[([^\]]+)\]\(#([\w-]+)\)/g, (_, txt, id) => `<a href="#${id}" data-peek="${id}">${txt}</a>`);
  }
  function hl(code, lang) {
    let h = esc(code);
    h = h.replace(/(&quot;.*?&quot;)/g, '<span class="s">$1</span>');
    h = h.replace(/(^|\n)(#.*)/g, '$1<span class="c">$2</span>');
    if (lang === "js") h = h.replace(/\b(await|const|let|method|body)\b/g, '<span class="k">$1</span>');
    if (lang === "bash") h = h.replace(/^(curl)/gm, '<span class="k">$1</span>');
    return h;
  }
  function block(b) {
    switch (b.kind) {
      case "p": return `<p>${inline(b.text)}</p>`;
      case "h3": return `<h3 id="${b.id}" data-sub><a class="anchor" href="#${b.id}" data-copy="${b.id}" aria-label="Copy link">#</a>${inline(b.text)}</h3>`;
      case "steps": return `<ol class="steps">${b.items.map(i => `<li>${inline(i)}</li>`).join("")}</ol>`;
      case "list": return `<ul class="list">${b.items.map(i => `<li>${inline(i)}</li>`).join("")}</ul>`;
      case "note": return `<aside class="note ${b.tone}" data-note>${icon(b.tone)}<b>${esc(b.title)}</b><div>${inline(b.text)}</div></aside>`;
      case "table": return `<div class="table-wrap"><table><thead><tr>${b.head.map(h => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${b.rows.map(r => `<tr>${r.map(c => `<td>${inline(c)}</td>`).join("")}</tr>`).join("")}</tbody></table></div>`;
      case "code": return `<div class="code"><header><span>${b.lang}</span><button data-copy-code>${icon("copy")} Copy</button></header><pre><code>${hl(b.text, b.lang)}</code></pre></div>`;
    }
    return "";
  }
  const render = s => s.blocks.map(block).join("");
  const answer = s => `<div class="answer" data-w="answer"><div class="q">${icon("sparkle")} ${esc(s.question)}</div>${inline(s.answer)}</div>`;

  // ---------- Settings from the lab ----------
  const root = document.documentElement;
  const listeners = [];
  const SK = () => window.DD_SKINS || [], FN = () => window.DD_FONTS || [];
  const mix = (a, b, pct) => `color-mix(in oklab, ${a} ${pct}%, ${b})`;
  const q = f => `"${f}", ui-sans-serif, system-ui, sans-serif`;
  const num = (v, d) => typeof v === "number" && isFinite(v) ? v : d;
  function apply(st) {
    if (!st) return;
    const skin = SK().find(x => x.id === st.skin) || SK()[0];
    if (!skin) return;
    const mode = st.mode || "light", c = skin[mode], set = (k, v) => root.style.setProperty(k, v);
    root.dataset.skin = skin.id; root.dataset.mode = mode;
    const map = { bg: "--dd-bg", panel: "--dd-panel", muted: "--dd-panel-muted", ink: "--dd-ink", onInk: "--dd-on-ink", text: "--dd-text", soft: "--dd-text-soft", dim: "--dd-muted", line: "--dd-line", lineSoft: "--dd-line-soft", accent: "--dd-accent", onAccent: "--dd-on-accent" };
    Object.entries(map).forEach(([k, v]) => set(v, c[k]));
    if (st.accent) set("--dd-accent", st.accent);
    if (typeof st.lines === "number") { set("--dd-line", mix("var(--dd-text)", "var(--dd-bg)", 9 * st.lines)); set("--dd-line-soft", mix("var(--dd-text)", "var(--dd-bg)", 4.5 * st.lines)); }
    const f = FN().find(x => x.id === st.font) || FN().find(x => x.id === skin.font) || FN()[0];
    set("--dd-display", q(f.display)); set("--dd-body", q(f.body)); set("--dd-sans", q(f.ui || "Inter")); set("--dd-mono", `"${f.mono || "JetBrains Mono"}", ui-monospace, monospace`);
    set("--dd-display-weight", st.headWeight || (st.font ? f.w : skin.w || f.w));
    set("--dd-display-track", (st.font ? f.t : skin.t ?? f.t) + "em");
    const ts = num(st.textSize, f.size || 16);
    set("--dd-text-size", ts + "px"); set("--dd-leading", (1.25 + 7.5 / ts).toFixed(3));
    set("--dd-head-scale", num(st.headScale, f.hscale || 1));
    set("--dd-radius", num(st.radius, skin.radius) + "px");
    set("--dd-density", num(st.density, 1));
    set("--dd-measure", num(st.measure, 720) + "px");
    set("--dd-side-w", num(st.sideW, 272) + "px");
    const d = num(st.shadow, 1), sc = mode === "dark" ? "0 0 0" : "16 18 24", k = mode === "dark" ? 4 : 1;
    set("--dd-shadow", d ? `0 1px 2px rgb(${sc} / ${.04 * k * d}), 0 ${8 * d}px ${24 * d}px -8px rgb(${sc} / ${Math.min(.9, .1 * k * d)})` : "none");
    set("--dd-shadow-lg", `0 2px 6px rgb(${sc} / ${.05 * k * Math.max(d, .4)}), 0 30px 70px -20px rgb(${sc} / ${Math.min(.9, .28 * k * Math.max(d, .4))})`);
    set("--dd-glow", mode === "dark" && skin.glow ? `0 0 24px ${skin.glow}` : "none");
    const attr = (k, v) => v ? (root.dataset[k] = v) : delete root.dataset[k];
    attr("texture", st.texture ?? skin.texture); attr("card", st.card); attr("header", st.header); attr("active", st.active);
    root.dataset.side = st.side || "left"; root.dataset.toc = st.toc || "right";
    root.dataset.off = Object.entries(st.widgets || {}).filter(([, v]) => !v).map(([k]) => k).join(" ");
    listeners.forEach(fn => fn(st));
  }
  let current = null;
  try { current = JSON.parse(localStorage.getItem("dd-lab") || "null"); } catch (e) {}
  apply(current || { skin: "studio", mode: "light" });
  addEventListener("DOMContentLoaded", () => apply(current || { skin: "studio" }));
  addEventListener("message", e => { if (e.data && e.data.type === "dd-settings") { current = e.data.settings; apply(current); } });
  const tell = msg => { try { parent !== window && parent.postMessage(msg, "*"); } catch (e) {} };
  function toggleMode() {
    const st = Object.assign({}, current || {}, { mode: root.dataset.mode === "dark" ? "light" : "dark" });
    current = st; apply(st); tell({ type: "dd-set", patch: { mode: st.mode } });
  }

  // ---------- Toast ----------
  let toastEl, toastT;
  function toast(msg, ic = "check") {
    if (!toastEl) { toastEl = document.createElement("div"); toastEl.className = "toast"; document.body.append(toastEl); }
    toastEl.innerHTML = icon(ic) + esc(msg); toastEl.classList.add("show");
    clearTimeout(toastT); toastT = setTimeout(() => toastEl.classList.remove("show"), 1700);
  }

  // ---------- Command palette ----------
  let go = () => {};
  const pal = { el: null, items: [], sel: 0 };
  function buildPalette() {
    const s = document.createElement("div");
    s.className = "pal-scrim"; s.setAttribute("role", "dialog"); s.setAttribute("aria-label", "Search");
    s.innerHTML = `<div class="pal"><div class="pal-in">${icon("search")}<input placeholder="Search the manual, or type > for actions" aria-label="Search" /><kbd>esc</kbd></div><div class="pal-list" role="listbox"></div><div class="pal-foot"><span><kbd>↑</kbd> <kbd>↓</kbd> move</span><span><kbd>↵</kbd> open</span><span><kbd>&gt;</kbd> actions</span><span style="margin-left:auto">${flat.length} pages · searched locally</span></div></div>`;
    document.body.append(s);
    s.addEventListener("mousedown", e => { if (e.target === s) closePalette(); });
    const input = $("input", s);
    input.addEventListener("input", () => fillPalette(input.value));
    input.addEventListener("keydown", e => {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") { e.preventDefault(); select(pal.sel + (e.key === "ArrowDown" ? 1 : -1)); }
      else if (e.key === "Enter") { e.preventDefault(); pal.items[pal.sel] && pal.items[pal.sel].run(); }
      else if (e.key === "Escape") closePalette();
    });
    pal.el = s;
  }
  const ACTIONS = [
    { t: "Toggle dark mode", ic: "moon", run: () => toggleMode() },
    ...(window.DD_SKINS || []).map(x => ({ t: "Switch skin: " + x.name, ic: "layers", run: () => tell({ type: "dd-set", patch: { skin: x.id } }) })),
    { t: "Copy link to this page", ic: "copy", run: () => { navigator.clipboard && navigator.clipboard.writeText(location.href); toast("Link copied"); } },
  ];
  function hi(text, words) {
    let h = esc(text);
    words.forEach(w => { if (w) h = h.replace(new RegExp("(" + w.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + ")", "ig"), "<mark>$1</mark>"); });
    return h;
  }
  const norm = t => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  function search(q) {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length) return [];
    const out = [];
    flat.forEach(s => {
      const hay = norm([s.title, s.question, plain(s.answer), s.blocks.map(b => plain(b.text || (b.items || []).join(" ") || (b.rows || []).flat().join(" "))).join(" ")].join(" "));
      if (!words.every(w => hay.includes(w))) return;
      const score = words.reduce((n, w) => n + (norm(s.title).includes(w) ? 5 : 0) + (norm(s.question).includes(w) ? 3 : 0), 0);
      out.push({ s, score, words });
      subs(s).forEach(h => { if (words.every(w => norm(h.text).includes(w))) out.push({ s, h, score: score + 4, words }); });
    });
    return out.sort((a, b) => b.score - a.score).slice(0, 12);
  }
  function fillPalette(q) {
    const list = $(".pal-list", pal.el);
    pal.items = []; let html = "";
    const add = (group, rows) => {
      if (!rows.length) return;
      html += `<div class="pal-group">${group}</div>`;
      rows.forEach(r => { const i = pal.items.length; pal.items.push(r); html += `<div class="pal-item" role="option" data-i="${i}">${icon(r.ic)}<div style="min-width:0"><div class="t">${r.th}</div>${r.d ? `<div class="d">${r.d}</div>` : ""}</div>${r.crumb ? `<span class="crumb">${r.crumb}</span>` : ""}</div>`; });
    };
    if (q.trim().startsWith(">")) {
      const w = norm(q.slice(1).trim());
      add("Actions", ACTIONS.filter(a => norm(a.t).includes(w)).map(a => ({ ...a, th: esc(a.t), run: () => { closePalette(); a.run(); } })));
    } else if (!q.trim()) {
      add("Popular questions", ["first-shot", "dial-in", "descale", "codes"].map(id => byId[id]).map(s => ({ ic: "msg", th: esc(s.question), crumb: s.chapter.title, run: () => { closePalette(); go(s.id); } })));
      add("Actions", ACTIONS.slice(0, 2).map(a => ({ ...a, th: esc(a.t), run: () => { closePalette(); a.run(); } })));
    } else {
      const res = search(q);
      add("Pages", res.filter(r => !r.h).map(r => ({ ic: "doc", th: hi(r.s.title, r.words), d: hi(plain(r.s.answer), r.words), crumb: r.s.chapter.title, run: () => { closePalette(); go(r.s.id); } })));
      add("Sections", res.filter(r => r.h).map(r => ({ ic: "hash", th: hi(r.h.text, r.words), crumb: r.s.title, run: () => { closePalette(); go(r.s.id, r.h.id); } })));
    }
    list.innerHTML = html || `<div class="pal-empty">No matches for “${esc(q)}”.<br><small>Try “steam”, “E3” or “descale”.</small></div>`;
    $$(".pal-item", list).forEach(el => {
      el.addEventListener("mousemove", () => select(+el.dataset.i, false));
      el.addEventListener("click", () => pal.items[+el.dataset.i].run());
    });
    select(0);
  }
  function select(i, scroll = true) {
    if (!pal.items.length) return;
    pal.sel = (i + pal.items.length) % pal.items.length;
    $$(".pal-item", pal.el).forEach(el => el.setAttribute("aria-selected", +el.dataset.i === pal.sel));
    const el = $(`.pal-item[data-i="${pal.sel}"]`, pal.el);
    scroll && el && el.scrollIntoView({ block: "nearest" });
  }
  function openPalette(q = "") {
    if (root.dataset.off && root.dataset.off.split(" ").includes("search")) return;
    if (!pal.el) buildPalette();
    const input = $("input", pal.el);
    input.value = q; fillPalette(q);
    pal.el.classList.add("open");
    setTimeout(() => input.focus(), 20);
  }
  function closePalette() { pal.el && pal.el.classList.remove("open"); }
  addEventListener("keydown", e => {
    const typing = /INPUT|TEXTAREA/.test(document.activeElement.tagName);
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); pal.el && pal.el.classList.contains("open") ? closePalette() : openPalette(); }
    else if (e.key === "/" && !typing) { e.preventDefault(); openPalette(); }
    else if (!typing && /^[1-5rRgGdD]$/.test(e.key) && !e.metaKey && !e.ctrlKey) tell({ type: "dd-key", key: e.key });
  });

  // ---------- Peek cards + fact tips ----------
  let peekEl, tipEl, peekT;
  document.addEventListener("mouseover", e => {
    const a = e.target.closest && e.target.closest("[data-peek]");
    const f = e.target.closest && e.target.closest("[data-fact]");
    if (f) {
      if (!tipEl) { tipEl = document.createElement("div"); tipEl.className = "fact-tip"; document.body.append(tipEl); }
      const r = f.getBoundingClientRect();
      tipEl.innerHTML = `<b>fact:${f.dataset.fact}</b><br>One source of truth — change it once and every page updates.`;
      tipEl.style.left = Math.min(innerWidth - 250, Math.max(8, r.left)) + "px"; tipEl.style.top = r.bottom + 8 + "px";
      tipEl.classList.add("show");
    }
    if (!a || root.dataset.off?.split(" ").includes("peek")) return;
    const s = byId[a.dataset.peek]; if (!s) return;
    clearTimeout(peekT);
    peekT = setTimeout(() => {
      if (!peekEl) { peekEl = document.createElement("div"); peekEl.className = "peek"; document.body.append(peekEl); }
      peekEl.innerHTML = `<div class="k">${esc(s.chapter.title)} · ${s.min} min</div><div class="t">${esc(s.title)}</div>${inline(s.answer)}`;
      const r = a.getBoundingClientRect();
      const below = r.bottom + 180 < innerHeight;
      peekEl.style.left = Math.min(innerWidth - 336, Math.max(16, r.left - 20)) + "px";
      peekEl.style.top = (below ? r.bottom + 10 : r.top - 10 - 150) + "px";
      peekEl.classList.add("show");
    }, 280);
  });
  document.addEventListener("mouseout", e => {
    if (e.target.closest && e.target.closest("[data-peek]")) { clearTimeout(peekT); peekEl && peekEl.classList.remove("show"); }
    if (e.target.closest && e.target.closest("[data-fact]")) tipEl && tipEl.classList.remove("show");
  });
  document.addEventListener("click", e => {
    const c = e.target.closest("[data-copy]");
    if (c) { e.preventDefault(); navigator.clipboard && navigator.clipboard.writeText(location.href.split("#")[0] + "#" + c.dataset.copy).catch(() => {}); toast("Link to section copied"); return; }
    const cc = e.target.closest("[data-copy-code]");
    if (cc) { navigator.clipboard && navigator.clipboard.writeText(cc.closest(".code").querySelector("code").innerText).catch(() => {}); toast("Code copied"); return; }
    const a = e.target.closest("a[data-peek]");
    if (a) { e.preventDefault(); peekEl && peekEl.classList.remove("show"); go(a.dataset.peek); }
  });

  // Scrollspy: which of `els` is the reader currently on, inside `scroller`.
  function spy(scroller, getEls, cb, offset = 120) {
    let last;
    const run = () => {
      const els = getEls(); if (!els.length) return;
      const top = scroller === window ? 0 : scroller.getBoundingClientRect().top;
      let cur = els[0];
      for (const el of els) if (el.getBoundingClientRect().top - top < offset) cur = el;
      const sc = scroller === window ? document.scrollingElement : scroller;
      if (sc.scrollTop + sc.clientHeight >= sc.scrollHeight - 4) cur = els[els.length - 1];
      if (cur !== last) { last = cur; cb(cur); }
    };
    let raf; (scroller === window ? window : scroller).addEventListener("scroll", () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(run); }, { passive: true });
    run();
    return { run, reset: () => { last = null; run(); } };
  }

  // Feedback widget behaviour
  document.addEventListener("click", e => {
    const b = e.target.closest("[data-fb]"); if (!b) return;
    $$("[data-fb]", b.parentElement).forEach(x => x.setAttribute("aria-pressed", x === b));
    toast(b.dataset.fb === "yes" ? "Thanks — glad it helped" : "Thanks — we'll make this clearer", b.dataset.fb === "yes" ? "check" : "msg");
  });
  const feedback = () => `<div class="feedback" data-w="feedback"><span>Was this page helpful?</span><button class="btn" data-fb="yes">${icon("thumb")} Yes</button><button class="btn" data-fb="no"><span class="ico" style="transform:scaleY(-1)"><svg viewBox="0 0 24 24" ${P}>${ICONS.thumb}</svg></span> Not really</button></div>`;

  window.DDKit = { D, flat, byId, subs, icon, inline, plain, esc, render, answer, feedback, block, spy, toast, openPalette, closePalette, onSettings: f => listeners.push(f), toggleMode, tell, set go(f) { go = f; }, $, $$ };
})();
