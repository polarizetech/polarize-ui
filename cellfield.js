/* polarize-ui — cell field.
 *
 * A WebGL field of specks behind a page: clusters of cells at different depths,
 * each polarising on its own rhythm, with occasional coordinated moments (a wave
 * that sweeps the page, a spell of shared rhythm) and an optional "hero" cell
 * that turns slowly and fires an outward pulse. Decoration, not data: it draws
 * nothing a reader needs, and it stops when motion is reduced.
 *
 * Zero-build:
 *   <script type="module" src="cellfield.js"></script>
 *   <main class="ui-cellfield-host">
 *     <ui-cellfield hero="#hero" density="1" intensity="1"></ui-cellfield>
 *     ...
 *   </main>
 *
 * React: <CellField hero="#hero" /> (src/components/cellfield.tsx) calls
 * mountCellField on its own element.
 *
 * Colour comes from the element's `color` (which the stylesheet sets from
 * --foreground), so it follows the theme. requestAnimationFrame is right here:
 * an animation SHOULD stop in a hidden tab. design.js's no-rAF rule is about
 * timers that must survive one.
 */

const VS = `
attribute vec4 a_pos;
attribute vec4 a_prm;
uniform float u_t; uniform vec2 u_res; uniform vec3 u_wave; uniform float u_sync;
uniform vec3 u_hero; uniform float u_scale;
varying float v_pol; varying float v_flash; varying float v_soft; varying float v_alpha; varying float v_hero;
void main() {
  float z = a_pos.z; float t = u_t;
  float hero = step(1.5, a_pos.w); float cs = fract(a_pos.w);
  vec2 p = a_pos.xy;
  vec2 hc = u_hero.xy; vec2 hv = p - hc;
  float hr = length(hv / vec2(1.0, 0.55));
  float hR = max(u_hero.z, 1.0);
  float ang = hero * t * 0.035 * (1.25 - 0.5 * min(hr / hR, 1.0));
  float br = 1.0 + hero * 0.025 * sin(t * 0.7 - hr * 0.01);
  hv = vec2(hv.x * cos(ang) - hv.y * sin(ang), hv.x * sin(ang) + hv.y * cos(ang)) * br;
  p = mix(p, hc + hv, hero);
  float sp = mix(7.0, 1.2, z) * (1.0 - hero * 0.8) * u_scale;
  p.x += sin(t * 0.045 + cs * 6.283) * sp * 5.0 + sin(t * 0.09 + cs * 17.0) * sp * 1.5;
  p.y += cos(t * 0.038 + cs * 9.1) * sp * 4.0;
  p += vec2(sin(t * 1.7 * a_prm.y + a_prm.z), cos(t * 1.3 * a_prm.y + a_prm.x)) * mix(0.9, 0.25, z) * u_scale;
  float ph = t * a_prm.y + a_prm.z;
  float pol = sin(ph);
  float fl = pow(max(0.0, sin(ph * 0.5 + a_prm.x)), 80.0);
  float dt = t - u_wave.z;
  float w = exp(-pow((distance(p, u_wave.xy) - dt * 240.0 * u_scale) / (40.0 * u_scale), 2.0)) * step(0.0, dt) * exp(-dt * 0.22);
  fl = max(fl, w);
  pol = mix(pol, 1.0, w);
  pol = mix(pol, sin(t * 2.6 + cs * 1.5), u_sync);
  float hp = mod(t, 6.5) * hR * 0.29;
  float ap = hero * exp(-pow((hr - hp) / (hR * 0.066), 2.0)) * (1.0 - smoothstep(hR * 0.8, hR * 1.27, hp));
  fl = max(fl, ap * 0.9);
  pol = mix(pol, -1.0, ap);
  float size = mix(4.4, 0.9, pow(z, 0.7)) * (0.55 + a_prm.w * 0.9) * u_scale;
  gl_PointSize = max(1.0, size * (1.0 + fl * 0.35));
  vec2 c = (p / u_res) * 2.0 - 1.0;
  gl_Position = vec4(c.x, -c.y, 0.0, 1.0);
  v_pol = pol; v_flash = fl; v_hero = hero;
  v_soft = mix(0.7, 0.2, smoothstep(0.0, 0.4, z));
  v_alpha = mix(0.4, 0.68, smoothstep(0.0, 0.5, z)) * mix(1.0, 0.5, smoothstep(0.7, 1.0, z));
}`;

