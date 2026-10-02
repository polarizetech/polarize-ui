// <tissue-field>: a tissue's activity drawn as a gradient spreading through 3-D, with the cells,
// synapses and pulses optionally drawn over it. Light DOM, so polarize-ui's classes and tokens apply.
//
//   <tissue-field></tissue-field>
//   el.field = rawDocument        // tissue-field/1, validated; throws FieldError with the reason
//   el.addEventListener('tissue-frame', e => e.detail)  // { frame, t_ms, groups: [{name, mean}] }
//   el.addEventListener('tissue-pick',  e => e.detail)  // { cell, group, kind, value } or null
//
// Page needs: polarize-ui's design.css + design.js (for <ui-tier>/<ui-note>), and an import map
// providing "three". Nothing here plays sound and nothing starts by itself.
import { validateField, groupMeans, CELL_KIND_NAME } from './src/format.mjs'
import { readRamp, tokenRgb } from './src/ramp.mjs'
import { TissueVolume } from './src/volume.js'

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]))
const fmt = (x, d = 3) => (Number.isFinite(x) ? Number(x.toPrecision(d)).toString() : 'n/a')

const STYLE = `
tissue-field { display: block; color: var(--foreground); font-family: var(--font-sans); }
tissue-field .tf-head { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: baseline; margin-bottom: var(--space-3); }
tissue-field .tf-title { font-family: var(--font-display); font-size: var(--display-3); margin: 0; }
tissue-field .tf-source { color: var(--muted-foreground); font-size: var(--text-sm); margin: 0 0 var(--space-3); }
tissue-field .tf-stage { position: relative; aspect-ratio: 16 / 10; background: var(--card); border: 1px solid var(--border); border-radius: var(--radius); overflow: hidden; touch-action: none; }
tissue-field .tf-stage canvas { position: absolute; inset: 0; width: 100%; height: 100%; display: block; cursor: grab; }
tissue-field .tf-hover { position: absolute; left: var(--space-3); bottom: var(--space-3); max-width: 70%; background: var(--card); border: 1px solid var(--border); border-radius: var(--radius-sm); padding: var(--space-2) var(--space-3); font-size: var(--text-sm); pointer-events: none; }
tissue-field .tf-axes { position: absolute; right: var(--space-3); top: var(--space-3); font-family: var(--font-mono); font-size: var(--text-xs); color: var(--muted-foreground); text-align: right; pointer-events: none; }
tissue-field .tf-controls { display: flex; flex-wrap: wrap; gap: var(--space-3); align-items: center; margin: var(--space-3) 0; }
tissue-field .tf-controls input[type=range] { accent-color: var(--accent); }
tissue-field .tf-scrub { flex: 1 1 14rem; min-width: 10rem; }
tissue-field .tf-time { font-family: var(--font-mono); font-size: var(--text-sm); min-width: 11ch; }
tissue-field .tf-legend { display: flex; align-items: center; gap: var(--space-3); font-family: var(--font-mono); font-size: var(--text-xs); color: var(--muted-foreground); margin: var(--space-3) 0; }
tissue-field .tf-ramp { flex: 0 1 18rem; height: 10px; border: 1px solid var(--border); border-radius: var(--radius-sm); }
tissue-field .tf-strip { width: 100%; height: 120px; display: block; border: 1px solid var(--border); border-radius: var(--radius-sm); background: var(--card); cursor: pointer; }
tissue-field .tf-keys { display: flex; flex-wrap: wrap; gap: var(--space-3); font-size: var(--text-xs); font-family: var(--font-mono); color: var(--muted-foreground); margin: var(--space-2) 0 var(--space-3); }
tissue-field .tf-keys i { display: inline-block; width: 10px; height: 10px; border-radius: 2px; margin-right: 4px; vertical-align: -1px; }
tissue-field .tf-notes { margin: var(--space-3) 0; }
tissue-field .tf-error { border: 1px solid var(--refuted); color: var(--refuted); padding: var(--space-3); border-radius: var(--radius); }
`

