/* polarize-ui — docs behaviour. The script half of docs.css.
 *
 *   <script type="module" src="docs.js"></script>
 *
 * It wires itself to data attributes on the page, so a static generator only
 * writes markup. Nothing here is required for the page to READ: without it the
 * nav, content, code and API reference all render; only search, copy, tabs,
 * the theme toggle and plots need it.
 *
 *   data-ui-theme-toggle          button: flips the explicit theme stamp
 *                                 (<html data-ui-theme-light/-dark> override the
 *                                 two theme names; default instrument / instrument-dark)
 *   data-ui-nav-toggle            button: opens the nav on a phone
 *   data-ui-search-open           button: opens the palette (also ⌘K / Ctrl-K and "/")
 *   data-ui-search="<url>"        the .ui-docsearch dialog; <url> is a JSON array
 *                                 of {t: title, s: summary, h: href, k: kind}
 *   data-ui-copy                  button inside a .ui-codewin: copies its <pre>
 *   data-ui-tabs                  .ui-example__io: its [data-ui-tab] buttons switch the plot set
 *   data-ui-plots='<json>'        {"<tab>": [spec, ...]} drawn into the element (see renderPlot)
 *   code.language-python          highlighted in place (a small token-level highlighter)
 *   .ui-docsite__toc a            scroll-spy
 *   .ui-pkgcard                   pointer-following grid texture
 *
 * The theme choice is remembered per viewer under localStorage "ui-theme"
 * (override with <html data-ui-theme-key>), wrapped in try/catch because storage
 * can be unavailable. Plots read colours from CSS tokens at draw time and are
 * redrawn on theme change and resize. No dependencies, no network except the
 * search index the page names.
 */

const NS = 'http://www.w3.org/2000/svg';
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

/* ── theme ─────────────────────────────────────────────────────────────── */
const root = document.documentElement;
const THEME_KEY = root.dataset.uiThemeKey || 'ui-theme';
const LIGHT = root.dataset.uiThemeLight || 'instrument';
const DARK = root.dataset.uiThemeDark || 'instrument-dark';
try { const t = localStorage.getItem(THEME_KEY); if (t) root.dataset.theme = t; } catch (e) { /* storage unavailable */ }
export const isDark = () => {
  const t = root.dataset.theme;
  return t ? /dark|polarize/.test(t) : matchMedia('(prefers-color-scheme: dark)').matches;
};

/* ── python highlighting ───────────────────────────────────────────────── */
const KW = new Set('import from as def return for in if else elif with lambda None True False and or not class try except raise yield is while pass break continue async await'.split(' '));
export function highlight(code) {
  const re = /(#[^\n]*)|("""[\s\S]*?"""|'''[\s\S]*?'''|[rbfu]?"(?:\\.|[^"\\\n])*"|[rbfu]?'(?:\\.|[^'\\\n])*')|(\b\d+(?:\.\d+)?(?:e-?\d+)?\b)|(\b[A-Za-z_]\w*\b)(\s*\()?/g;
  let out = '', last = 0, m;
  while ((m = re.exec(code))) {
    out += esc(code.slice(last, m.index));
    const [t, com, str, num, word, call] = m;
    if (com) out += `<span class="ui-tok--com">${esc(t)}</span>`;
    else if (str) out += `<span class="ui-tok--str">${esc(t)}</span>`;
    else if (num) out += `<span class="ui-tok--num">${esc(t)}</span>`;
    else if (KW.has(word)) out += `<span class="ui-tok--kw">${esc(word)}</span>${esc(call || '')}`;
    else if (call) out += `<span class="ui-tok--fn">${esc(word)}</span>${esc(call)}`;
    else out += esc(t);
    last = m.index + t.length;
  }
  return out + esc(code.slice(last));
}

/* ── plots ─────────────────────────────────────────────────────────────── *
 * A spec is plain JSON a generator can write from any language:
 *   {type:"line",  title, series:[{name, x:[], y:[]}], xlabel, ylabel, markers:[{x, label}], stack?, caption?}
 *   {type:"stems", title, groups:[{name, lines:[{x, y}], invert?, flags?:[], note?}], xmax?, caption?}
 *     (invert draws the lines hanging from the top: a dip rather than a peak)
 *   {type:"bars",  title, items:[{label, value}], caption?}
 *   {type:"table", title, columns:[], rows:[[]], caption?}
 *   {type:"verdicts", title, items:[{key, verdict, reason?, meta?, tone?}], caption?}
 * `tone` is yes / no / none; when absent it is inferred from common verdict words.
 * Long traces should be decimated by the generator; the renderer draws every point. */
const css = (v) => getComputedStyle(root).getPropertyValue(v).trim();
const palette = () => [1, 2, 3, 4, 5, 6, 7, 8].map((i) => css(`--series-${i}`));
const el = (tag, attrs = {}, parent) => {
  const n = document.createElementNS(NS, tag);
  for (const k in attrs) n.setAttribute(k, attrs[k]);
  if (parent) parent.appendChild(n);
  return n;
};
function niceTicks(lo, hi, n = 5) {
  if (!isFinite(lo) || !isFinite(hi) || lo === hi) return [lo];
  const step0 = (hi - lo) / n, mag = 10 ** Math.floor(Math.log10(step0));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= step0);
  const out = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) out.push(+v.toFixed(10));
  return out;
}
const fmt = (v) => (Math.abs(v) >= 1000 ? v.toFixed(0) : Math.abs(v) >= 10 ? `${+v.toFixed(1)}` : `${+v.toPrecision(3)}`);

