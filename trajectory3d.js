/* polarize-ui — 3-D trajectory.
 *
 * A path through three dimensions, drawn on a 2-D canvas, with a marker at the
 * current time: a phase portrait, a state-space trajectory, a hodogram that is
 * played rather than read. Drag to turn, pinch (or Ctrl/Cmd-scroll) to zoom,
 * arrow keys to turn when the canvas has focus. A plain scroll moves the page.
 *
 * Zero-build, no dependencies:
 *   import { mountTrajectory3D } from './design/trajectory3d.js'
 *   const view = mountTrajectory3D(host, {
 *     paths: [{ points: [[x, y, z], ...], label: 'PCA' }],
 *     duration: 10, axes: ['1', '2', '3'],
 *   })
 *   view.setTime(seconds)   // moves the marker; the last `trail` seconds are drawn heavier
 *   view.update({ paths })  // new data, same view
 *   view.show(1)            // which of `paths` is drawn (one at a time)
 *   view.resetView()
 *   view.destroy()
 *
 * What the picture does and does not say:
 *   - Each path is centred and scaled to fill the view ON ITS OWN, with one scale
 *     for all three axes. Shapes are true; sizes of two paths are not comparable,
 *     and the axes carry no units or ticks.
 *   - Points are taken as evenly spaced over `duration`.
 *   - Axes are right-handed (x right, y up, z toward the viewer at yaw 0), as in
 *     src/science/space. A left-handed data frame is drawn mirrored.
 *   - There is a slight perspective, so nearer segments are drawn larger.
 *
 * Colour comes from the host's tokens: --foreground, --muted-foreground,
 * --series-1 (the path) and --series-4 (the marker), with --chart-1 / --chart-4
 * for a page on the React theme, and plain colours without either. The view is
 * redrawn when the theme changes. React projects that want units, ticks and
 * picking should use Trajectory3D (src/science/space/views.tsx) instead.
 */