export class TissueField extends HTMLElement {
  constructor() {
    super()
    this._t = 0; this._playing = false; this._speed = 1; this._last = 0
    this._dirty = true
  }

  connectedCallback() {
    if (!document.getElementById('tissue-field-style')) {
      const s = document.createElement('style'); s.id = 'tissue-field-style'; s.textContent = STYLE; document.head.append(s)
    }
    if (!this._field && !this._error) this.innerHTML = '<p class="ui-label">No field loaded. Set the element\'s <code>field</code>.</p>'
  }

  disconnectedCallback() { this._stop(); this.vol?.dispose() }

  /** Validate and show a tissue-field/1 document. Throws FieldError (and shows its reason) on a bad one. */
  set field(raw) {
    this._stop(); this.vol?.dispose(); this.vol = null; this._error = null
    try { this._field = validateField(raw) }
    catch (e) {
      this._field = null; this._error = e
      this.innerHTML = `<div class="tf-error" role="alert"><p class="ui-label">This field was refused</p><p>${esc(e.message)}</p></div>`
      throw e
    }
    this._build()
  }
  get field() { return this._field }
  get info() { return this._field ? { ...this._field.report, t_ms: this._t, frame: this.vol?.frameIndex ?? 0, playing: this._playing } : null }

  /* ---------------------------------------------------------------- build */

