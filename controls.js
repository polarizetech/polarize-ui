/* ==========================================================================
   polarize-ui — controls.js: hardware-style controls (zero-build ES module).

   Behaviour for the CONTROLS layer (controls.css). Load it after design.css:

     <link rel="stylesheet" href="/design/design.css">
     <link rel="stylesheet" href="/design/controls.css">
     <script type="module" src="/design/controls.js"></script>

   Two kinds of thing live here.

   1. Enhancers over native inputs. A fader or a knob is a real
      <input type="range"> inside a .ui-fader / .ui-knob marked [data-ui-control].
      Without this script the input still works (keyboard, screen reader, form).
      With it the input is drawn as hardware and gains:
        · fine adjust: drag away from the track and the gain drops, down to 1/20;
        · detents: named values the drag snaps to (data-detents), plus the
          person's own value (data-mark); PageUp / PageDown jump between them;
        · numeric entry: tap the printed value, or long-press the control;
        · a log scale (data-scale="log") for rates and frequencies;
        · hard limits that are shown, never silently clamped: the end-stops are
          always drawn and the control is marked [data-at-limit] when it sits on one.
      A hold-to-confirm button ([data-ui-hold]) switches on only after a press is
      held, and switches off with a tap.

   2. Mount functions for three SVG views: a scene timeline (mountTimeline), an
      automation lane (mountLane) and a polar panner (mountPanner). Each returns a
      handle with update() and destroy(), and the caller moves time
      (setTime / setPhase). Nothing here runs its own animation loop: no
      requestAnimationFrame (it stops in a hidden tab) and no timer except the
      hold button's.

   Every crossing of a detent dispatches a bubbling `ui-detent` event with
   { value, index, kind } in its detail. That is the hook for haptics: a native
   shell (a WKWebView, say) listens for it and fires its own feedback. Where the
   browser has navigator.vibrate it is called too.

   The arithmetic (toFrac, fromFrac, snap, fineGain, layoutScenes, valueAt,
   pathPoint) is exported, so the React components use the same functions rather
   than a second copy. This file fetches nothing, stores nothing and imports nothing.
   ========================================================================== */

const SVG_NS = 'http://www.w3.org/2000/svg';
const TAU = Math.PI * 2;

/* ---------------------------------------------------------------- pure maths -- */

export const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** Position of `value` along a control, 0…1. A log scale needs min > 0. */
export function toFrac(value, { min = 0, max = 1, scale = 'linear' } = {}) {
  if (max === min) return 0;
  if (scale === 'log') {
    if (!(min > 0)) throw new RangeError('controls: a log scale needs min > 0');
    return clamp(Math.log(value / min) / Math.log(max / min), 0, 1);
  }
  return clamp((value - min) / (max - min), 0, 1);
}

/** The value at position `frac` (0…1). */
export function fromFrac(frac, { min = 0, max = 1, scale = 'linear' } = {}) {
  const f = clamp(frac, 0, 1);
  if (scale === 'log') return min * Math.pow(max / min, f);
  return min + f * (max - min);
}

/** Round to `step` from `min`, then clamp. Floating error is trimmed. */
export function quantize(value, { min = -Infinity, max = Infinity, step = 0 } = {}) {
  let v = value;
  if (step > 0 && Number.isFinite(min)) v = min + Math.round((v - min) / step) * step;
  else if (step > 0) v = Math.round(v / step) * step;
  return clamp(Number(v.toFixed(10)), min, max);
}

/**
 * Pull `value` onto the nearest detent within `tolerance` (a fraction of the travel).
 * Returns { value, index } with index -1 when nothing caught it.
 */
export function snap(value, detents = [], { min = 0, max = 1, scale = 'linear', tolerance = 0.018 } = {}) {
  const f = toFrac(value, { min, max, scale });
  let best = -1, gap = Infinity;
  detents.forEach((d, i) => {
    const g = Math.abs(toFrac(d, { min, max, scale }) - f);
    if (g < gap) { gap = g; best = i; }
  });
  return best >= 0 && gap <= tolerance ? { value: detents[best], index: best } : { value, index: -1 };
}

/**
 * Drag gain for fine adjust. `off` is how far (px) the finger is from the control's
 * own axis. Within 24 px the gain is 1; it then falls smoothly, never below 1/20.
 */
export function fineGain(off) {
  return Math.max(0.05, 1 / (1 + Math.max(0, Math.abs(off) - 24) / 48));
}

/** A value with its unit, always. `digits` defaults by magnitude. */
export function formatValue(value, { unit = '', digits, signed = false } = {}) {
  if (value == null || Number.isNaN(value)) return '—';
  const a = Math.abs(value);
  const d = digits ?? (a >= 100 ? 0 : a >= 10 ? 1 : 2);
  let s = value.toFixed(d);
  if (signed && value > 0) s = '+' + s;
  s = s.replace('-', '−');
  return unit ? `${s} ${unit}` : s;
}

/** Read a typed number; accepts a comma decimal and a typographic minus. NaN when empty. */
export function parseEntry(text) {
  const t = String(text).trim().replace('−', '-').replace(',', '.').replace(/[^0-9eE.+-]/g, '');
  return t ? Number(t) : NaN;
}

/**
 * Lay scenes out in time. Each scene is { hold, transition } in seconds, where the
 * transition is the glide INTO that scene (it comes before the hold).
 * Returns { total, items: [{ index, rampStart, holdStart, end }] }.
 */
export function layoutScenes(scenes) {
  let t = 0;
  const items = scenes.map((s, index) => {
    const rampStart = t;
    const holdStart = rampStart + Math.max(0, Number(s.transition) || 0);
    const end = holdStart + Math.max(0, Number(s.hold) || 0);
    t = end;
    return { index, rampStart, holdStart, end };
  });
  return { total: t, items };
}

/**
 * The value at time `t`, given one value per scene. During a scene's transition it
 * glides from the previous scene's value (linearly, or geometrically on a log scale);
 * during the hold it is that scene's value.
 * Returns { value, index, phase: 'ramp' | 'hold' | 'end', progress }.
 */