function linePlot(spec, host) {
  const W = Math.max(320, host.clientWidth || 640), stack = spec.stack && spec.series.length > 1;
  const rowH = stack ? 44 : 190, H = stack ? spec.series.length * rowH + 34 : 230;
  const m = { l: stack ? 44 : 50, r: 12, t: 12, b: 32 };
  const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': spec.title || 'plot' });
  const cols = palette();
  const xs = spec.series.flatMap((s) => s.x), xmin = Math.min(...xs), xmax = Math.max(...xs);
  const pw = W - m.l - m.r, X = (v) => m.l + ((v - xmin) / (xmax - xmin || 1)) * pw;
  niceTicks(xmin, xmax, Math.max(3, Math.floor(pw / 90))).forEach((t) => {
    el('line', { x1: X(t), x2: X(t), y1: m.t, y2: H - m.b, class: 'ui-plot__grid' }, svg);
    el('text', { x: X(t), y: H - m.b + 14, 'text-anchor': 'middle', class: 'ui-plot__tick' }, svg).textContent = fmt(t);
  });
  el('text', { x: m.l + pw / 2, y: H - 3, 'text-anchor': 'middle', class: 'ui-plot__axl' }, svg).textContent = spec.xlabel || '';
  const rows = stack ? spec.series.map((s, i) => [s, m.t + i * rowH, rowH - 6]) : [[null, m.t, H - m.t - m.b]];
  rows.forEach(([only, top, h], ri) => {
    const ser = only ? [only] : spec.series;
    const ys = ser.flatMap((s) => s.y).filter((v) => v != null);
    let lo = Math.min(...ys), hi = Math.max(...ys);
    const pad = (hi - lo) * 0.06 || 1; lo -= pad; hi += pad;
    const Y = (v) => top + h - ((v - lo) / (hi - lo)) * h;
    if (!stack) {
      niceTicks(lo, hi, 4).forEach((t) => {
        el('line', { x1: m.l, x2: W - m.r, y1: Y(t), y2: Y(t), class: 'ui-plot__grid' }, svg);
        el('text', { x: m.l - 6, y: Y(t) + 3, 'text-anchor': 'end', class: 'ui-plot__tick' }, svg).textContent = fmt(t);
      });
    } else {
      el('text', { x: m.l - 6, y: top + h / 2 + 3, 'text-anchor': 'end', class: 'ui-plot__tick' }, svg).textContent = only.name;
    }
    ser.forEach((s, i) => {
      let d = '', pen = false;
      s.x.forEach((x, j) => {
        const y = s.y[j];
        if (y == null) { pen = false; return; }
        d += `${pen ? 'L' : 'M'}${X(x).toFixed(1)} ${Y(y).toFixed(1)}`; pen = true;
      });
      el('path', { d, fill: 'none', stroke: cols[(stack ? ri : i) % cols.length], 'stroke-width': stack ? 1 : 1.3, 'stroke-linejoin': 'round' }, svg);
    });
  });
  if (!stack) {
    const cy = m.t + (H - m.t - m.b) / 2;
    el('text', { x: 12, y: cy, class: 'ui-plot__axl', transform: `rotate(-90 12 ${cy})`, 'text-anchor': 'middle' }, svg).textContent = spec.ylabel || '';
  }
  el('line', { x1: m.l, x2: W - m.r, y1: H - m.b, y2: H - m.b, class: 'ui-plot__ax' }, svg);
  let lastLab = -1e9, tier = 0;
  (spec.markers || []).filter((k) => k.x >= xmin && k.x <= xmax).forEach((k) => {
    el('line', { x1: X(k.x), x2: X(k.x), y1: m.t, y2: H - m.b, class: 'ui-plot__mk', opacity: k.label ? 1 : 0.55 }, svg);
    if (k.label) {
      tier = X(k.x) - lastLab < 70 ? (tier + 1) % 3 : 0; lastLab = X(k.x);
      el('text', { x: X(k.x) + 3, y: m.t + 9 + tier * 11, class: 'ui-plot__mkl' }, svg).textContent = k.label;
    }
  });
  const hl = el('line', { y1: m.t, y2: H - m.b, class: 'ui-plot__hover', visibility: 'hidden' }, svg);
  const tip = el('text', { class: 'ui-plot__tip', y: m.t + 10, visibility: 'hidden' }, svg);
  const s0 = spec.series[0];
  svg.addEventListener('pointermove', (e) => {
    const r = svg.getBoundingClientRect(), px = ((e.clientX - r.left) * W) / r.width;
    if (px < m.l || px > W - m.r) return;
    const xv = xmin + ((px - m.l) / pw) * (xmax - xmin);
    let j = 0, best = Infinity;
    s0.x.forEach((x, i) => { const d = Math.abs(x - xv); if (d < best) { best = d; j = i; } });
    const x = X(s0.x[j]);
    hl.setAttribute('x1', x); hl.setAttribute('x2', x); hl.setAttribute('visibility', 'visible');
    tip.textContent = `${fmt(s0.x[j])} ${spec.xunit || ''}  ·  ${s0.y[j] != null ? fmt(s0.y[j]) : '—'} ${spec.yunit || ''}`;
    const left = x + 8 > W - 160;
    tip.setAttribute('x', left ? x - 8 : x + 8); tip.setAttribute('text-anchor', left ? 'end' : 'start');
    tip.setAttribute('visibility', 'visible');
  });
  svg.addEventListener('pointerleave', () => { hl.setAttribute('visibility', 'hidden'); tip.setAttribute('visibility', 'hidden'); });
  host.appendChild(svg);
  if (!stack && spec.series.length > 1) {
    host.insertAdjacentHTML('beforeend', `<div class="ui-plot__legend">${spec.series.map((s, i) =>
      `<span><i style="background:${cols[i % cols.length]}"></i>${esc(s.name)}</span>`).join('')}</div>`);
  }
}