  _build() {
    const f = this._field, m = f.meta, r = f.report
    this._ramps = { seq: readRamp(this, 'seq'), div: readRamp(this, 'div') }
    const ramp = this._ramps.seq
    this._groupSeries = f.groups.map((_, g) => getComputedStyle(this).getPropertyValue(`--series-${(g % 8) + 1}`).trim() || getComputedStyle(this).color)
    const driven = r.hasSource
    this.innerHTML = `
      <div class="tf-head">
        <h3 class="tf-title">${esc(m.title)}</h3>
        <ui-tier tier="${esc(m.tier)}"></ui-tier>
        <span class="ui-label">${esc(m.layout)} layout${m.space ? `: ${esc(m.space)}` : ''}</span>
      </div>
      <p class="tf-source">${esc(m.source)}</p>
      <div class="tf-notes">${(m.notes || []).map((n, i) => `<ui-note title="Note ${i + 1}" section="About this field">${esc(n)}</ui-note>`).join(' ')}
        <ui-note title="How the gradient is made" section="About this picture">The field is smooth by construction: each cell is spread over nearby voxels with a Gaussian (σ = ${fmt(this._sigma(), 2)} voxels), and what is drawn is the density-weighted <em>mean</em> activation of the cells around each point. A mean keeps the colour in the same units as a single cell wherever the tissue is dense or sparse. It is a rendering of the supplied values, not an interpolation of anything measured between cells. Opacity follows tissue density and activation; it carries no value.</ui-note>
        ${ramp.usedFallback ? '<ui-note title="Fallback colours" section="About this picture">The page did not provide polarize-ui\'s colour tokens, so the ramp is a built-in copy of the light-theme values.</ui-note>' : ''}
      </div>
      <div class="tf-stage"><canvas></canvas><div class="tf-axes"></div><div class="tf-hover" hidden></div></div>
      <div class="tf-controls">
        <button class="ui-btn ui-btn--primary" data-act="play" type="button">Play</button>
        <button class="ui-btn" data-act="restart" type="button">Restart</button>
        <label class="ui-field"><span class="ui-label">Speed</span><select data-act="speed"><option value="0.1">0.1×</option><option value="0.25">0.25×</option><option value="0.5">0.5×</option><option value="1" selected>1×</option><option value="2">2×</option></select></label>
        <input class="tf-scrub" type="range" min="0" max="${f.frames.n - 1}" step="1" value="0" data-act="scrub" aria-label="Time">
        <span class="tf-time" data-role="time"></span>
      </div>
      <div class="tf-controls">
        <label class="ui-field"><span class="ui-label">Colour shows</span><select data-act="colorBy"><option value="activation">Activation</option>${driven ? '<option value="driven">Stimulus-driven share</option>' : ''}<option value="density">Tissue density</option>${f.cells.map ? `<option value="map">${esc(f.cells.map.name)} (map)</option>` : ''}</select></label>
        <button class="ui-btn" data-act="cells" aria-pressed="false" type="button">Cells</button>
        ${f.synapses ? '<button class="ui-btn" data-act="synapses" aria-pressed="false" type="button">Synapses</button>' : ''}
        ${f.transmissions ? '<button class="ui-btn" data-act="pulses" aria-pressed="true" type="button">Pulses</button>' : ''}
        <button class="ui-btn" data-act="mip" aria-pressed="false" type="button">Brightest along ray</button>
        ${f.context ? '<button class="ui-btn" data-act="context" aria-pressed="true" type="button">Cortex surface</button>' : ''}
        ${f.context && f.context.some((m) => m.region) ? '<button class="ui-btn" data-act="regions" aria-pressed="false" type="button">Regions</button>' : ''}
        ${f.context && f.context.some((m) => m.role === 'outline') ? '<button class="ui-btn" data-act="outline" aria-pressed="false" type="button">Hemisphere outline</button>' : ''}
        <label class="ui-field"><span class="ui-label">Opacity</span><input type="range" min="1" max="16" step="0.5" value="6" data-act="opacity"></label>
        <label class="ui-field"><span class="ui-label">Hide below</span><input type="range" min="0" max="0.6" step="0.01" value="0.02" data-act="cut"></label>
      </div>
      <div class="tf-legend"><span data-role="lo"></span><span class="tf-ramp" data-role="ramp"></span><span data-role="hi"></span><span data-role="units"></span></div>
      <p class="ui-label">Group means over time</p>
      <canvas class="tf-strip" aria-label="Mean activation of each group over time; click to seek"></canvas>
      <div class="tf-keys">${f.groups.map((g, i) => `<span><i style="background:${esc(this._groupSeries[i])}"></i>${esc(g.name || 'group ' + i)}</span>`).join('')}</div>
      <dl class="ui-readout" data-role="readout"></dl>`

    const q = (s) => this.querySelector(s)
    this._canvas = q('canvas'); this._strip = q('.tf-strip'); this._hover = q('.tf-hover')
    const tokens = { ink: tokenRgb(this, '--foreground') || undefined, pulse: tokenRgb(this, '--foreground') || undefined, exc: tokenRgb(this, '--muted-foreground') || undefined, inh: tokenRgb(this, '--series-2') || undefined }
    const regionColors = f.groups.map((_, g) => tokenRgb(this, `--series-${(g % 8) + 1}`) || [0.5, 0.5, 0.5])
    this.vol = new TissueVolume(this._canvas, f, { ramp, regionColors, ...(m.render || {}), ...Object.fromEntries(Object.entries(tokens).filter(([, v]) => v)) })
    this._applyLegend()
    this._series()
    this._wire()
    this._resize()
    this._ro = new ResizeObserver(() => this._resize()); this._ro.observe(this._canvas)
    this.seekFrame(0)
  }

  _sigma() { return this.vol ? this.vol.grid.sigmaVox : 1.6 }

  _applyLegend() {
    const m = this._field.meta, mode = this._colorBy || 'activation'
    const stops = this._ramps.seq.stops
    this.querySelector('[data-role=ramp]').style.background = `linear-gradient(90deg, ${stops.map((c) => `rgb(${c.join(',')})`).join(', ')})`
    const [lo, hi] = m.domain, mp = this._field.cells.map
    this.querySelector('[data-role=lo]').textContent = mode === 'activation' ? fmt(lo) : mode === 'map' ? fmt(mp.domain[0]) : '0'
    this.querySelector('[data-role=hi]').textContent = mode === 'activation' ? fmt(hi) : mode === 'map' ? fmt(mp.domain[1]) : '1'
    this.querySelector('[data-role=units]').textContent = mode === 'activation' ? m.units : mode === 'map' ? `${mp.name}, ${mp.units}${mp.log ? ' (log scale)' : ''}` : mode === 'driven' ? 'share of excitatory input that comes straight from the stimulus' : 'tissue density, relative to the densest voxel'
  }