export function valueAt(scenes, values, t, { scale = 'linear' } = {}) {
  const { items } = layoutScenes(scenes);
  if (!items.length) return { value: NaN, index: -1, phase: 'end', progress: 0 };
  for (const it of items) {
    const i = it.index;
    const to = values[i];
    const from = i > 0 ? values[i - 1] : to;
    if (t < it.holdStart) {
      const span = it.holdStart - it.rampStart;
      const p = span > 0 ? clamp((t - it.rampStart) / span, 0, 1) : 1;
      const v = scale === 'log' && from > 0 && to > 0 ? from * Math.pow(to / from, p) : from + (to - from) * p;
      return { value: v, index: i, phase: 'ramp', progress: p };
    }
    if (t < it.end) {
      const span = it.end - it.holdStart;
      return { value: to, index: i, phase: 'hold', progress: span > 0 ? (t - it.holdStart) / span : 1 };
    }
  }
  const last = items[items.length - 1];
  return { value: values[last.index], index: last.index, phase: 'end', progress: 1 };
}

/**
 * Where a moving source is at `phase` (0…1 of one period) on a motion path.
 *   static     stays put
 *   rock       swings ±width/2 about its azimuth, sinusoidally
 *   orbit      goes once round the head
 *   lawnmower  sweeps across ±width/2 at constant speed, stepping one row of
 *              distance per pass (rows between 0.6× and 1.4× its distance)
 * Azimuth is in degrees, 0 = ahead, positive to the right; the result is wrapped to ±180.
 */
export function pathPoint(kind, phase, { azimuth = 0, distance = 1, width = 90, rows = 3 } = {}) {
  const p = ((phase % 1) + 1) % 1;
  let az = azimuth, d = distance;
  if (kind === 'rock') az = azimuth + (width / 2) * Math.sin(TAU * p);
  else if (kind === 'orbit') az = azimuth + 360 * p;
  else if (kind === 'lawnmower') {
    const passes = Math.max(1, rows);
    const x = p * passes * 2;                 // two sweeps per row (out and back)
    const pass = Math.floor(x);
    const along = x - pass;
    az = azimuth + width * ((pass % 2 === 0 ? along : 1 - along) - 0.5);
    const row = Math.min(passes - 1, Math.floor(pass / 2));
    d = passes === 1 ? distance : distance * (0.6 + 0.8 * row / (passes - 1));
  }
  az = ((az + 180) % 360 + 360) % 360 - 180;
  return { azimuth: az, distance: d };
}

/** `n` points along one period of a path, for drawing it. */
export function pathSamples(kind, opts = {}, n = 120) {
  return Array.from({ length: n + 1 }, (_, i) => pathPoint(kind, i / n, opts));
}

/* ---------------------------------------------------------------- DOM helpers -- */

function svg(tag, attrs = {}, parent) {
  const el = document.createElementNS(SVG_NS, tag);
  for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, String(v));
  if (parent) parent.appendChild(el);
  return el;
}

function text(parent, x, y, str, attrs = {}) {
  const t = svg('text', { x, y, ...attrs }, parent);
  t.textContent = str;
  return t;
}

function div(cls, parent) {
  const d = document.createElement('div');
  d.className = cls;
  if (parent) parent.appendChild(d);
  return d;
}

function list(attr) {
  if (!attr) return [];
  return String(attr).split(',').map((s) => Number(s.trim())).filter((n) => Number.isFinite(n));
}

/** Redraw `root` without losing keyboard focus: the focused child's data-key is re-focused. */
function redraw(root, paint) {
  const active = root.querySelector('[data-key]:focus')?.getAttribute('data-key');
  while (root.firstChild) root.firstChild.remove();
  paint();
  if (active) root.querySelector(`[data-key="${active}"]`)?.focus({ preventScroll: true });
}

/** Drag on the <svg> itself, which survives redraws (its children do not). */
function dragOn(root, e, move) {
  e.preventDefault();
  const pid = e.pointerId;
  try { root.setPointerCapture(pid); } catch { /* synthetic event */ }
  const up = () => {
    root.removeEventListener('pointermove', move); root.removeEventListener('pointerup', up); root.removeEventListener('pointercancel', up);
    try { root.releasePointerCapture(pid); } catch { /* already released */ }
  };
  root.addEventListener('pointermove', move); root.addEventListener('pointerup', up); root.addEventListener('pointercancel', up);
}

/** Tell a native shell (and the page) a detent was crossed. */
function detent(el, detail) {
  el.dispatchEvent(new CustomEvent('ui-detent', { bubbles: true, detail }));
  // Browsers refuse (and log) a vibration before the person has touched the page.
  try { if (navigator.userActivation?.hasBeenActive !== false) navigator.vibrate?.(8); } catch { /* the event still fired */ }
  el.setAttribute('data-hit', '');
  setTimeout(() => el.removeAttribute('data-hit'), 160);
}

/* ------------------------------------------------------- fader / knob enhancer -- */

const HANDLES = new WeakMap();

/**
 * Enhance one .ui-fader or .ui-knob (or a .ui-control holding one).
 * Options override the element's data attributes:
 *   scale 'linear'|'log', detents number[], mark number, markLabel string,
 *   unit, digits, signed, zero (where a bipolar fill starts), ticks (minor tick count),
 *   format(value) => string, onInput(value), onChange(value).
 * Returns { value, set(v), update(opts), destroy() }, or null when there is no range input.
 */