const FS = `
precision mediump float;
uniform vec3 u_ink; uniform float u_int;
varying float v_pol; varying float v_flash; varying float v_soft; varying float v_alpha; varying float v_hero;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0; float r = length(c);
  if (r > 1.0) discard;
  float edge = 1.0 - smoothstep(1.0 - v_soft, 1.0, r);
  float charge = smoothstep(0.35, 1.0, abs(v_pol));
  float a = edge * v_alpha * u_int * (0.13 + 0.17 * charge + 0.16 * v_flash) * (1.0 + v_hero * 0.45);
  gl_FragColor = vec4(u_ink * a, min(a, 1.0));
}`;

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function inkOf(el) {
  const c = document.createElement('canvas').getContext('2d');
  if (!c) return [0.83, 0.84, 0.85];
  c.fillStyle = '#d4d6d9';
  c.fillStyle = getComputedStyle(el).color;
  const hex = c.fillStyle;
  if (hex[0] !== '#') {
    const m = hex.match(/[\d.]+/g) || [];
    return [m[0] / 255 || 0.83, m[1] / 255 || 0.84, m[2] / 255 || 0.85];
  }
  const v = parseInt(hex.slice(1), 16);
  return [(v >> 16 & 255) / 255, (v >> 8 & 255) / 255, (v & 255) / 255];
}

/** Specks for a W×H buffer (buffer px); hero = {x, y, r} in buffer px or null. */
function specks(W, H, density, hero, scale, seed) {
  const r = rng(seed);
  const gs = () => (r() + r() + r() + r() + r() + r() - 3) / 0.7071;
  const rows = [];
  const push = (x, y, z, cs) => rows.push([x, y, Math.min(1, Math.max(0, z)), cs, r() * 6.283, 0.3 + r() * 1.5, r() * 6.283, r()]);
  // Clusters: roughly one per 460×460 CSS px, sparse enough to leave the page room.
  const area = (W / scale) * (H / scale);
  const nCl = Math.max(4, Math.round(area / (460 * 460) * density));
  for (let k = 0; k < nCl; k++) {
    const cx = r() * W, cy = r() * H;
    const R = (16 + Math.pow(r(), 1.6) * 150) * scale;
    const cnt = Math.round((18 + Math.pow(r(), 2.4) * 380) * density);
    const z0 = Math.pow(r(), 0.6), cs = r(), kind = r();
    for (let i = 0; i < cnt; i++) {
      let x, y;
      if (kind < 0.42) {
        x = cx + gs() * R * 0.5; y = cy + gs() * R * 0.44;
      } else if (kind < 0.74) {
        const a = r() * 6.283, q = r();
        const rad = q < 0.68 ? R * (1 + 0.08 * Math.sin(a * 4 + cs * 9)) + gs() * R * 0.05
          : q < 0.86 ? R * 0.3 + gs() * R * 0.07 : Math.sqrt(r()) * R * 0.9;
        x = cx + Math.cos(a) * rad; y = cy + Math.sin(a) * rad * 0.9;
      } else {
        const u = r() * 2 - 1, ang = cs * 6.283;
        const along = u * R * 1.6, off = Math.sin(u * 3.2 + cs * 7) * R * 0.35 + gs() * R * 0.06;
        x = cx + Math.cos(ang) * along - Math.sin(ang) * off; y = cy + Math.sin(ang) * along + Math.cos(ang) * off;
      }
      push(x, y, z0 + gs() * 0.03, cs);
    }
  }
  if (hero) {
    const { x: HX, y: HY, r: HR } = hero;
    const hp = (x, y, z) => rows.push([x, y, Math.min(1, Math.max(0, z)), 2 + r(), r() * 6.283, 0.3 + r() * 1.5, r() * 6.283, r()]);
    const n = (k) => Math.round(k * density * Math.min(1.4, HR / (300 * scale)));
    for (let i = 0; i < n(1500); i++) { const a = r() * 6.283, rad = HR * (1 + 0.05 * Math.sin(a * 5 + 1.3) + 0.03 * Math.sin(a * 11)) + gs() * 7 * scale; hp(HX + Math.cos(a) * rad, HY + Math.sin(a) * rad * 0.55, 0.42 + gs() * 0.02); }
    for (let i = 0; i < n(600); i++) { const a = r() * 6.283, rad = HR * 1.13 + gs() * 22 * scale; hp(HX + Math.cos(a) * rad, HY + Math.sin(a) * rad * 0.55, 0.55 + gs() * 0.05); }
    for (let i = 0; i < n(400); i++) { const a = r() * 6.283, rad = HR * 0.86 + gs() * 10 * scale; hp(HX + Math.cos(a) * rad, HY + Math.sin(a) * rad * 0.55, 0.47 + gs() * 0.03); }
    for (let f = 0; f < 9; f++) {
      const a0 = f / 9 * 6.283 + r() * 0.4, len = 0.3 + r() * 0.45, cnt = n(90 + r() * 110);
      for (let i = 0; i < cnt; i++) { const u = Math.pow(r(), 0.8), rr = HR * (1.02 + u * len), a = a0 + Math.sin(u * 5 + f) * 0.06 + gs() * 0.012 * (1 + u * 2); hp(HX + Math.cos(a) * rr, HY + Math.sin(a) * rr * 0.55, 0.45 + u * 0.1 + gs() * 0.02); }
    }
    for (let i = 0; i < n(500); i++) { const a = r() * 6.283, rad = Math.sqrt(r()) * HR * 0.8; hp(HX + Math.cos(a) * rad, HY + Math.sin(a) * rad * 0.55, 0.6 + r() * 0.3); }
  }
  const dust = Math.round(area / 5200 * density);
  for (let i = 0; i < dust; i++) push(r() * W, r() * H, Math.pow(r(), 0.5), r());
  rows.sort((a, b) => b[2] - a[2]);
  const data = new Float32Array(rows.length * 8);
  rows.forEach((q, i) => data.set(q, i * 8));
  return data;
}