  /** Per-group mean traces, computed once, for the timeline strip. */
  _series() {
    const f = this._field, G = f.groups.length, T = f.frames.n
    this._gm = Array.from({ length: G }, () => new Float32Array(T))
    for (let k = 0; k < T; k++) { const gm = groupMeans(f, k); for (let g = 0; g < G; g++) this._gm[g][k] = gm[g] }
  }

  /** Orientation widget: the data axes as they point on screen, named by the field's own `meta.axes`, and a scale bar in mm. */
  _drawAxes() {
    const box = this.querySelector('.tf-axes'), ax = this._field.meta.axes
    if (!box) return
    const a = this.vol.annotate(10)
    if (!ax) { box.innerHTML = ''; return }
    const R = 38, names = ['x', 'y', 'z'], cs = getComputedStyle(this)
    const ink = cs.getPropertyValue('--foreground').trim() || cs.color, dim = cs.getPropertyValue('--muted-foreground').trim() || ink
    const full = Math.max(...a.axes.map((v) => Math.hypot(v.dx, v.dy)), 1e-6)
    let svg = `<svg width="190" height="104" viewBox="-95 -52 190 104" aria-label="orientation" role="img" font-family="${esc(cs.getPropertyValue('--font-mono') || 'monospace')}" font-size="9">`
    a.axes.forEach((v, k) => {
      const d = ax[names[k]]; if (!d) return
      const len = Math.hypot(v.dx, v.dy) / full, ux = v.dx / (Math.hypot(v.dx, v.dy) || 1), uy = v.dy / (Math.hypot(v.dx, v.dy) || 1)
      const ex = ux * R * len, ey = uy * R * len
      svg += `<line x1="${-ex}" y1="${-ey}" x2="${ex}" y2="${ey}" stroke="${esc(dim)}" stroke-width="1"/>`
      if (len > 0.45) svg += `<text x="${ex * 1.28}" y="${ey * 1.28 + 3}" text-anchor="middle" fill="${esc(ink)}">${esc(d.pos)}</text><text x="${-ex * 1.28}" y="${-ey * 1.28 + 3}" text-anchor="middle" fill="${esc(dim)}">${esc(d.neg)}</text>`
    })
    svg += '</svg>'
    const bar = `<div style="margin-top:4px;display:inline-block;border-top:2px solid ${esc(ink)};width:${Math.max(4, Math.round(a.barPx))}px"></div><div>${a.mm} mm at the centre</div>`
    box.innerHTML = svg + bar
  }