export function initControl(root, opts = {}) {
  if (!root) return null;
  const el = root.matches('.ui-fader, .ui-knob') ? root : root.querySelector('.ui-fader, .ui-knob');
  if (!el) return null;
  if (HANDLES.has(el)) return HANDLES.get(el);
  const input = el.querySelector('input[type="range"]');
  if (!input) return null;

  const knob = el.classList.contains('ui-knob');
  const vertical = el.classList.contains('ui-fader--vertical');
  const shell = el.closest('.ui-control');
  const ds = el.dataset;
  // A log scale rewrites the input's min/max, so the originals are kept on the input.
  if (input.dataset.min == null) { input.dataset.min = input.min || '0'; input.dataset.max = input.max || '100'; }
  const realMin = Number(input.dataset.min), realMax = Number(input.dataset.max);
  let o = { ...opts };
  const read = () => ({
    min: realMin, max: realMax,
    step: input.dataset.step != null ? Number(input.dataset.step) : (input.step === 'any' ? 0 : Number(input.step || 0)),
    scale: ds.scale === 'log' ? 'log' : 'linear',
    detents: list(ds.detents), mark: ds.mark != null ? Number(ds.mark) : null, markLabel: ds.markLabel || '',
    unit: ds.unit || '', digits: ds.digits != null ? Number(ds.digits) : undefined, signed: ds.signed != null,
    zero: ds.zero != null ? Number(ds.zero) : (realMin < 0 && realMax > 0 ? 0 : realMin),
    ticks: ds.ticks != null ? Number(ds.ticks) : 0,
    // an option passed as undefined (an unset React prop) keeps the attribute's value
    ...Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined)),
  });
  let cfg = read();

  // A log scale cannot ride a linear native range, so the input carries the position
  // (0…1000) and aria-valuetext carries the value.
  const LOG_STEPS = 1000;
  if (cfg.scale === 'log') {
    input.dataset.step = String(cfg.step);
    input.min = '0'; input.max = String(LOG_STEPS); input.step = '1';
  }
  const fromInput = () => (cfg.scale === 'log' ? fromFrac(Number(input.value) / LOG_STEPS, cfg) : Number(input.value));
  const initial = o.value ?? (cfg.scale === 'log' ? Number(input.getAttribute('value') ?? realMin) : Number(input.value));

  // ---- the drawing ----
  const deco = [];
  let thumb, fill, cap;
  function build() {
    deco.splice(0).forEach((n) => n.remove());
    const at = (cls, frac, host) => {
      const n = document.createElement('span');
      n.className = cls; n.style.setProperty('--at', String(frac)); n.setAttribute('aria-hidden', 'true');
      host.appendChild(n); deco.push(n); return n;
    };
    const det = cfg.detents.map((d) => toFrac(d, cfg));
    if (knob) {
      const ring = div('ui-knob__ring', el); ring.setAttribute('aria-hidden', 'true'); deco.push(ring);
      for (let i = 1; i < cfg.ticks; i += 1) at('ui-knob__tick', i / cfg.ticks, el);
      det.forEach((f) => at('ui-knob__tick ui-knob__tick--major', f, el));
      at('ui-knob__tick ui-knob__tick--stop', 0, el); at('ui-knob__tick ui-knob__tick--stop', 1, el);
      if (cfg.mark != null) at('ui-knob__tick ui-knob__tick--mark', toFrac(cfg.mark, cfg), el);
      cap = div('ui-knob__cap', el); cap.setAttribute('aria-hidden', 'true'); deco.push(cap);
      div('ui-knob__pointer', cap);
    } else {
      const track = div('ui-fader__track', el); track.setAttribute('aria-hidden', 'true'); deco.push(track);
      fill = div('ui-fader__fill', track);
      for (let i = 1; i < cfg.ticks; i += 1) at('ui-fader__tick', i / cfg.ticks, track);
      det.forEach((f) => at('ui-fader__tick ui-fader__tick--major', f, track));
      at('ui-fader__stop', 0, track); at('ui-fader__stop', 1, track);
      if (cfg.mark != null) {
        const m = at('ui-fader__mark', toFrac(cfg.mark, cfg), track);
        if (cfg.markLabel) { const l = document.createElement('span'); l.className = 'ui-fader__mark-label'; l.textContent = cfg.markLabel; m.appendChild(l); }
      }
      thumb = div('ui-fader__thumb', track); thumb.setAttribute('aria-hidden', 'true');
    }
  }

  const out = shell?.querySelector('.ui-control__value');
  const fmt = (v) => (cfg.format ? cfg.format(v) : formatValue(v, cfg));
  let value = quantize(initial, cfg);

  function render() {
    const f = toFrac(value, cfg);
    el.style.setProperty('--frac', String(f));
    if (!knob) {
      const z = toFrac(clamp(cfg.zero, cfg.min, cfg.max), cfg);
      el.style.setProperty('--from', String(Math.min(f, z)));
      el.style.setProperty('--to', String(Math.max(f, z)));
    }
    input.setAttribute('aria-valuetext', fmt(value));
    if (out) out.textContent = fmt(value);
    const atLimit = value <= cfg.min || value >= cfg.max;
    (shell || el).toggleAttribute('data-at-limit', atLimit);
  }

  function writeInput() {
    input.value = String(cfg.scale === 'log' ? Math.round(toFrac(value, cfg) * LOG_STEPS) : value);
  }

  function set(v, { emit = false, commit = false } = {}) {
    const next = quantize(clamp(v, cfg.min, cfg.max), cfg);
    const changed = next !== value;
    value = next;
    writeInput(); render();
    if (emit && changed) { input.dispatchEvent(new Event('input', { bubbles: true })); cfg.onInput?.(value); }
    if (commit) { input.dispatchEvent(new Event('change', { bubbles: true })); cfg.onChange?.(value); }
  }

  // Native input changes (keyboard, assistive tech) are read back.
  const onNativeInput = (e) => {
    if (!e.isTrusted) return;
    const v = fromInput();
    value = quantize(v, cfg); render(); cfg.onInput?.(value);
  };
  const onNativeChange = (e) => { if (e.isTrusted) cfg.onChange?.(value); };
  // PageUp / PageDown jump between detents (the person's own mark counts as one).
  const onKey = (e) => {
    if (e.key !== 'PageUp' && e.key !== 'PageDown') return;
    const stops = [...cfg.detents, ...(cfg.mark != null ? [cfg.mark] : []), cfg.min, cfg.max].sort((a, b) => a - b);
    const next = e.key === 'PageUp' ? stops.find((s) => s > value + 1e-9) : [...stops].reverse().find((s) => s < value - 1e-9);
    if (next == null) return;
    e.preventDefault();
    set(next, { emit: true, commit: true });
    detent(el, { value: next, index: cfg.detents.indexOf(next), kind: next === cfg.mark ? 'mark' : 'detent' });
  };

  // ---- drag with fine adjust and detent snapping ----
  let drag = null, press = null;
  const onDown = (e) => {
    if (e.button > 0 || el.getAttribute('aria-disabled') === 'true') return;
    e.preventDefault();
    input.focus({ preventScroll: true });
    try { el.setPointerCapture(e.pointerId); } catch { /* not a live pointer (a synthetic event) */ }
    const box = (knob ? el : el.querySelector('.ui-fader__track') || el).getBoundingClientRect();
    let startFrac = toFrac(value, cfg);
    if (!knob) {
      // A press on the track (not the thumb) jumps there first; dragging is then relative.
      const pos = vertical ? 1 - (e.clientY - box.top) / box.height : (e.clientX - box.left) / box.width;
      const thumbFrac = startFrac;
      const near = Math.abs(pos - thumbFrac) * (vertical ? box.height : box.width) < 18;
      if (!near) { startFrac = clamp(pos, 0, 1); set(fromFrac(startFrac, cfg), { emit: true }); }
    }
    drag = { x: e.clientX, y: e.clientY, frac: startFrac, box, last: -1, moved: false };
    press = setTimeout(() => { if (drag && !drag.moved) { drag = null; openEntry(); } }, 550);
  };
  const onMove = (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (Math.hypot(dx, dy) > 4) { drag.moved = true; clearTimeout(press); }
    let delta, off;
    if (knob) { delta = -dy / 220; off = dx; }
    else if (vertical) { delta = -dy / drag.box.height; off = e.clientX - (drag.box.left + drag.box.width / 2); }
    else { delta = dx / drag.box.width; off = e.clientY - (drag.box.top + drag.box.height / 2); }
    const gain = fineGain(off);
    el.toggleAttribute('data-fine', gain < 0.9);
    // Re-anchor as the gain changes, so moving away from the track never jumps the value.
    const f = clamp(drag.frac + delta * gain, 0, 1);
    drag.frac = f; drag.x = e.clientX; drag.y = e.clientY;
    const raw = fromFrac(f, cfg);
    const stops = cfg.mark != null ? [...cfg.detents, cfg.mark] : cfg.detents;
    const s = snap(raw, stops, cfg);
    if (s.index >= 0 && s.index !== drag.last) detent(el, { value: s.value, index: s.index, kind: s.index >= cfg.detents.length ? 'mark' : 'detent' });
    drag.last = s.index;
    set(s.value, { emit: true });
  };
  const onUp = () => {
    clearTimeout(press);
    if (!drag) return;
    drag = null;
    el.removeAttribute('data-fine');
    set(value, { commit: true });
  };

  // ---- numeric entry ----
  function openEntry() {
    if (!out || shell.querySelector('.ui-control__entry')) return;
    const box = document.createElement('input');
    box.type = 'text'; box.inputMode = 'decimal'; box.className = 'ui-control__entry';
    box.value = formatValue(value, { digits: cfg.digits }).replace('−', '-');
    const name = input.getAttribute('aria-label') || shell.querySelector('.ui-control__name')?.textContent || 'value';
    box.setAttribute('aria-label', `${name}${cfg.unit ? ` in ${cfg.unit}` : ''}`);
    out.hidden = true; out.after(box); box.focus(); box.select();
    let closed = false;
    const done = (keep) => {
      if (closed) return;   // removing a focused box fires blur, which would close it a second time
      closed = true;
      if (keep) { const n = parseEntry(box.value); if (Number.isFinite(n)) set(n, { emit: true, commit: true }); }
      box.remove(); out.hidden = false; out.focus();
    };
    // preventDefault: otherwise the same Enter lands on the value button once focus returns, and reopens this.
    box.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === 'Escape') { e.preventDefault(); done(e.key === 'Enter'); }
    });
    box.addEventListener('blur', () => box.isConnected && done(true));
  }
  const onOut = () => openEntry();

  build(); set(value);
  input.addEventListener('input', onNativeInput);
  input.addEventListener('change', onNativeChange);
  input.addEventListener('keydown', onKey);
  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onUp);
  out?.addEventListener('click', onOut);

  const handle = {
    get value() { return value; },
    set(v) { set(v); },
    update(next = {}) { o = { ...o, ...next }; cfg = read(); build(); set(next.value ?? value); },
    destroy() {
      clearTimeout(press);
      input.removeEventListener('input', onNativeInput);
      input.removeEventListener('change', onNativeChange);
      input.removeEventListener('keydown', onKey);
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
      out?.removeEventListener('click', onOut);
      deco.splice(0).forEach((n) => n.remove());
      HANDLES.delete(el);
    },
  };
  HANDLES.set(el, handle);
  return handle;
}

