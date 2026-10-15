/* polarize-ui — band prominence.
 *
 * A live readout of how strongly each frequency band stands out in ONE channel of a
 * signal: an EEG electrode, a magnetometer axis, or a synthetic tone with harmonics.
 * Push samples in as they arrive; the view filters them into bands and draws, per band,
 * its current level, an adaptive threshold, and how that threshold has moved.
 *
 * Zero-build, no dependencies:
 *   import { mountBandProminence } from './design/bandprominence.js'
 *   const view = mountBandProminence(host, { rate: 250, source: 'Oz–Cz' })
 *   view.push(samples)                 // numbers, in the signal's unit (µV by default)
 *   view.listenTo(panel)               // or: follow a <signal-panel> (signal-samples events)
 *   view.state()                       // the numbers behind the picture, per band
 *   view.update({ rate, bands, ... })  // a new rate or band set starts over
 *   view.reset(); view.destroy()
 *
 * What it computes (standard steps; nothing is fitted or learned):
 *   - Each band is a 4th-order Butterworth band-pass, built as two high-pass and two
 *     low-pass biquads (Q 0.541 and 1.307), run causally sample by sample.
 *   - Its amplitude is the RMS of that band over a short window (an exponential average of
 *     the squared output, time constant 1.5 cycles of the band's lower edge, 0.05–1 s),
 *     times √2, so a sine of amplitude A reads A.
 *   - Its LEVEL depends on `measure`:
 *       'share' (default): the band's share of the total power across all usable bands
 *         (relative band power, 0–1). Levels add up to 1, so a pure tone puts nearly all of
 *         it in one band and a fundamental with harmonics spreads it over the bands they fall
 *         in. EEG power falls roughly as 1/f, so delta usually holds the largest share.
 *       'baseline': the band's amplitude divided by its own long-run mean amplitude
 *         (`baseline`, 30 s by default), so 1 means "as usual for this band". Bands are
 *         comparable to their own past, not to each other's power; a steady tone reads 1.
 *   - Its THRESHOLD adapts over the band's `memory` window (2–6 s), as a mean level:
 *       'share':    half the equal share (0.5 / number of bands) + half the band's mean share
 *                   over its memory. A band that holds a large share stays above it; a band
 *                   that suddenly gains share rises further above it until the mean catches up.
 *       'baseline': `margin` (1.5 by default) × the band's mean level over its memory, i.e. a
 *                   burst: the band is half as strong again as it has just been.
 *     A band is PROMINENT while its level is above its threshold. The columns under each bar
 *     are its mean level in 20 bins across the memory window, oldest left, solid where the
 *     bin was above the threshold.
 *   - The LEAD band is the one furthest above its own threshold (level ÷ threshold), with
 *     hysteresis: it changes only when another band leads by 0.06 for 0.6 s.
 *
 * What the picture does NOT say:
 *   - Levels are relative to each band's own history, so a band can be prominent with very
 *     little power. The amplitude in µV is printed under each bar for that reason.
 *   - A band whose upper edge is at or above 45 % of the sample rate cannot be filtered
 *     cleanly; it is drawn hatched and labelled "above Nyquist", never as zero.
 *   - The first `baseline` seconds are a warm-up: the baseline is the mean so far.
 *   - It is a readout, not a model. It says nothing about what a band does in the brain.
 *
 * Time is SIGNAL time (samples ÷ rate), so a recording played fast reads the same as live.
 * Colour comes from the host's tokens: --series-1..5 (or --chart-1..5) for the bands,
 * --foreground and --muted-foreground for ink, --font-mono and --font-sans for text.
 */