/**
 * Mount a field inside `host` (an element that fills a positioned ancestor).
 * opts: { density = 1, intensity = 1, hero = null (CSS selector or Element), seed = 29 }
 * Returns { update(opts), destroy() }, or null when WebGL is unavailable.
 */
export function mountCellField(host, opts = {}) {
  const o = { density: 1, intensity: 1, hero: null, seed: 29, ...opts };
  const canvas = document.createElement('canvas');
  canvas.setAttribute('aria-hidden', 'true');
  host.appendChild(canvas);
  const gl = canvas.getContext('webgl', { premultipliedAlpha: true, antialias: false, alpha: true });
  if (!gl) { canvas.remove(); return null; }
  const sh = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; };
  const pr = gl.createProgram();
  gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS));
  gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS));
  gl.linkProgram(pr);
  if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) { canvas.remove(); return null; }
  gl.useProgram(pr);
  const U = (k) => gl.getUniformLocation(pr, k);
  const u = { t: U('u_t'), res: U('u_res'), wave: U('u_wave'), sync: U('u_sync'), hero: U('u_hero'), scale: U('u_scale'), ink: U('u_ink'), int: U('u_int') };
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  const la = gl.getAttribLocation(pr, 'a_pos'), lb = gl.getAttribLocation(pr, 'a_prm');
  gl.enableVertexAttribArray(la); gl.vertexAttribPointer(la, 4, gl.FLOAT, false, 32, 0);
  gl.enableVertexAttribArray(lb); gl.vertexAttribPointer(lb, 4, gl.FLOAT, false, 32, 16);
  gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

  const maxDim = (gl.getParameter(gl.MAX_VIEWPORT_DIMS) || [4096, 4096])[1];
  const reduced = matchMedia('(prefers-reduced-motion: reduce)');
  let n = 0, scale = 0.5, heroBuf = [0, 0, 0], ink = [0.83, 0.84, 0.85];
  let raf = 0, t0 = 0, visible = true, wave = [0, 0, -99], nextWave = 2, syncAt = 9 + Math.random() * 6;

  function build() {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;
    scale = Math.min(0.5, maxDim / h);
    canvas.width = Math.max(1, Math.round(w * scale));
    canvas.height = Math.max(1, Math.round(h * scale));
    gl.viewport(0, 0, canvas.width, canvas.height);
    let hero = null;
    const hEl = typeof o.hero === 'string' ? document.querySelector(o.hero) : o.hero;
    if (hEl) {
      const a = hEl.getBoundingClientRect(), b = host.getBoundingClientRect();
      const rx = Math.min(a.width * 0.36, 460);
      hero = { x: (a.left - b.left + a.width / 2) * scale, y: (a.top - b.top + a.height / 2) * scale, r: rx * scale };
    }
    heroBuf = hero ? [hero.x, hero.y, hero.r] : [-9999, -9999, 1];
    const data = specks(canvas.width, canvas.height, o.density, hero, scale * 2, o.seed);
    n = data.length / 8;
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
    ink = inkOf(host);
    frame(still() ? 14.5 : clock());
  }
  function still() { return reduced.matches || o.motion === false; }
  function clock() { const now = performance.now(); if (!t0) t0 = now; return (now - t0) / 1000 + 3; }
  function frame(t) {
    if (t >= nextWave) { wave = [Math.random() * canvas.width, Math.random() * canvas.height, t]; nextWave = t + 4 + Math.random() * 5; }
    let sync = 0;
    if (t > syncAt) {
      const k = t - syncAt;
      sync = k < 1.2 ? k / 1.2 : k < 2.4 ? 1 : k < 3.6 ? 1 - (k - 2.4) / 1.2 : 0;
      if (k >= 3.6) syncAt = t + 10 + Math.random() * 8;
    }
    gl.clearColor(0, 0, 0, 0); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform1f(u.t, t); gl.uniform2f(u.res, canvas.width, canvas.height);
    gl.uniform3f(u.wave, wave[0], wave[1], wave[2]); gl.uniform1f(u.sync, sync);
    gl.uniform3f(u.hero, heroBuf[0], heroBuf[1], heroBuf[2]); gl.uniform1f(u.scale, scale * 2);
    gl.uniform3f(u.ink, ink[0], ink[1], ink[2]); gl.uniform1f(u.int, o.intensity);
    gl.drawArrays(gl.POINTS, 0, n);
  }
  function loop() {
    raf = 0;
    if (!visible || still()) return;
    frame(clock());
    raf = requestAnimationFrame(loop);
  }
  function kick() { if (!raf && visible && !still()) raf = requestAnimationFrame(loop); }

  let pending = 0;
  const ro = new ResizeObserver(() => { clearTimeout(pending); pending = setTimeout(build, 150); });
  ro.observe(host);
  const io = new IntersectionObserver((es) => { visible = es.some((e) => e.isIntersecting); kick(); });
  io.observe(host);
  const onMotion = () => { build(); kick(); };
  reduced.addEventListener('change', onMotion);
  const scheme = matchMedia('(prefers-color-scheme: dark)');
  const onScheme = () => { ink = inkOf(host); frame(still() ? 14.5 : clock()); };
  scheme.addEventListener('change', onScheme);
  build(); kick();

  return {
    update(next) { Object.assign(o, next); build(); kick(); },
    destroy() {
      if (raf) cancelAnimationFrame(raf);
      clearTimeout(pending); ro.disconnect(); io.disconnect();
      reduced.removeEventListener('change', onMotion); scheme.removeEventListener('change', onScheme);
      canvas.remove();
    },
  };
}

if (typeof customElements !== 'undefined' && !customElements.get('ui-cellfield')) {
  class UiCellfield extends HTMLElement {
    static observedAttributes = ['density', 'intensity', 'hero', 'motion'];
    opts() {
      const num = (k, d) => { const v = parseFloat(this.getAttribute(k)); return Number.isFinite(v) ? v : d; };
      return { density: num('density', 1), intensity: num('intensity', 1), hero: this.getAttribute('hero'), motion: this.getAttribute('motion') !== 'off' };
    }
    connectedCallback() {
      this.classList.add('ui-cellfield');
      this.setAttribute('aria-hidden', 'true');
      if (!this._field) this._field = mountCellField(this, this.opts());
    }
    attributeChangedCallback() { if (this._field) this._field.update(this.opts()); }
    disconnectedCallback() { if (this._field) { this._field.destroy(); this._field = null; } }
  }
  customElements.define('ui-cellfield', UiCellfield);
}