function stemsPlot(spec, host) {
  const grid = document.createElement('div'); grid.className = 'ui-stems';
  const xmax = spec.xmax || Math.max(...spec.groups.flatMap((g) => g.lines.map((l) => l.x))) * 1.05;
  const cols = palette();
  spec.groups.forEach((g, gi) => {
    const cell = document.createElement('div'); cell.className = 'ui-stems__cell';
    const flags = (g.flags || []).map((f) => `<span class="ui-stems__flag">${esc(f)}</span>`).join('');
    cell.innerHTML = `<h5 class="ui-stems__name">${esc(g.name)} ${flags}</h5>`;
    const W = 260, H = 96, m = { l: 6, r: 6, t: 8, b: 18 };
    const svg = el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': g.name });
    const X = (v) => m.l + (v / xmax) * (W - m.l - m.r), base = H - m.b;
    const ymax = Math.max(...g.lines.map((l) => l.y), 1e-9);
    niceTicks(0, xmax, 4).forEach((t) => {
      el('text', { x: X(t), y: H - 4, 'text-anchor': 'middle', class: 'ui-plot__tick' }, svg).textContent = fmt(t);
    });
    el('line', { x1: m.l, x2: W - m.r, y1: base, y2: base, class: 'ui-plot__ax' }, svg);
    // inverted lines hang DOWN from a ceiling: the feature is a dip, not a peak
    if (g.invert) el('line', { x1: m.l, x2: W - m.r, y1: m.t, y2: m.t, class: 'ui-plot__ax' }, svg);
    g.lines.forEach((l) => {
      const h = (l.y / ymax) * (base - m.t - 4), c = cols[gi % cols.length];
      const y0 = g.invert ? m.t : base, y1 = g.invert ? m.t + h : base - h;
      el('line', { x1: X(l.x), x2: X(l.x), y1: y0, y2: y1, stroke: c, 'stroke-width': 2 }, svg);
      el('circle', { cx: X(l.x), cy: y1, r: 2.4, fill: g.invert ? css('--background') : c, stroke: c }, svg);
    });
    cell.appendChild(svg);
    if (g.note) cell.insertAdjacentHTML('beforeend', `<p class="ui-stems__note">${esc(g.note)}</p>`);
    grid.appendChild(cell);
  });
  host.appendChild(grid);
}