/* ---------------------------------------------------------- hold to confirm -- */

/**
 * A button that turns ON only after a held press (default 700 ms), and OFF with a tap.
 * State is aria-pressed. Fires a bubbling `change` event and calls onChange(on).
 */
export function initHold(btn, { ms, onChange } = {}) {
  if (!btn || HANDLES.has(btn)) return HANDLES.get(btn) || null;
  const wait = ms ?? (Number(btn.dataset.holdMs) || 700);
  btn.style.setProperty('--hold-ms', `${wait}ms`);
  if (!btn.hasAttribute('aria-pressed')) btn.setAttribute('aria-pressed', 'false');
  let timer = null;
  const on = () => btn.getAttribute('aria-pressed') === 'true';
  const flip = (v) => {
    btn.setAttribute('aria-pressed', String(v));
    btn.dispatchEvent(new Event('change', { bubbles: true }));
    onChange?.(v);
  };
  const start = (e) => {
    if (e.type === 'keydown' && (e.repeat || (e.key !== ' ' && e.key !== 'Enter'))) return;
    e.preventDefault();
    if (on()) { flip(false); return; }
    btn.setAttribute('data-holding', '');
    timer = setTimeout(() => { timer = null; btn.removeAttribute('data-holding'); flip(true); detent(btn, { value: 1, index: 0, kind: 'confirm' }); }, wait);
  };
  const stop = () => { if (timer) { clearTimeout(timer); timer = null; } btn.removeAttribute('data-holding'); };
  const swallow = (e) => e.preventDefault();
  btn.addEventListener('pointerdown', start);
  btn.addEventListener('keydown', start);
  ['pointerup', 'pointerleave', 'pointercancel', 'keyup', 'blur'].forEach((t) => btn.addEventListener(t, stop));
  btn.addEventListener('click', swallow);
  const handle = {
    get value() { return on(); },
    set(v) { btn.setAttribute('aria-pressed', String(Boolean(v))); },
    destroy() {
      stop();
      btn.removeEventListener('pointerdown', start);
      btn.removeEventListener('keydown', start);
      ['pointerup', 'pointerleave', 'pointercancel', 'keyup', 'blur'].forEach((t) => btn.removeEventListener(t, stop));
      btn.removeEventListener('click', swallow);
      HANDLES.delete(btn);
    },
  };
  HANDLES.set(btn, handle);
  return handle;
}

/* ------------------------------------------------------------ scene timeline -- */

const ENDING_WORD = { met: 'met', timeout: 'timeout', no_data: 'no data', open_loop: 'open' };

/**
 * A timeline of scenes: a block per hold (its width is the hold), a wedge per
 * transition (its width is the glide), optional value curves drawn across it, a
 * playhead, and how each scene ended. See controls.d.ts for every option.
 */
