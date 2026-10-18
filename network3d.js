/* polarize-ui — interactive 3-D node-link view.
 *
 * A dependency-free canvas renderer for a standard spatial network. The caller
 * supplies positions plus visual state; this module owns projection, orbit,
 * zoom, depth sorting and token-resolved colour. It does not compute a graph or
 * infer scientific meaning from it.
 *
 * Zero-build:
 *   import { mountNetwork3D } from './design/network3d.js'
 *   const view = mountNetwork3D(host, { nodes, edges, axes: ['x', 'y', 'z'] })
 *   view.update({ nodes, edges })
 *   view.resetView()
 *   view.destroy()
 *
 * Positions are centred and scaled together to fill the view. This preserves
 * relative geometry, but the axes carry no units or ticks. Node radius,
 * intensity and rings, and edge intensity, width and marker are display values
 * supplied by the caller. They are not calculated here.
 */

const VIEW = { yaw: 0.65, pitch: -0.18, zoom: 1 };
const NETWORK_TAU = Math.PI * 2;
const clamp = (value, low, high) => Math.max(low, Math.min(high, value));

export function mountNetwork3D(host, options = {}) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  if (!context) return null;
  canvas.style.cssText = 'display:block;width:100%;touch-action:none;cursor:grab';
  canvas.setAttribute('role', 'img');
  canvas.tabIndex = 0;
  host.appendChild(canvas);

  let opts = {
    nodes: [], edges: [], axes: ['x', 'y', 'z'], height: 420,
    edgeWidth: 1.25, showVolume: true, wheelZoom: false, ...options,
  };
  let { yaw, pitch, zoom } = VIEW;
  let normalized = [];
  const pointers = new Map();
  let spread = 0;

  const css = (names, fallback) => {
    const style = getComputedStyle(host);
    for (const name of names) {
      const value = style.getPropertyValue(name).trim();
      if (value) return value;
    }
    return fallback;
  };

  function series(index) {
    const slot = clamp(Math.round(index || 0) + 1, 1, 8);
    return css([`--series-${slot}`, `--chart-${slot}`], ['#3987e5', '#9085e9', '#d95926'][slot - 1] || '#3987e5');
  }

  function prepare() {
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (const node of opts.nodes) for (let axis = 0; axis < 3; axis += 1) {
      lo[axis] = Math.min(lo[axis], Number(node.position?.[axis]) || 0);
      hi[axis] = Math.max(hi[axis], Number(node.position?.[axis]) || 0);
    }
    const span = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) || 1;
    normalized = opts.nodes.map((node) => ({
      ...node,
      position: [0, 1, 2].map((axis) => ((Number(node.position?.[axis]) || 0) - (lo[axis] + hi[axis]) / 2) / span),
    }));
    canvas.setAttribute('aria-label', opts.label || 'A spatial node-link network. Drag, or use the arrow keys, to turn it.');
  }

  function project(point, width, height) {
    const [x0, y0, z0] = point;
    const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
    const x = x0 * cy - z0 * sy, z = x0 * sy + z0 * cy;
    const y = y0 * cp - z * sp, depth = y0 * sp + z * cp;
    const scale = Math.min(width, height) * 0.78 * zoom / Math.max(0.65, 1 + depth * 0.35);
    return { x: width / 2 + x * scale, y: height / 2 + y * scale, depth, scale };
  }

  function draw() {
    const dpr = window.devicePixelRatio || 1;
    const width = host.clientWidth || 640, height = opts.height;
    if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
      canvas.width = Math.round(width * dpr); canvas.height = Math.round(height * dpr);
      canvas.style.height = `${height}px`;
    }
    context.setTransform(dpr, 0, 0, dpr, 0, 0);
    context.clearRect(0, 0, width, height);
    context.lineCap = 'round'; context.lineJoin = 'round';
    const muted = css(['--muted-foreground'], '#888');
    const points = normalized.map((node, index) => ({ ...project(node.position, width, height), node, index }));

    if (opts.showVolume) {
      context.save(); context.translate(width / 2, height / 2);
      context.strokeStyle = series(0); context.globalAlpha = 0.12; context.lineWidth = 1;
      for (const radius of [0.17, 0.31, 0.46].map((part) => Math.min(width, height) * part)) {
        context.beginPath(); context.ellipse(0, 0, radius, radius * 0.62, -pitch, 0, NETWORK_TAU); context.stroke();
      }
      context.restore();
    }

    for (const edge of opts.edges) {
      const a = points[edge.source], b = points[edge.target];
      if (!a || !b) continue;
      const intensity = clamp(Number(edge.intensity) || 0, 0, 1);
      const depth = clamp(0.74 - (a.depth + b.depth) * 0.08, 0.42, 1);
      context.globalAlpha = (0.14 + intensity * 0.32) * depth;
      context.lineWidth = (Number(edge.width) || opts.edgeWidth) + intensity * 1.5;
      context.strokeStyle = series(edge.series || 0);
      context.beginPath(); context.moveTo(a.x, a.y); context.lineTo(b.x, b.y); context.stroke();
      if (Number.isFinite(edge.marker)) {
        const phase = ((edge.marker % 1) + 1) % 1;
        const x = a.x + (b.x - a.x) * phase, y = a.y + (b.y - a.y) * phase;
        context.globalAlpha = 0.3 + intensity * 0.62;
        context.shadowBlur = 8; context.shadowColor = series(edge.series || 0);
        context.fillStyle = series(edge.series || 0);
        context.beginPath(); context.arc(x, y, 1.7 + intensity * 1.5, 0, NETWORK_TAU); context.fill();
        context.shadowBlur = 0;
      }
    }

    points.sort((a, b) => a.depth - b.depth);
    for (const point of points) {
      const intensity = clamp(Number(point.node.intensity) || 0, 0, 1);
      const radius = Math.max(1.5, Number(point.node.radius) || 4) * clamp(1 - point.depth * 0.12, 0.72, 1.35);
      const colour = series(point.node.series || 0);
      context.fillStyle = colour; context.globalAlpha = clamp(0.58 + intensity * 0.38 - point.depth * 0.07, 0.35, 1);
      context.shadowBlur = 10 + intensity * 18; context.shadowColor = colour;
      context.beginPath(); context.arc(point.x, point.y, radius, 0, NETWORK_TAU); context.fill();
      context.shadowBlur = 0; context.strokeStyle = colour; context.lineWidth = 1;
      context.globalAlpha = 0.48 + intensity * 0.4;
      for (let ring = 1; ring <= Math.max(0, Math.floor(point.node.rings || 0)); ring += 1) {
        context.beginPath(); context.arc(point.x, point.y, radius + 3 + ring * 3.5 + intensity * 3, 0, NETWORK_TAU); context.stroke();
      }
    }

    context.globalAlpha = 0.7; context.fillStyle = muted;
    context.font = `11px ${css(['--font-mono'], 'ui-monospace, monospace')}`;
    const centre = [0, 0, 0];
    for (let axis = 0; axis < 3; axis += 1) {
      const end = centre.slice(); end[axis] = 0.62;
      const p = project(end, width, height);
      context.fillText(opts.axes[axis], p.x + 4, p.y - 4);
    }
    context.globalAlpha = 1;
  }

  const gap = () => { const [a, b] = [...pointers.values()]; return Math.hypot(a[0] - b[0], a[1] - b[1]); };
  const down = (event) => {
    pointers.set(event.pointerId, [event.clientX, event.clientY]);
    try { canvas.setPointerCapture(event.pointerId); } catch { /* pointer already gone */ }
    canvas.style.cursor = 'grabbing';
    if (pointers.size === 2) spread = gap();
  };
  const move = (event) => {
    const last = pointers.get(event.pointerId);
    if (!last) return;
    pointers.set(event.pointerId, [event.clientX, event.clientY]);
    if (pointers.size === 1) {
      yaw += (event.clientX - last[0]) * 0.008;
      pitch = clamp(pitch + (event.clientY - last[1]) * 0.008, -1.3, 1.3);
    } else if (pointers.size === 2) {
      const now = gap();
      if (spread > 0) zoom = clamp(zoom * now / spread, 0.45, 2.4);
      spread = now;
    }
    draw();
  };
  const up = (event) => {
    pointers.delete(event.pointerId);
    if (!pointers.size) canvas.style.cursor = 'grab';
  };
  const wheel = (event) => {
    if (!opts.wheelZoom && !event.ctrlKey && !event.metaKey) return;
    event.preventDefault();
    zoom = clamp(zoom * Math.exp(-event.deltaY * 0.001), 0.45, 2.4);
    draw();
  };
  const key = (event) => {
    const turn = { ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] }[event.key];
    const scale = { '+': 1.08, '=': 1.08, '-': 0.93 }[event.key];
    if (!turn && !scale) return;
    event.preventDefault();
    if (turn) { yaw += turn[0]; pitch = clamp(pitch + turn[1], -1.3, 1.3); }
    else zoom = clamp(zoom * scale, 0.45, 2.4);
    draw();
  };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', move);
  canvas.addEventListener('pointerup', up);
  canvas.addEventListener('pointercancel', up);
  canvas.addEventListener('wheel', wheel, { passive: false });
  canvas.addEventListener('keydown', key);

  const redraw = () => draw();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(redraw) : null;
  if (ro) ro.observe(host);
  const mo = typeof MutationObserver !== 'undefined' ? new MutationObserver(redraw) : null;
  if (mo) mo.observe(document.documentElement, { attributes: true, attributeFilter: ['class', 'data-theme', 'style'] });
  const scheme = window.matchMedia ? window.matchMedia('(prefers-color-scheme: dark)') : null;
  if (scheme) scheme.addEventListener('change', redraw);

  prepare(); draw();
  return {
    update(next) { opts = { ...opts, ...next }; prepare(); draw(); },
    resetView() { ({ yaw, pitch, zoom } = VIEW); draw(); },
    destroy() {
      if (ro) ro.disconnect();
      if (mo) mo.disconnect();
      if (scheme) scheme.removeEventListener('change', redraw);
      canvas.remove();
    },
  };
}