  _drawStrip() {
    const c = this._strip, dpr = Math.min(2, devicePixelRatio || 1), w = c.clientWidth, h = c.clientHeight
    if (!w) return
    if (c.width !== Math.round(w * dpr)) { c.width = Math.round(w * dpr); c.height = Math.round(h * dpr) }
    const x = c.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, w, h)
    const f = this._field, T = f.frames.n, [lo, hi] = f.meta.domain, cs = getComputedStyle(this)
    let ymax = 0
    for (const s of this._gm) for (let k = 0; k < T; k++) if (s[k] > ymax) ymax = s[k]
    ymax = Math.max(ymax, lo + 1e-9)
    const px = (k) => (k / (T - 1)) * (w - 2) + 1, py = (v) => h - 14 - ((v - lo) / (ymax - lo)) * (h - 22)
    x.lineWidth = 1.5
    this._gm.forEach((s, g) => { x.strokeStyle = this._groupSeries[g]; x.beginPath(); for (let k = 0; k < T; k++) k ? x.lineTo(px(k), py(s[k])) : x.moveTo(px(k), py(s[k])); x.stroke() })
    x.strokeStyle = cs.getPropertyValue('--foreground').trim() || cs.color; x.lineWidth = 1
    const kx = px(this.vol.frameIndex); x.beginPath(); x.moveTo(kx, 0); x.lineTo(kx, h); x.stroke()
    x.fillStyle = cs.getPropertyValue('--muted-foreground').trim() || cs.color; x.font = '10px ' + (cs.getPropertyValue('--font-mono') || 'monospace')
    x.fillText(`${fmt(ymax, 2)}`, 4, 11); x.fillText(`${fmt(lo, 2)}`, 4, h - 3)
    x.textAlign = 'right'; x.fillText(`${fmt((T * f.frames.dt_ms) / 1000, 3)} s`, w - 4, h - 3)
    x.textAlign = 'left'
  }

  /* ---------------------------------------------------------------- wiring */

  _wire() {
    const on = (sel, ev, fn) => this.querySelector(sel).addEventListener(ev, fn)
    on('[data-act=play]', 'click', () => (this._playing ? this.pause() : this.play()))
    on('[data-act=restart]', 'click', () => { this.seekFrame(0) })
    on('[data-act=speed]', 'change', (e) => { this._speed = Number(e.target.value) })
    on('[data-act=scrub]', 'input', (e) => { this.seekFrame(Number(e.target.value)) })
    on('[data-act=colorBy]', 'change', (e) => { this._colorBy = e.target.value; this.vol.set({ colorBy: this._colorBy }); this._applyLegend(); this._dirty = true })
    for (const k of ['cells', 'synapses', 'pulses', 'mip', 'context', 'regions', 'outline']) {
      const b = this.querySelector(`[data-act=${k}]`); if (!b) continue
      b.addEventListener('click', () => { const v = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(v)); this.vol.set({ [k]: v }); this._dirty = true })
    }
    on('[data-act=opacity]', 'input', (e) => { this.vol.set({ opacity: Number(e.target.value) }); this._dirty = true })
    on('[data-act=cut]', 'input', (e) => { this.vol.set({ cut: Number(e.target.value) }); this._dirty = true })
    on('.tf-strip', 'pointerdown', (e) => { const r = this._strip.getBoundingClientRect(); this.seekFrame(Math.round(((e.clientX - r.left) / r.width) * (this._field.frames.n - 1))) })
    // orbit and hover
    const c = this._canvas; let down = null, moved = 0
    c.addEventListener('pointerdown', (e) => { down = [e.clientX, e.clientY]; moved = 0; c.setPointerCapture(e.pointerId); c.style.cursor = 'grabbing' })
    c.addEventListener('pointermove', (e) => {
      if (down) { const dx = e.clientX - down[0], dy = e.clientY - down[1]; moved += Math.abs(dx) + Math.abs(dy); this.vol.dragBy(dx, dy); down = [e.clientX, e.clientY]; this._dirty = true }
      else this._hoverAt(e)
    })
    c.addEventListener('pointerup', () => { down = null; c.style.cursor = 'grab' })
    c.addEventListener('pointerleave', () => { this._clearHover() })
    c.addEventListener('wheel', (e) => { e.preventDefault(); this.vol.zoomBy(e.deltaY); this._dirty = true }, { passive: false })
  }

  _hoverAt(e) {
    const r = this._canvas.getBoundingClientRect(), i = this.vol.pickCell(e.clientX - r.left, e.clientY - r.top)
    if (i == null) return this._clearHover()
    const f = this._field, k = this.vol.frameIndex, a = f.frames.activation[k * f.cells.n + i]
    const mp = f.cells.map
    const detail = { cell: i, group: f.groups[f.cells.group[i]].name, kind: CELL_KIND_NAME[f.cells.kind[i]], value: a, units: f.meta.units, ...(mp ? { map: { name: mp.name, value: mp.values[i], units: mp.units } } : {}) }
    this.vol.select(i); this._dirty = true
    this._hover.hidden = false
    this._hover.innerHTML = `<span class="ui-label">cell ${i}</span> ${esc(detail.group)}, ${esc(detail.kind)}<br><b>${fmt(a, 5)}</b> ${esc(f.meta.units)}${mp ? `<br>${esc(mp.name)}: <b>${fmt(mp.values[i], 4)}</b> ${esc(mp.units)}` : ''}`
    this.dispatchEvent(new CustomEvent('tissue-pick', { detail }))
  }
  _clearHover() {
    if (this._hover.hidden) return
    this._hover.hidden = true; this.vol.select(null); this._dirty = true
    this.dispatchEvent(new CustomEvent('tissue-pick', { detail: null }))
  }

  _resize() {
    const r = this._canvas.getBoundingClientRect()
    if (r.width < 2) return
    this.vol.resize(r.width, r.height); this._dirty = true; this._tick(true)
  }

  /* ---------------------------------------------------------------- transport */

  play() {
    if (this._playing || !this._field) return
    if (this.vol.frameIndex >= this._field.frames.n - 1) this.seekFrame(0)
    this._playing = true; this._last = performance.now()
    this.querySelector('[data-act=play]').textContent = 'Pause'
    // setInterval, not requestAnimationFrame: rAF does not run in a hidden or headless pane
    this._timer = setInterval(() => this._tick(false), 33)
  }
  pause() { this._stop(); const b = this.querySelector('[data-act=play]'); if (b) b.textContent = 'Play' }
  _stop() { this._playing = false; clearInterval(this._timer); this._timer = null }

  /** Seek to a time in ms (rounded to the nearest frame). */
  seek(ms) { this.seekFrame(Math.round(ms / this._field.frames.dt_ms)) }

  seekFrame(k) {
    const f = this._field; if (!f) return
    k = Math.max(0, Math.min(f.frames.n - 1, Math.round(k)))
    this._t = k * f.frames.dt_ms
    this.vol.setFrame(k); this._dirty = true; this._tick(true)
  }

  _tick(force) {
    if (!this.vol) return
    const f = this._field
    if (this._playing) {
      const now = performance.now(); this._t += (now - this._last) * this._speed; this._last = now
      const T = (f.frames.n - 1) * f.frames.dt_ms
      if (this._t >= T) { this._t = T; this.pause() }
      const k = Math.round(this._t / f.frames.dt_ms)
      if (k !== this.vol.frameIndex) { this.vol.setFrame(k); this._dirty = true }
    }
    if (!this._dirty && !force) return
    this._dirty = false
    this.vol.render(); this._drawAxes(); this._drawStrip(); this._readout()
    const k = this.vol.frameIndex
    this.dispatchEvent(new CustomEvent('tissue-frame', { detail: { frame: k, t_ms: k * f.frames.dt_ms, groups: f.groups.map((g, i) => ({ name: g.name, mean: this._gm[i][k] })) } }))
  }

  _readout() {
    const f = this._field, r = f.report, k = this.vol.frameIndex, d = this.vol.disclosure()
    this.querySelector('[data-role=time]').textContent = `${fmt((k * f.frames.dt_ms) / 1000, 4)} s`
    this.querySelector('[data-act=scrub]').value = k
    const ood = r.outOfDomain.below + r.outOfDomain.above
    const cell = (a, b, small) => `<div><dt>${a}</dt><dd>${b}${small ? `<small>${small}</small>` : ''}</dd></div>`
    this.querySelector('[data-role=readout]').innerHTML = [
      cell('Frame', `${k + 1} / ${r.frames}`, `${fmt(f.frames.dt_ms)} ms per frame`),
      cell('Cells', r.cells),
      cell('Synapses', d.synapses.total ? `${d.synapses.drawn} / ${d.synapses.total}` : 'none', d.synapses.total ? (d.synapses.drawn < d.synapses.total ? 'drawn / supplied (thinned evenly)' : 'all drawn when shown') : 'the field supplied none'),
      cell('Pulses', f.transmissions ? `${d.pulses.drawn} / ${d.pulses.active}` : 'none', f.transmissions ? 'drawn / in flight now' : 'the field supplied no transmissions, so none are drawn'),
      cell('Voxel grid', d.voxels.join(' × '), `σ ${fmt(d.sigmaVox, 2)} voxels`),
      cell('Outside domain', ood, ood ? 'values counted, clamped only when drawn' : 'none'),
    ].join('')
  }
}
customElements.define('tissue-field', TissueField)