const DEFAULT_BANDS = [
  { key: 'delta', name: 'Delta', lo: 1, hi: 4, memory: 6 },
  { key: 'theta', name: 'Theta', lo: 4, hi: 8, memory: 4 },
  { key: 'alpha', name: 'Alpha', lo: 8, hi: 13, memory: 5 },
  { key: 'beta', name: 'Beta', lo: 13, hi: 30, memory: 4 },
  { key: 'gamma', name: 'Gamma', lo: 30, hi: 45, memory: 2 },
];
const NBIN = 20, HIST_DT = 0.1, SPARK_S = 2, STALE_S = 2;
const BUTTER_Q = [0.5412, 1.3066];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
// An option passed as undefined means "not set", so it must not override a default.
const defined = (obj) => Object.fromEntries(Object.entries(obj || {}).filter(([, v]) => v !== undefined));

/** RBJ biquad coefficients, normalised by a0. */
function biquad(type, f, fs, q) {
  const w = 2 * Math.PI * f / fs, c = Math.cos(w), al = Math.sin(w) / (2 * q), a0 = 1 + al;
  const b = type === 'lp' ? [(1 - c) / 2, 1 - c, (1 - c) / 2] : [(1 + c) / 2, -(1 + c), (1 + c) / 2];
  return { b0: b[0] / a0, b1: b[1] / a0, b2: b[2] / a0, a1: -2 * c / a0, a2: (1 - al) / a0, x1: 0, x2: 0, y1: 0, y2: 0 };
}
function run(s, x) {
  const y = s.b0 * x + s.b1 * s.x1 + s.b2 * s.x2 - s.a1 * s.y1 - s.a2 * s.y2;
  s.x2 = s.x1; s.x1 = x; s.y2 = s.y1; s.y1 = y;
  return y;
}