export function mountTimeline(host, options = {}) {
  if (!host) return null;
  host.classList.add('ui-timeline');
  const root = svg('svg', { role: 'group' }, host);
  const key = div('ui-timeline__key', host);
  let opts = {
    scenes: [], selected: -1, time: null, curves: [], bed: null, endings: null,
    height: 120, minBlock: 28, editable: false, seekable: false,
    limits: { transition: [0, 600], hold: [0, 7200] }, steps: { transition: 5, hold: 30 },
    label: 'Scene timeline', ...options,
  };
  let width = host.clientWidth || 360;
  let geom = null;

  // Hold widths are proportional to time, except that no block is drawn narrower than
  // minBlock. If that floor bites, the lane is no longer to scale and says so.
  function layout() {
    const { items, total } = layoutScenes(opts.scenes);
    const W = Math.max(40, width);
    if (!total) return { items: [], x: () => 0, tOf: () => 0, total, scaled: false, W };
    const ramps = items.map((it) => it.holdStart - it.rampStart), holds = items.map((it) => it.end - it.holdStart);
    const rampSum = ramps.reduce((a, b) => a + b, 0);
    let k = W / total, fixed = new Set();
    for (let pass = 0; pass < 6; pass += 1) {
      const nf = new Set(items.filter((it) => holds[it.index] * k < opts.minBlock).map((it) => it.index));
      const flexT = rampSum + holds.reduce((a, h, i) => a + (nf.has(i) ? 0 : h), 0);
      const nk = flexT > 0 ? Math.max(0, W - nf.size * opts.minBlock) / flexT : k;
      const settled = nf.size === fixed.size;
      fixed = nf; k = nk;
      if (settled) break;
    }
    // Ramps are drawn at the same rate as holds; recompute k so everything fits exactly.
    let sum = 0;
    const px = items.map((it) => {
      const ramp = ramps[it.index] * k;
      const hold = fixed.has(it.index) ? opts.minBlock : holds[it.index] * k;
      const r = { ...it, x0: sum, x1: sum + ramp, x2: sum + ramp + hold };
      sum += ramp + hold;
      return r;
    });
    const fit = sum > 0 ? W / sum : 1;
    px.forEach((p) => { p.x0 *= fit; p.x1 *= fit; p.x2 *= fit; });
    const x = (t) => {
      for (const p of px) {
        if (t <= p.holdStart) return p.x0 + (p.holdStart > p.rampStart ? (t - p.rampStart) / (p.holdStart - p.rampStart) : 1) * (p.x1 - p.x0);
        if (t <= p.end) return p.x1 + (p.end > p.holdStart ? (t - p.holdStart) / (p.end - p.holdStart) : 1) * (p.x2 - p.x1);
      }
      return W;
    };
    const tOf = (xx) => {
      for (const p of px) {
        if (xx <= p.x1) return p.rampStart + (p.x1 > p.x0 ? (xx - p.x0) / (p.x1 - p.x0) : 0) * (p.holdStart - p.rampStart);
        if (xx <= p.x2) return p.holdStart + (p.x2 > p.x1 ? (xx - p.x1) / (p.x2 - p.x1) : 0) * (p.end - p.holdStart);
      }
      return total;
    };
    return { items: px, x, tOf, total, scaled: fixed.size > 0, W };
  }

  const fmtDur = (s) => (s >= 60 ? `${+(s / 60).toFixed(s % 60 ? 1 : 0)}m` : `${Math.round(s)}s`);

  function draw() { redraw(root, paint); }
  function paint() {
    geom = layout();
    const H = opts.height;
    const top = 16, bottom = opts.endings ? H - 34 : H - 14;
    const endY = H - 26;
    root.setAttribute('viewBox', `0 0 ${geom.W || width} ${H}`);
    root.setAttribute('aria-label', `${opts.label}${geom.scaled ? ' (short scenes widened; not to scale)' : ''}`);
    root.toggleAttribute('data-scaled', geom.scaled);

    if (opts.bed && opts.bed.values) {
      const d = curvePath(opts.bed.values, opts.bed.domain, top + (bottom - top) * 0.55, bottom, opts.bed.scale, true);
      if (d) svg('path', { d, class: 'ui-timeline__bed' }, root);
    }

    geom.items.forEach((p) => {
      const sc = opts.scenes[p.index];
      const sel = p.index === opts.selected;
      // the wedge: direction follows the first curve, else alternates
      const c0 = opts.curves[0]?.values;
      const rising = c0 && p.index > 0 ? c0[p.index] >= c0[p.index - 1] : p.index % 2 === 0;
      if (p.x1 > p.x0) {
        svg('rect', { x: p.x0, y: top, width: p.x1 - p.x0, height: bottom - top, class: 'ui-timeline__ramp' }, root);
        svg('line', { x1: p.x0, y1: rising ? bottom : top, x2: p.x1, y2: rising ? top : bottom, class: 'ui-timeline__slope' }, root);
      }
      const block = svg('rect', {
        x: p.x1, y: top, width: Math.max(1, p.x2 - p.x1), height: bottom - top, class: 'ui-timeline__scene',
        'data-selected': String(sel), 'data-key': `scene-${p.index}`, tabindex: opts.onSelect ? 0 : null, role: opts.onSelect ? 'button' : null,
        'aria-pressed': opts.onSelect ? String(sel) : null,
        'aria-label': `${p.index + 1} ${sc.label || ''}: transition ${fmtDur(p.holdStart - p.rampStart)}, hold ${fmtDur(p.end - p.holdStart)}`,
      }, root);
      if (opts.onSelect) {
        block.addEventListener('click', () => opts.onSelect(p.index));
        block.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); opts.onSelect(p.index); } });
      }
      svg('line', { x1: p.x1, y1: top, x2: p.x1, y2: bottom, class: 'ui-timeline__edge', 'data-selected': String(sel) }, root);
      const room = p.x2 - p.x1 - 6;
      const name = room > 60 ? `${p.index + 1} ${sc.label || ''}`.trim() : String(p.index + 1);
      text(root, p.x1 + 4, top + 12, name, { class: 'ui-timeline__label', 'data-selected': String(sel) });
      if (room > 30) text(root, p.x1 + 4, bottom - 5, fmtDur(p.end - p.holdStart));
      if (opts.endings && opts.endings[p.index]) {
        const ending = opts.endings[p.index];
        const word = ENDING_WORD[ending] || String(ending);
        const w = Math.min(p.x2 - p.x1 - 2, word.length * 5.6 + 10);
        svg('rect', { x: p.x1 + 1, y: endY, width: Math.max(10, w), height: 16, rx: 4, class: 'ui-timeline__ending', 'data-ending': ending }, root);
        text(root, p.x1 + 6, endY + 11, word, { class: 'ui-timeline__ending-word' });
      }
    });

    opts.curves.forEach((c, i) => {
      const d = curvePath(c.values, c.domain, top + 18, bottom - 14, c.scale, false);
      if (d) svg('path', { d, class: 'ui-timeline__curve', 'data-series': c.series ?? i + 1 }, root);
    });

    // handles on the selected scene: left edge sets its transition, right edge its hold
    const s = geom.items[opts.selected];
    if (opts.editable && s) {
      handle(s.x0, 'transition', s);
      handle(s.x2, 'hold', s);
    }

    if (opts.time != null && geom.total) {
      const x = geom.x(clamp(opts.time, 0, geom.total));
      svg('rect', { x: 0, y: top, width: x, height: bottom - top, class: 'ui-timeline__played' }, root);
      svg('line', { x1: x, y1: 0, x2: x, y2: bottom, class: 'ui-timeline__playhead' }, root);
      svg('circle', { cx: x, cy: 4, r: 4, class: 'ui-timeline__cap' }, root);
    }

    // the key: every curve is named in words, not only by colour
    while (key.firstChild) key.firstChild.remove();
    key.hidden = !opts.curves.length && !opts.bed;
    opts.curves.forEach((c, i) => {
      const sp = document.createElement('span');
      sp.style.setProperty('--swatch', `var(--series-${c.series ?? i + 1})`);
      sp.textContent = c.label || `curve ${i + 1}`;
      key.appendChild(sp);
    });
    if (opts.bed) { const sp = document.createElement('span'); sp.textContent = `${opts.bed.label || 'bed'} (area)`; key.appendChild(sp); }
  }

  function curvePath(values, domain, y0, y1, scale = 'linear', area = false) {
    if (!values || !values.length || !geom.total) return '';
    const lo = domain ? domain[0] : Math.min(...values), hi = domain ? domain[1] : Math.max(...values);
    const y = (v) => (hi === lo ? (y0 + y1) / 2 : y1 - toFrac(v, { min: lo, max: hi, scale: scale === 'log' && lo > 0 ? 'log' : 'linear' }) * (y1 - y0));
    const pts = [];
    const n = Math.max(24, Math.round(geom.W / 3));
    for (let i = 0; i <= n; i += 1) {
      const xx = (i / n) * geom.W;
      const v = valueAt(opts.scenes, values, geom.tOf(xx), { scale }).value;
      pts.push(`${xx.toFixed(1)} ${y(v).toFixed(1)}`);
    }
    return area ? `M0 ${y1} L${pts.join(' L')} L${geom.W} ${y1} Z` : `M${pts.join(' L')}`;
  }

  // Uncontrolled by default: an edit updates the timeline's own scenes and then reports.
  // A controlled caller passes the new scenes back with update().
  function apply(index, field, v) {
    const [lo, hi] = opts.limits[field];
    const value = clamp(Math.round(v), lo, hi);
    if (opts.scenes[index][field] === value) return;
    opts.scenes = opts.scenes.map((sc, i) => (i === index ? { ...sc, [field]: value } : sc));
    draw();
    opts.onChange?.({ index, field, value, scenes: opts.scenes });
  }

  function handle(x, field, s) {
    const [lo, hi] = opts.limits[field];
    const sc = opts.scenes[s.index];
    const h = svg('rect', {
      x: x - 4, y: 12, width: 8, height: opts.height - (opts.endings ? 44 : 22), rx: 3, class: 'ui-timeline__handle',
      tabindex: 0, role: 'slider', 'data-key': `handle-${field}`, 'aria-label': `${field} of scene ${s.index + 1}`,
      'aria-valuemin': lo, 'aria-valuemax': hi, 'aria-valuenow': sc[field], 'aria-valuetext': fmtDur(sc[field]),
    }, root);
    const mid = 12 + (opts.height - (opts.endings ? 44 : 22)) / 2;
    for (const dy of [-4, 0, 4]) svg('line', { x1: x - 2, y1: mid + dy, x2: x + 2, y2: mid + dy, class: 'ui-timeline__grip' }, root);
    h.addEventListener('keydown', (e) => {
      const step = opts.steps[field] * (e.shiftKey ? 10 : 1);
      const dir = { ArrowRight: 1, ArrowUp: 1, ArrowLeft: -1, ArrowDown: -1 }[e.key];
      if (!dir) return;
      e.preventDefault();
      // the transition handle sits at the scene's left edge: moving it left lengthens the glide
      apply(s.index, field, sc[field] + (field === 'transition' ? -dir : dir) * step);
    });
    h.addEventListener('pointerdown', (e) => {
      const box = root.getBoundingClientRect();
      const perPx = geom.W / box.width;
      const startX = e.clientX, start = sc[field], index = s.index;
      const secPerPx = (field === 'hold' ? (s.end - s.holdStart) / Math.max(1, s.x2 - s.x1) : (s.holdStart - s.rampStart) / Math.max(1, s.x1 - s.x0)) || (geom.total / geom.W);
      dragOn(root, e, (ev) => {
        const dx = (ev.clientX - startX) * perPx;
        const gain = fineGain(ev.clientY - (box.top + box.height / 2));
        apply(index, field, start + (field === 'transition' ? -dx : dx) * secPerPx * gain);
      });
    });
  }

  const onSeek = (e) => {
    if (!opts.seekable || !opts.onSeek || e.target.closest('.ui-timeline__handle, .ui-timeline__scene[tabindex]')) return;
    const box = root.getBoundingClientRect();
    opts.onSeek(geom.tOf(((e.clientX - box.left) / box.width) * geom.W));
  };
  root.addEventListener('pointerdown', onSeek);
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { const w = host.clientWidth; if (w && Math.abs(w - width) > 1) { width = w; draw(); } }) : null;
  ro?.observe(host);
  draw();

  return {
    update(next) { opts = { ...opts, ...next }; draw(); },
    setTime(t) { opts.time = t; draw(); },
    destroy() { ro?.disconnect(); root.removeEventListener('pointerdown', onSeek); root.remove(); key.remove(); host.classList.remove('ui-timeline'); },
  };
}