function barsPlot(spec, host) {
  const max = Math.max(...spec.items.map((i) => Math.abs(i.value)), 1e-9);
  host.insertAdjacentHTML('beforeend', `<div class="ui-hbars">${spec.items.map((i) =>
    `<div class="ui-hbars__row"><span class="ui-hbars__label">${esc(i.label)}</span><div class="ui-hbars__track"><div class="ui-hbars__fill" style="width:${((Math.abs(i.value) / max) * 100).toFixed(1)}%"></div></div><span class="ui-hbars__value">${fmt(i.value)}</span></div>`).join('')}</div>`);
}

function tablePlot(spec, host) {
  host.insertAdjacentHTML('beforeend', `<div class="ui-datatable-wrap"><table class="ui-datatable"><thead><tr>${spec.columns.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${spec.rows.map((r) => `<tr>${r.map((c) => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`);
}

const YES = /^(present|shared|runnable|ok|pass|passed|yes|confirmed|supported)$/i;
const NO = /^(absent|refused|fail|failed|no|refuted|rejected)$/i;
const NONE = /^(unavailable|not-tested|skipped|unreliable|n\/a|none|untested|inconclusive)$/i;
const tone = (i) => i.tone || (YES.test(i.verdict) ? 'yes' : NO.test(i.verdict) ? 'no' : NONE.test(i.verdict) ? 'none' : 'other');
function verdictsPlot(spec, host) {
  host.insertAdjacentHTML('beforeend', `<ul class="ui-verdicts">${spec.items.map((i) =>
    `<li class="ui-verdicts__item"><span class="ui-verdicts__key">${esc(i.key)}${i.meta ? `<small>${esc(i.meta)}</small>` : ''}</span><span class="ui-verdicts__word" data-verdict="${tone(i)}">${esc(i.verdict)}</span><span class="ui-verdicts__reason">${esc(i.reason || '')}</span></li>`).join('')}</ul>`);
}

const RENDERERS = { line: linePlot, stems: stemsPlot, bars: barsPlot, table: tablePlot, verdicts: verdictsPlot };

/** Draw one spec into `host` (a .ui-plot figure is created inside it). */
export function renderPlot(spec, host) {
  const fig = document.createElement('figure'); fig.className = 'ui-plot';
  if (spec.title) fig.innerHTML = `<figcaption class="ui-plot__title">${esc(spec.title)}</figcaption>`;
  host.appendChild(fig);
  try { RENDERERS[spec.type](spec, fig); } catch (e) {
    fig.insertAdjacentHTML('beforeend', `<p class="ui-plot__cap">Could not draw this plot: ${esc(e.message)}</p>`);
  }
  if (spec.caption) fig.insertAdjacentHTML('beforeend', `<p class="ui-plot__cap">${esc(spec.caption)}</p>`);
  return fig;
}

function drawPlots(body) {
  const data = body._uiPlots || (body._uiPlots = JSON.parse(body.dataset.uiPlots));
  const tab = body._uiTab || Object.keys(data)[0];
  body.innerHTML = '';
  (data[tab] || []).forEach((spec) => renderPlot(spec, body));
}
export const redrawAll = () => $$('[data-ui-plots]').forEach(drawPlots);

/* ── search ────────────────────────────────────────────────────────────── */
function initSearch() {
  const box = $('[data-ui-search]');
  if (!box) return;
  const input = $('.ui-docsearch__input', box), list = $('.ui-docsearch__results', box);
  let index = null, sel = 0;
  const score = (item, q) => {
    const t = item.t.toLowerCase(), s = (item.s || '').toLowerCase();
    if (!q) return 1;
    if (t === q) return 100;
    if (t.endsWith(`.${q}`)) return 80;
    if (t.includes(q)) return 60 - t.indexOf(q) / 10;
    if (s.includes(q)) return 20;
    return q.split(/\s+/).every((w) => t.includes(w) || s.includes(w)) ? 10 : 0;
  };
  const mark = (s, q) => (q ? esc(s).replace(new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'ig'), (x) => `<mark>${x}</mark>`) : esc(s));
  const run = (q) => {
    q = q.trim().toLowerCase();
    const hits = (index || []).map((i) => [score(i, q), i]).filter((x) => x[0] > 0).sort((a, b) => b[0] - a[0]).slice(0, 40).map((x) => x[1]);
    sel = 0;
    list.innerHTML = hits.map((h, i) => `<li><a href="${esc(h.h)}" class="${i === 0 ? 'is-selected' : ''}"><span class="ui-docsearch__t">${mark(h.t, q)}</span><span class="ui-docsearch__k">${esc(h.k || '')}</span><span class="ui-docsearch__s">${esc(h.s || '')}</span></a></li>`).join('')
      || `<li class="ui-docsearch__hint">${index ? 'No results' : 'Loading…'}</li>`;
  };
  const open = async () => {
    box.hidden = false; input.value = ''; input.focus(); run('');
    if (!index) {
      try { index = await (await fetch(box.dataset.uiSearch)).json(); } catch (e) { index = []; }
      run(input.value); // the reader may have typed while the index loaded
    }
  };
  const close = () => { box.hidden = true; };
  const move = (d) => {
    const as = $$('a', list);
    if (!as.length) return;
    as[sel]?.classList.remove('is-selected');
    sel = (sel + d + as.length) % as.length;
    as[sel].classList.add('is-selected'); as[sel].scrollIntoView({ block: 'nearest' });
  };
  $$('[data-ui-search-open]').forEach((b) => b.addEventListener('click', open));
  input.addEventListener('input', () => run(input.value));
  box.addEventListener('click', (e) => { if (e.target === box) close(); });
  addEventListener('keydown', (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); box.hidden ? open() : close(); }
    else if (e.key === '/' && box.hidden && !/input|textarea|select/i.test(document.activeElement.tagName)) { e.preventDefault(); open(); }
    else if (!box.hidden) {
      if (e.key === 'Escape') close();
      else if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
      else if (e.key === 'Enter') { const a = $$('a', list)[sel]; if (a) location.href = a.href; }
    }
  });
}

/* ── wiring ────────────────────────────────────────────────────────────── */
export function init() {
  $$('[data-ui-theme-toggle]').forEach((b) => b.addEventListener('click', () => {
    const next = isDark() ? LIGHT : DARK;
    root.dataset.theme = next;
    try { localStorage.setItem(THEME_KEY, next); } catch (e) { /* storage unavailable */ }
    redrawAll();
  }));
  $$('[data-ui-nav-toggle]').forEach((b) => b.addEventListener('click', () => {
    const open = document.body.classList.toggle('is-nav-open');
    b.setAttribute('aria-expanded', open);
  }));
  $$('code.language-python').forEach((c) => { c.innerHTML = highlight(c.textContent); });
  $$('[data-ui-copy]').forEach((btn) => btn.addEventListener('click', async () => {
    const code = btn.closest('.ui-codewin').querySelector('pre').textContent;
    try { await navigator.clipboard.writeText(code); btn.textContent = 'Copied'; } catch (e) { btn.textContent = 'Select'; }
    setTimeout(() => { btn.textContent = 'Copy'; }, 1400);
  }));
  $$('.ui-pkgcard').forEach((c) => c.addEventListener('pointermove', (e) => {
    const r = c.getBoundingClientRect();
    c.style.setProperty('--mx', `${e.clientX - r.left}px`);
    c.style.setProperty('--my', `${e.clientY - r.top}px`);
  }));
  const toc = $$('.ui-docsite__toc a');
  if (toc.length) {
    const targets = toc.map((a) => document.getElementById(decodeURIComponent(a.hash.slice(1)))).filter(Boolean);
    const spy = () => {
      let cur = targets[0];
      for (const t of targets) if (t.getBoundingClientRect().top < 120) cur = t;
      toc.forEach((a) => a.classList.toggle('is-active', !!cur && a.hash === `#${cur.id}`));
    };
    addEventListener('scroll', spy, { passive: true }); spy();
  }
  $$('[data-ui-tabs]').forEach((p) => {
    const body = $('[data-ui-plots]', p);
    $$('[data-ui-tab]', p).forEach((b) => b.addEventListener('click', () => {
      $$('[data-ui-tab]', p).forEach((x) => x.setAttribute('aria-selected', x === b));
      body._uiTab = b.dataset.uiTab; drawPlots(body);
    }));
  });
  redrawAll();
  let rt;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(redrawAll, 150); });
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', redrawAll);
  initSearch();
}

if (typeof document !== 'undefined' && !window.__uiDocsNoAutoInit) {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}