/** The band arithmetic on its own, without a canvas: exported so hosts and tests can use it. */
export function createBandProminence(opts = {}) {
  const { rate, bands = DEFAULT_BANDS, measure = 'share', baseline = 30, margin = 1.5, span = 30 } = defined(opts);
  if (!(rate > 0)) throw new Error('band prominence: a sample rate (Hz) is required');
  if (measure !== 'share' && measure !== 'baseline') throw new Error(`band prominence: measure must be 'share' or 'baseline', not ${measure}`);
  const B = bands.map((b) => {
    const usable = b.hi < 0.45 * rate && b.lo > 0 && b.lo < b.hi;
    const tauEnv = clamp(1.5 / b.lo, 0.05, 1);
    return {
      ...b, usable,
      chain: usable ? [...BUTTER_Q.map((q) => biquad('hp', b.lo, rate, q)), ...BUTTER_Q.map((q) => biquad('lp', b.hi, rate, q))] : [],
      kEnv: 1 - Math.exp(-1 / (rate * tauEnv)),
      kBase: 1 - Math.exp(-1 / (rate * baseline)),
      kMem: 1 - Math.exp(-1 / (rate * (b.memory || 4))),
      pow: 0, amp: 0, base: 0, level: 0, mem: 0, thr: 0,
      spark: new Float32Array(Math.max(2, Math.round(SPARK_S * rate))), sparkHead: 0,
      hist: [],
    };
  });
  let n = 0, nextHist = 0, lead = -1, challenger = -1, challengeFrom = 0;

  function sample(x) {
    n++;
    const t = n / rate;
    for (const b of B) {
      if (!b.usable) continue;
      let y = x;
      for (const s of b.chain) y = run(s, y);
      b.spark[b.sparkHead] = y; b.sparkHead = (b.sparkHead + 1) % b.spark.length;
      b.pow += (y * y - b.pow) * b.kEnv;
      b.amp = Math.sqrt(2 * b.pow);
      // Warm-up: until the window has filled, the average is the plain mean so far.
      b.base += (b.amp - b.base) * Math.max(b.kBase, 1 / n);
    }
    let total = 0, usable = 0;
    for (const b of B) if (b.usable) { total += b.pow; usable++; }
    for (const b of B) {
      if (!b.usable) continue;
      if (measure === 'share') b.level = total > 0 ? b.pow / total : 0;
      else b.level = b.base > 0 ? b.amp / b.base : 0;
      b.mem += (b.level - b.mem) * Math.max(b.kMem, 1 / n);
      b.thr = measure === 'share' ? 0.5 / usable + 0.5 * b.mem : margin * b.mem;
    }
    if (t >= nextHist) {
      nextHist = t + HIST_DT;
      for (const b of B) {
        if (!b.usable) continue;
        b.hist.push([t, b.level, b.thr]);
        while (b.hist.length && b.hist[0][0] < t - Math.max(span, b.memory || 4) - 1) b.hist.shift();
      }
      pickLead(t);
    }
  }

  function ratio(b) { return b.usable && b.thr > 0 ? b.level / b.thr : -Infinity; }
  function pickLead(t) {
    let best = -1;
    B.forEach((b, i) => { if (b.usable && (best < 0 || ratio(b) > ratio(B[best]))) best = i; });
    if (best < 0) return;
    if (lead < 0) { lead = best; return; }
    if (best === lead || ratio(B[best]) < ratio(B[lead]) + 0.06) { challenger = -1; return; }
    if (best !== challenger) { challenger = best; challengeFrom = t; }
    else if (t - challengeFrom >= 0.6) { lead = best; challenger = -1; }
  }

  function bins(b, t) {
    const win = b.memory || 4, t0 = t - win, sum = new Float64Array(NBIN), cnt = new Uint16Array(NBIN);
    for (let k = b.hist.length - 1; k >= 0; k--) {
      const [ht, lv] = b.hist[k];
      if (ht < t0) break;
      const j = Math.min(NBIN - 1, Math.floor((ht - t0) / win * NBIN));
      sum[j] += lv; cnt[j]++;
    }
    return Array.from(sum, (s, j) => (cnt[j] ? s / cnt[j] : null));
  }

  return {
    push(values) { for (const v of values) if (Number.isFinite(v)) sample(v); },
    /** Samples were lost: restart the filters (their state belongs to the old signal); keep the averages. */
    gap() {
      for (const b of B) { for (const s of b.chain) { s.x1 = s.x2 = s.y1 = s.y2 = 0; } b.pow = 0; }
    },
    get seconds() { return n / rate; },
    get rate() { return rate; },
    get lead() { return lead; },
    get measure() { return measure; },
    bands: B,
    bins(i) { return bins(B[i], n / rate); },
    state() {
      return B.map((b, i) => ({
        key: b.key, name: b.name, lo: b.lo, hi: b.hi, memory: b.memory || 4, usable: b.usable,
        amplitude: b.usable ? b.amp : null, level: b.usable ? b.level : null, threshold: b.usable ? b.thr : null,
        prominent: b.usable && b.level > b.thr, lead: i === lead,
      }));
    },
  };
}