/* ------------------------------------------------------------- automation lane -- */

/**
 * One parameter's journey across the scenes: a point where each scene's value is
 * reached, the glide between, notches it snaps to, an optional linked curve (another
 * parameter roped to this one), hand-drawn points and the person's own value.
 */
export function mountLane(host, options = {}) {
  if (!host) return null;
  host.classList.add('ui-lane');
  const root = svg('svg', { role: 'group' }, host);
  let opts = {
    scenes: [], values: [], domain: [0, 1], scale: 'linear', unit: '', series: 2,
    notches: [], linked: null, drawn: null, mark: null, time: null,
    height: 64, editable: false, step: 0, label: 'Automation lane', ...options,
  };
  let width = host.clientWidth || 360;
  let pad = 6;

  function draw() { redraw(root, paint); }
  function paint() {
    const H = opts.height, W = Math.max(40, width);
    root.setAttribute('viewBox', `0 0 ${W} ${H}`);
    root.setAttribute('aria-label', opts.label);
    const { items, total } = layoutScenes(opts.scenes);
    if (!total) return;
    // Inset by the point radius, so a point on the first or last edge is drawn whole.
    const inset = 7;
    const x = (t) => inset + (t / total) * (W - 2 * inset);
    const tOf = (xx) => clamp((xx - inset) / (W - 2 * inset), 0, 1) * total;
    const sc = { min: opts.domain[0], max: opts.domain[1], scale: opts.scale };
    const y = (v) => H - pad - toFrac(v, sc) * (H - 2 * pad);
    const vOf = (yy) => fromFrac((H - pad - yy) / (H - 2 * pad), sc);

    items.forEach((it) => { if (it.holdStart > it.rampStart) svg('rect', { x: x(it.rampStart), y: 0, width: x(it.holdStart) - x(it.rampStart), height: H, class: 'ui-lane__band' }, root); });
    if (opts.domain[0] < 0 && opts.domain[1] > 0) svg('line', { x1: 0, y1: y(0), x2: W, y2: y(0), class: 'ui-lane__zero' }, root);
    if (opts.mark != null) svg('line', { x1: 0, y1: y(opts.mark), x2: W, y2: y(opts.mark), class: 'ui-lane__mark' }, root);
    opts.notches.forEach((n) => {
      svg('line', { x1: 0, y1: y(n), x2: W, y2: y(n), class: 'ui-lane__notch-line' }, root);
      text(root, W - 4, y(n) - 3, formatValue(n, { unit: opts.unit }), { 'text-anchor': 'end' });
    });
    const path = (vals, cls, scale) => {
      const n = Math.max(24, Math.round(W / 3));
      const pts = Array.from({ length: n + 1 }, (_, i) => {
        const xx = (i / n) * W;
        return `${xx.toFixed(1)} ${y(valueAt(opts.scenes, vals, tOf(xx), { scale }).value).toFixed(1)}`;
      });
      return svg('path', { d: `M${pts.join(' L')}`, class: cls }, root);
    };
    if (opts.linked?.values) path(opts.linked.values, 'ui-lane__linked', opts.scale);
    path(opts.values, 'ui-lane__curve', opts.scale).setAttribute('data-series', opts.series);
    if (opts.drawn?.length) svg('path', { d: `M${opts.drawn.map((p) => `${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' L')}`, class: 'ui-lane__drawn' }, root);

    items.forEach((it) => {
      const v = opts.values[it.index];
      const pt = svg('circle', {
        cx: x(it.holdStart), cy: y(v), r: 5, class: 'ui-lane__point', 'data-key': `point-${it.index}`,
        tabindex: opts.editable ? 0 : null, role: opts.editable ? 'slider' : null,
        'aria-label': `${opts.label}, scene ${it.index + 1}`, 'aria-valuetext': formatValue(v, { unit: opts.unit }),
        'aria-valuemin': opts.domain[0], 'aria-valuemax': opts.domain[1], 'aria-valuenow': v,
      }, root);
      if (opts.editable) wirePoint(pt, it.index, y, vOf);
    });

    if (opts.time != null) {
      const xx = x(clamp(opts.time, 0, total));
      svg('line', { x1: xx, y1: 0, x2: xx, y2: H, class: 'ui-lane__playhead' }, root);
      svg('circle', { cx: xx, cy: 3, r: 3, class: 'ui-lane__cap' }, root);
    }
  }

  let lastHit = -1;
  // Uncontrolled by default, like the timeline: the lane keeps the new value and reports it.
  function commit(index, raw) {
    const sc = { min: opts.domain[0], max: opts.domain[1], scale: opts.scale };
    const stops = opts.mark != null ? [...opts.notches, opts.mark] : opts.notches;
    const s = snap(raw, stops, sc);
    const v = quantize(s.value, { ...sc, step: opts.step });
    if (v === opts.values[index]) return;
    opts.values = opts.values.map((x, i) => (i === index ? v : x));
    draw();
    const pt = root.querySelector(`[data-key="point-${index}"]`);
    if (s.index >= 0 && s.index !== lastHit && pt) detent(pt, { value: v, index: s.index, kind: s.index >= opts.notches.length ? 'mark' : 'notch' });
    lastHit = s.index;
    opts.onChange?.({ index, value: v, values: opts.values });
  }

  function wirePoint(pt, index, y, vOf) {
    pt.addEventListener('keydown', (e) => {
      const dir = { ArrowUp: 1, ArrowRight: 1, ArrowDown: -1, ArrowLeft: -1 }[e.key];
      if (!dir) return;
      e.preventDefault();
      const sc = { min: opts.domain[0], max: opts.domain[1], scale: opts.scale };
      commit(index, fromFrac(toFrac(opts.values[index], sc) + dir * (e.shiftKey ? 0.1 : 0.01), sc));
    });
    pt.addEventListener('pointerdown', (e) => {
      const box = root.getBoundingClientRect();
      const scaleY = opts.height / box.height;
      const startY = e.clientY, startX = e.clientX, startPx = y(opts.values[index]);
      lastHit = -1;
      dragOn(root, e, (ev) => commit(index, vOf(startPx + (ev.clientY - startY) * scaleY * fineGain(ev.clientX - startX))));
    });
  }

  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { const w = host.clientWidth; if (w && Math.abs(w - width) > 1) { width = w; draw(); } }) : null;
  ro?.observe(host);
  draw();
  return {
    update(next) { opts = { ...opts, ...next }; draw(); },
    setTime(t) { opts.time = t; draw(); },
    destroy() { ro?.disconnect(); root.remove(); host.classList.remove('ui-lane'); },
  };
}

/* -------------------------------------------------------------- polar panner -- */

/**
 * A top-down head in a room: distance rings (log), azimuth labels, a draggable
 * source and, when the source moves, its path with a dot at the current phase.
 * Azimuth snaps to ahead, behind and the two sides.
 */
export function mountPanner(host, options = {}) {
  if (!host) return null;
  host.classList.add('ui-panner');
  const S = 250, C = S / 2, R = 110;
  const root = svg('svg', { viewBox: `0 0 ${S} ${S}` }, host);
  let opts = {
    azimuth: 0, distance: 1, distanceRange: [0.2, 10], rings: [1, 3, 10],
    path: 'static', width: 90, rows: 3, phase: null, disabled: false,
    label: 'Source position', ...options,
  };
  const rOf = (d) => 14 + toFrac(clamp(d, opts.distanceRange[0], opts.distanceRange[1]), { min: opts.distanceRange[0], max: opts.distanceRange[1], scale: 'log' }) * (R - 14);
  const dOf = (r) => fromFrac((r - 14) / (R - 14), { min: opts.distanceRange[0], max: opts.distanceRange[1], scale: 'log' });
  const xy = (az, d) => { const a = (az * Math.PI) / 180, r = rOf(d); return [C + Math.sin(a) * r, C - Math.cos(a) * r]; };
  let source = null, lastSnap = -1;

  function draw() { redraw(root, paint); }
  function paint() {
    host.setAttribute('aria-disabled', String(Boolean(opts.disabled)));
    svg('rect', { x: 0.5, y: 0.5, width: S - 1, height: S - 1, rx: 10, class: 'ui-panner__well' }, root);
    svg('circle', { cx: C, cy: C, r: rOf(opts.distanceRange[0]) + 8, class: 'ui-panner__ring ui-panner__ring--near' }, root);
    opts.rings.forEach((d) => { svg('circle', { cx: C, cy: C, r: rOf(d), class: 'ui-panner__ring' }, root); text(root, C + rOf(d) * 0.71 + 2, C - rOf(d) * 0.71 - 2, String(d)); });
    svg('line', { x1: C, y1: 8, x2: C, y2: S - 8, class: 'ui-panner__axis' }, root);
    svg('line', { x1: 8, y1: C, x2: S - 8, y2: C, class: 'ui-panner__axis' }, root);
    text(root, C - 5, 18, '0°'); text(root, S - 26, C - 4, '90°'); text(root, C - 14, S - 8, '±180°'); text(root, 8, C - 4, '−90°');
    const head = svg('g', { 'aria-hidden': 'true' }, root);
    svg('circle', { cx: C, cy: C, r: 12, class: 'ui-panner__head' }, head);
    svg('path', { d: `M${C} ${C - 17} l-4 5 h8 z`, class: 'ui-panner__nose' }, head);
    svg('rect', { x: C - 15, y: C - 4, width: 3, height: 8, rx: 1.5, class: 'ui-panner__ear' }, head);
    svg('rect', { x: C + 12, y: C - 4, width: 3, height: 8, rx: 1.5, class: 'ui-panner__ear' }, head);
    const pathOpts = { azimuth: opts.azimuth, distance: opts.distance, width: opts.width, rows: opts.rows };
    if (opts.path !== 'static') {
      const pts = pathSamples(opts.path, pathOpts).map((p) => xy(p.azimuth, p.distance).map((n) => n.toFixed(1)).join(' '));
      svg('path', { d: `M${pts.join(' L')}`, class: 'ui-panner__path' }, root);
      if (opts.phase != null) { const p = pathPoint(opts.path, opts.phase, pathOpts); const [px, py] = xy(p.azimuth, p.distance); svg('circle', { cx: px, cy: py, r: 3.5, class: 'ui-panner__phase' }, root); }
    }
    const [sx, sy] = xy(opts.azimuth, opts.distance);
    svg('circle', { cx: sx, cy: sy, r: 14, class: 'ui-panner__halo', 'aria-hidden': 'true' }, root);
    const azs = Math.round(opts.azimuth);
    source = svg('circle', {
      cx: sx, cy: sy, r: 9, class: 'ui-panner__source', 'data-key': 'source', tabindex: opts.disabled ? -1 : 0, role: 'slider',
      'aria-label': opts.label, 'aria-valuemin': -180, 'aria-valuemax': 180, 'aria-valuenow': azs,
      'aria-valuetext': `azimuth ${formatValue(azs, { digits: 0, unit: '°' }).replace(' °', '°')}, distance ${formatValue(opts.distance)}`,
      'aria-disabled': opts.disabled ? 'true' : null,
    }, root);
    text(root, 10, 18, `${azs}° · ${formatValue(opts.distance)}`, { class: 'ui-panner__readout' });
    wire();
  }

  function emit(az, d) {
    const SNAPS = [0, 90, -90, 180];
    let a = ((az + 180) % 360 + 360) % 360 - 180, hit = -1;
    SNAPS.forEach((s, i) => { const g = Math.abs(((a - s + 540) % 360) - 180); if (g <= 4) { a = s === 180 && a < 0 ? -180 : s; hit = i; } });
    if (hit >= 0 && hit !== lastSnap) detent(source, { value: a, index: hit, kind: 'azimuth' });
    lastSnap = hit;
    opts = { ...opts, azimuth: a, distance: clamp(d, opts.distanceRange[0], opts.distanceRange[1]) };
    draw();
    opts.onChange?.({ azimuth: opts.azimuth, distance: opts.distance });
  }

  function wire() {
    if (opts.disabled) return;
    source.addEventListener('keydown', (e) => {
      const fine = e.shiftKey ? 1 : 5;
      const k = { ArrowLeft: [-fine, 1], ArrowRight: [fine, 1], ArrowUp: [0, 1.1], ArrowDown: [0, 1 / 1.1] }[e.key];
      if (!k) return;
      e.preventDefault();
      emit(opts.azimuth + k[0], opts.distance * k[1]);
    });
    source.addEventListener('pointerdown', (e) => {
      source.focus({ preventScroll: true });
      lastSnap = -1;
      dragOn(root, e, (ev) => {
        const box = root.getBoundingClientRect();
        const px = ((ev.clientX - box.left) / box.width) * S - C;
        const py = ((ev.clientY - box.top) / box.height) * S - C;
        emit((Math.atan2(px, -py) * 180) / Math.PI, dOf(Math.hypot(px, py)));
      });
    });
  }

  draw();
  return {
    update(next) { opts = { ...opts, ...next }; draw(); },
    setPhase(p) { opts.phase = p; draw(); },
    destroy() { root.remove(); host.classList.remove('ui-panner'); host.removeAttribute('aria-disabled'); },
  };
}

/* ---------------------------------------------------------------- page init -- */

/** Enhance every [data-ui-control] and [data-ui-hold] under `root`. Returns the handles. */
export function init(root = document) {
  const out = [];
  root.querySelectorAll('[data-ui-control]').forEach((el) => { const h = initControl(el); if (h) out.push(h); });
  root.querySelectorAll('[data-ui-hold]').forEach((el) => { const h = initHold(el); if (h) out.push(h); });
  return out;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => init());
  else init();
}