const VIEW = { yaw: -0.7, pitch: 0.45, zoom: 1 };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export function mountTrajectory3D(host, opts = {}) {
  const canvas = document.createElement('canvas');
  const g = canvas.getContext('2d');
  if (!g) return null;
  canvas.style.cssText = 'display:block;width:100%;touch-action:none;cursor:grab';
  canvas.setAttribute('role', 'img');
  canvas.tabIndex = 0;
  host.appendChild(canvas);

  let o = { paths: [], duration: 1, axes: ['1', '2', '3'], trail: 1, height: 360, ...opts };
  let { yaw, pitch, zoom } = VIEW;
  let time = 0, shown = 0, norm = [];
  const pointers = new Map(); // pointerId -> [x, y]; one turns, two zoom
  let spread = 0;

  const css = (names, fallback) => {
    const style = getComputedStyle(host);
    for (const name of names) {
      const v = style.getPropertyValue(name).trim();
      if (v) return v;
    }
    return fallback;
  };

  function prepare() {
    norm = o.paths.map((p) => {
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (const q of p.points) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], q[k]); hi[k] = Math.max(hi[k], q[k]); }
      const span = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) || 1;
      return p.points.map((q) => [0, 1, 2].map((k) => (q[k] - (lo[k] + hi[k]) / 2) / span));
    });
    shown = clamp(shown, 0, Math.max(0, o.paths.length - 1));
    canvas.setAttribute('aria-label', o.label || 'A path through three dimensions. Drag, or use the arrow keys, to turn it.');
  }

  // Right-handed: z comes toward the viewer, so depth (away) is its negative. Positive pitch looks down on the path.
  function project(q, w, h) {
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const x = q[0] * cy - q[2] * sy, z = -q[0] * sy - q[2] * cy;
    const y = q[1] * cp + z * sp, depth = z * cp - q[1] * sp;
    const s = Math.min(w, h) * 0.78 * zoom / (1 + 0.35 * depth);
    return [w / 2 + x * s, h / 2 - y * s];
  }

  function draw() {
    const dpr = window.devicePixelRatio || 1, w = host.clientWidth || 600, h = o.height;
    if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
      canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr);
      canvas.style.height = h + 'px';
    }
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    const ink = css(['--foreground'], '#222'), muted = css(['--muted-foreground'], '#888');
    const line = css(['--series-1', '--chart-1'], '#3b6fd6'), mark = css(['--series-4', '--chart-4'], '#d6763b');
    g.font = '11px ' + css(['--font-mono'], 'ui-monospace, monospace');
    g.lineCap = 'round'; g.lineJoin = 'round';

    // Axes: three lines through the centre of the path's box, each labelled at its positive end.
    for (let k = 0; k < 3; k++) {
      const a = [0, 0, 0], b = [0, 0, 0]; a[k] = -0.55; b[k] = 0.55;
      const A = project(a, w, h), B = project(b, w, h);
      g.strokeStyle = muted; g.globalAlpha = 0.35; g.lineWidth = 1;
      g.beginPath(); g.moveTo(A[0], A[1]); g.lineTo(B[0], B[1]); g.stroke();
      g.globalAlpha = 0.8; g.fillStyle = muted; g.fillText(o.axes[k], B[0] + 4, B[1] - 4);
    }
    g.globalAlpha = 1;
    const pts = norm[shown];
    if (!pts || pts.length < 2) return;

    const P = pts.map((q) => project(q, w, h)), n = P.length;
    const at = clamp(time / o.duration * (n - 1), 0, n - 1), from = at - o.trail / o.duration * (n - 1);
    // The whole path faint, the part already played stronger, the last `trail` seconds heaviest.
    g.strokeStyle = line;
    for (let i = 1; i < n; i++) {
      const recent = i <= at + 1 && i >= from, past = i <= at;
      g.globalAlpha = recent ? 1 : past ? 0.45 : 0.14; g.lineWidth = recent ? 2.4 : 1.1;
      g.beginPath(); g.moveTo(P[i - 1][0], P[i - 1][1]); g.lineTo(P[i][0], P[i][1]); g.stroke();
    }
    const i = Math.floor(at), f = at - i, a = P[i], b = P[Math.min(n - 1, i + 1)];
    g.globalAlpha = 1; g.fillStyle = mark;
    g.beginPath(); g.arc(a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1]), 5, 0, Math.PI * 2); g.fill();
    g.strokeStyle = ink; g.lineWidth = 1; g.stroke();
    g.fillStyle = muted; g.fillText('start', P[0][0] + 6, P[0][1] + 3);
  }

  const gap = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };
  const down = (e) => {
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    try { canvas.setPointerCapture(e.pointerId); } catch { /* a pointer that is already gone */ }
    canvas.style.cursor = 'grabbing';
    if (pointers.size === 2) spread = gap();
  };
  const move = (e) => {
    const last = pointers.get(e.pointerId);
    if (!last) return;
    pointers.set(e.pointerId, [e.clientX, e.clientY]);
    if (pointers.size === 1) {
      yaw -= (e.clientX - last[0]) * 0.008; // the near side follows the pointer
      pitch = clamp(pitch + (e.clientY - last[1]) * 0.008, -1.5, 1.5);
    } else if (pointers.size === 2) {
      const now = gap();
      if (spread > 0) zoom = clamp(zoom * now / spread, 0.4, 3);
      spread = now;
    }
    draw();
  };
  const up = (e) => {
    pointers.delete(e.pointerId);
    if (!pointers.size) canvas.style.cursor = 'grab';
  };
  // A trackpad pinch arrives as a wheel event with ctrlKey set; a plain scroll is left to the page.
  const wheel = (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    zoom = clamp(zoom * (e.deltaY > 0 ? 0.93 : 1.08), 0.4, 3);
    draw();
  };
  const key = (e) => {
    const turn = { ArrowLeft: [0.1, 0], ArrowRight: [-0.1, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] }[e.key];
    const scale = { '+': 1.08, '=': 1.08, '-': 0.93 }[e.key];
    if (!turn && !scale) return;
    e.preventDefault();
    if (turn) { yaw += turn[0]; pitch = clamp(pitch + turn[1], -1.5, 1.5); }
    else zoom = clamp(zoom * scale, 0.4, 3);
    draw();
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', wheel, { passive: false });
  canvas.addEventListener('keydown', key);

  // The canvas holds resolved colours, so it has to be redrawn when the page's size or theme changes.
  const redraw = () => draw();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(redraw) : null;
  if (ro) ro.observe(host);
  const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(redraw) : null;
  if (mo) mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
  const scheme = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  if (scheme) scheme.addEventListener('change', redraw);

  prepare(); draw();
  return {
    update(next) { o = { ...o, ...next }; prepare(); draw(); },
    setTime(seconds) { time = seconds; draw(); },
    show(index) { shown = clamp(index, 0, Math.max(0, o.paths.length - 1)); draw(); },
    resetView() { ({ yaw, pitch, zoom } = VIEW); draw(); },
    destroy() {
      if (ro) ro.disconnect();
      if (mo) mo.disconnect();
      if (scheme) scheme.removeEventListener('change', redraw);
      canvas.remove();
    },
  };
}