export function mountBandProminence(host, opts = {}) {
  const root = document.createElement('div');
  root.style.cssText = 'display:flex;flex-direction:column;gap:6px;font-family:var(--font-sans,system-ui,sans-serif);color:var(--foreground,inherit)';
  const status = document.createElement('div');
  status.style.cssText = 'font:11px var(--font-mono,ui-monospace,monospace);color:var(--muted-foreground,#888);display:flex;gap:12px;flex-wrap:wrap';
  const titles = document.createElement('div');
  const canvas = document.createElement('canvas');
  const info = document.createElement('div');
  const grid = 'display:grid;gap:4px;';
  titles.style.cssText = grid; info.style.cssText = grid;
  canvas.style.cssText = 'display:block;width:100%';
  canvas.setAttribute('role', 'img');
  root.append(status, titles, canvas, info);
  host.appendChild(root);
  const g = canvas.getContext('2d');
  if (!g) { root.remove(); return null; }

  let o = { rate: 0, bands: DEFAULT_BANDS, measure: 'share', baseline: 30, margin: 1.5, span: 30, ymax: null, height: 300, unit: 'µV', source: '', ...defined(opts) };
  let core = null, cols = [], lastPush = 0, dirty = true, listening = null;

  const css = (names, fallback) => {
    const style = getComputedStyle(host);
    for (const name of names) { const v = style.getPropertyValue(name).trim(); if (v) return v; }
    return fallback;
  };
  const colour = (i) => css([`--series-${i + 1}`, `--chart-${i + 1}`], ['#6247d6', '#0a8a7a', '#b97300', '#c23a69', '#1e74c4'][i % 5]);

  function build() {
    core = o.rate > 0 ? createBandProminence(o) : null;
    const nb = o.bands.length;
    titles.style.gridTemplateColumns = info.style.gridTemplateColumns = `repeat(${nb}, minmax(0, 1fr))`;
    titles.replaceChildren(); info.replaceChildren();
    cols = o.bands.map((b, i) => {
      const top = document.createElement('div');
      top.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;min-width:0;text-align:center';
      const name = document.createElement('div');
      name.style.cssText = 'display:flex;align-items:center;gap:6px;font-weight:500;font-size:14px';
      const label = document.createElement('span');
      label.textContent = b.name;
      const chip = document.createElement('span');
      chip.textContent = 'lead'; chip.hidden = true;
      chip.style.cssText = 'font:500 10px var(--font-mono,monospace);letter-spacing:.05em;text-transform:uppercase;border-radius:3px;padding:1px 5px';
      name.append(label, chip);
      const range = document.createElement('div');
      range.style.cssText = 'font:11px var(--font-mono,monospace);color:var(--muted-foreground,#888)';
      range.textContent = `${b.lo}–${b.hi} Hz`;
      const spark = document.createElement('canvas');
      spark.setAttribute('aria-hidden', 'true');
      spark.style.cssText = 'width:100%;max-width:72px;height:22px';
      top.append(name, range, spark);
      titles.appendChild(top);
      const bot = document.createElement('div');
      bot.style.cssText = 'font:11px var(--font-mono,monospace);color:var(--muted-foreground,#888);text-align:center;font-variant-numeric:tabular-nums;min-width:0;overflow-wrap:anywhere';
      info.appendChild(bot);
      return { label, chip, spark, bot };
    });
    canvas.setAttribute('aria-label', o.label || `Band prominence: each band's level against its own adaptive threshold${o.source ? `, ${o.source}` : ''}.`);
    lastPush = 0; dirty = true;
  }

  function fit(cv, h) {
    const dpr = window.devicePixelRatio || 1, w = cv.clientWidth || 600;
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
      cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); cv.style.height = h + 'px';
    }
    const c = cv.getContext('2d');
    c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, w, h);
    return { c, w, h };
  }

  function draw() {
    dirty = false;
    const ink = css(['--foreground'], '#222'), muted = css(['--muted-foreground'], '#888');
    const mono = css(['--font-mono'], 'ui-monospace, monospace');
    const now = performance.now() / 1000;
    const stale = core && lastPush > 0 && now - lastPush > STALE_S;
    root.style.opacity = stale ? '0.55' : '1';
    const parts = [];
    if (o.source) parts.push(o.source);
    if (!core) parts.push('no sample rate set');
    else {
      parts.push(`${core.rate} Hz`, `${core.seconds.toFixed(1)} s of signal`);
      if (!core.seconds) parts.push('waiting for samples');
      else if (o.measure === 'baseline' && core.seconds < o.baseline) parts.push(`warming up: baseline is the mean of ${core.seconds.toFixed(0)} of ${o.baseline} s`);
      if (stale) parts.push(`no samples for ${(now - lastPush).toFixed(0)} s`);
    }
    parts.push(o.measure === 'share' ? "level = share of total power · threshold = ½ equal share + ½ the band's recent mean share"
      : `level = amplitude ÷ the band's ${o.baseline} s mean · threshold = ${o.margin} × its recent mean level`);
    status.textContent = parts.join(' · ');

    const { c, w, h } = fit(canvas, o.height);
    const nb = o.bands.length, top = 12, bot = h - 10, share = o.measure === 'share';
    const ymax = o.ymax || (share ? 1 : 3);
    const yOf = (v) => bot - clamp(v, 0, ymax) / ymax * (bot - top);
    const fmt = (v) => share ? `${Math.round(v * 100)}%` : `${v.toFixed(2)}×`;
    const xs = o.bands.map((_, i) => w * (i + 0.5) / nb), bw = Math.min(44, w / nb * 0.34);
    c.font = '11px ' + mono; c.textBaseline = 'middle'; c.lineWidth = 1;
    const ticks = share ? [0, 0.25, 0.5, 0.75, 1].filter((v) => v <= ymax) : Array.from({ length: Math.floor(ymax) + 1 }, (_, v) => v);
    for (const v of ticks) {
      const y = yOf(v);
      c.strokeStyle = muted; c.globalAlpha = !share && v === 1 ? 0.5 : 0.18;
      c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke();
      c.globalAlpha = 0.8; c.fillStyle = muted; c.textAlign = 'left';
      c.fillText(share ? (v === 1 ? '100% of power' : `${v * 100}%`) : (v === 1 ? '1× usual' : `${v}×`), 2, y - 7);
    }
    c.globalAlpha = 1;
    if (!core) return;
    const S = core.state(), B = core.bands, t = core.seconds, pps = w / o.span;

    for (let i = 0; i < nb; i++) {
      const x0 = xs[i] - bw / 2, col = colour(i), s = S[i];
      c.globalAlpha = 0.12; c.fillStyle = muted; c.fillRect(x0, top, bw, bot - top); c.globalAlpha = 1;
      if (!s.usable) {
        c.strokeStyle = muted; c.globalAlpha = 0.5;
        for (let y = top; y < bot + bw; y += 8) { c.beginPath(); c.moveTo(x0, y); c.lineTo(x0 + bw, y - bw); c.stroke(); }
        c.globalAlpha = 1; c.fillStyle = muted; c.textAlign = 'center';
        c.fillText('above', xs[i], (top + bot) / 2 - 7); c.fillText('Nyquist', xs[i], (top + bot) / 2 + 7);
        continue;
      }
      // the memory window: mean level per bin, oldest left, solid where above the threshold
      const bin = core.bins(i), pw = bw / NBIN;
      for (let k = 0; k < NBIN; k++) {
        if (bin[k] == null) continue;
        const y = yOf(bin[k]);
        c.globalAlpha = bin[k] > s.threshold ? 0.95 : 0.35; c.fillStyle = col;
        c.fillRect(x0 + k * pw + 0.3, y, Math.max(0.8, pw - 0.6), bot - y);
      }
      // the current level
      c.globalAlpha = 1; c.fillStyle = col; c.fillRect(x0 - 2, yOf(s.level) - 1, bw + 4, 2.5);
      if (s.level > ymax) { c.fillStyle = muted; c.textAlign = 'center'; c.fillText(`▲ ${fmt(s.level)}`, xs[i], top - 4); }
      if (s.lead) { c.strokeStyle = col; c.lineWidth = 2; c.strokeRect(x0 - 4, top - 2, bw + 8, bot - top + 4); c.lineWidth = 1; }
    }
    // each band's threshold over the last `span` seconds, ending at its own bar
    for (let i = 0; i < nb; i++) {
      if (!S[i].usable) continue;
      const col = colour(i), xb = xs[i], H = B[i].hist;
      c.strokeStyle = col; c.lineWidth = 1.6; c.globalAlpha = 0.55; c.beginPath();
      c.moveTo(xb, yOf(S[i].threshold));
      for (let k = H.length - 1; k >= 0; k--) {
        const x = xb - (t - H[k][0]) * pps;
        if (x < 0) break;
        c.lineTo(x, yOf(H[k][2]));
      }
      c.stroke();
    }
    c.globalAlpha = 1;
    // the thresholds now, joined across bands
    c.strokeStyle = ink; c.fillStyle = ink; c.lineWidth = 2; c.beginPath();
    let started = false;
    for (let i = 0; i < nb; i++) {
      if (!S[i].usable) { started = false; continue; }
      const y = yOf(S[i].threshold);
      started ? c.lineTo(xs[i], y) : c.moveTo(xs[i], y); started = true;
    }
    c.stroke();
    for (let i = 0; i < nb; i++) if (S[i].usable) c.fillRect(xs[i] - bw / 2 - 6, yOf(S[i].threshold) - 2, bw + 12, 4);

    // titles, sparklines and numbers
    cols.forEach((C, i) => {
      const s = S[i], col = colour(i);
      C.label.style.color = col;
      C.chip.hidden = !s.lead; C.chip.style.background = col; C.chip.style.color = css(['--background'], '#fff');
      C.label.style.textDecoration = s.lead ? 'underline' : 'none';
      const { c: sc, w: sw, h: sh } = fit(C.spark, 22);
      const b = B[i];
      if (s.usable && core.seconds) {
        const len = b.spark.length, step = Math.max(1, Math.floor(len / 160));
        let peak = 1e-12;
        for (let k = 0; k < len; k++) peak = Math.max(peak, Math.abs(b.spark[k]));
        sc.strokeStyle = col; sc.lineWidth = 1.1; sc.beginPath();
        for (let k = 0; k < len; k += step) {
          const v = b.spark[(b.sparkHead + k) % len], x = k / (len - 1) * sw, y = sh / 2 - v / peak * (sh / 2 - 1);
          k ? sc.lineTo(x, y) : sc.moveTo(x, y);
        }
        sc.stroke();
      }
      C.bot.style.color = s.prominent ? col : '';
      C.bot.textContent = !s.usable ? `above Nyquist (${core.rate / 2} Hz)`
        : `${s.amplitude.toFixed(s.amplitude < 10 ? 2 : 1)} ${o.unit} · ${fmt(s.level)} · thr ${fmt(s.threshold)} · memory ${s.memory} s`;
    });
  }

  build();
  const tick = setInterval(() => { if (dirty || (core && lastPush)) draw(); }, 66);
  const redraw = () => { dirty = true; };
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(redraw) : null;
  if (ro) ro.observe(host);
  const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(redraw) : null;
  if (mo) mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
  draw();

  const handle = {
    push(values, meta = {}) {
      if (meta.rate && meta.rate !== o.rate) { o = { ...o, rate: meta.rate }; build(); }
      if (!core) return;
      if (meta.gap > 0) core.gap();
      core.push(values);
      lastPush = performance.now() / 1000; dirty = true;
    },
    listenTo(target) {
      handle.stopListening();
      const onSamples = (e) => handle.push(e.detail.values, { rate: e.detail.rate, gap: e.detail.gap });
      const onConnected = (e) => { if (e.detail && e.detail.rate) handle.update({ rate: e.detail.rate }); };
      target.addEventListener('signal-samples', onSamples);
      target.addEventListener('signal-connected', onConnected);
      listening = () => { target.removeEventListener('signal-samples', onSamples); target.removeEventListener('signal-connected', onConnected); };
      return handle.stopListening;
    },
    stopListening() { if (listening) listening(); listening = null; },
    state() { return core ? core.state() : []; },
    update(next) {
      next = defined(next);
      const rebuild = ['rate', 'bands', 'measure', 'baseline', 'margin', 'span'].some((k) => k in next && next[k] !== o[k]);
      o = { ...o, ...next };
      if (rebuild) build();
      dirty = true;
    },
    reset() { build(); },
    destroy() {
      clearInterval(tick); handle.stopListening();
      if (ro) ro.disconnect();
      if (mo) mo.disconnect();
      root.remove();
    },
  };
  return handle;
}

export { DEFAULT_BANDS };
