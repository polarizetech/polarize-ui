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
  let time = 0, shown = 0, norm = [], normalizers = [];
  const pointers = new Map(); // pointerId -> [x, y]; one turns, two zoom
  let spread = 0, downAt = null, hits = [];
  const cameraChanged = () => o.onCameraChange?.({ yaw, pitch, zoom });

  const css = (names, fallback) => {
    const style = getComputedStyle(host);
    for (const name of names) {
      const v = style.getPropertyValue(name).trim();
      if (v) return v;
    }
    return fallback;
  };

  function prepare() {
    normalizers = [];
    norm = o.paths.map((p) => {
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      for (const q of p.points) for (let k = 0; k < 3; k++) { lo[k] = Math.min(lo[k], q[k]); hi[k] = Math.max(hi[k], q[k]); }
      if (o.bounds && [...o.bounds.min, ...o.bounds.max].every(Number.isFinite)) {
        for (let k = 0; k < 3; k++) { lo[k] = o.bounds.min[k]; hi[k] = o.bounds.max[k]; }
      }
      const span = Math.max(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) || 1;
      const normalize = q => [0, 1, 2].map(k => (q[k] - (lo[k] + hi[k]) / 2) / span);
      normalizers.push(normalize);
      return p.points.map(normalize);
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

    if (o.grid) {
      g.strokeStyle = muted; g.globalAlpha = 0.16; g.lineWidth = 1;
      for (let j = -5; j <= 5; j++) for (const axis of [0, 2]) {
        const a = [0, 0, 0], b = [0, 0, 0];
        a[axis] = b[axis] = j / 10; a[2-axis] = -.5; b[2-axis] = .5;
        const A = project(a, w, h), B = project(b, w, h);
        g.beginPath(); g.moveTo(...A); g.lineTo(...B); g.stroke();
      }
    }
    // All annotations share path bounds; screen positions are rebuilt on every camera move.
    const normalize = normalizers[shown];
    hits = [];
    const occupied = [];
    const label = (text, P, color) => {
      if (!text) return;
      const width = g.measureText(text).width, x = clamp(P[0]+6,4,Math.max(4,w-width-4));
      for (const dy of [-8,8,23,-23]) {
        const y=clamp(P[1]+dy,14,h-8), box=[x,y-12,width,14];
        if (occupied.some(b => box[0]<b[0]+b[2] && box[0]+box[2]>b[0] && box[1]<b[1]+b[3] && box[1]+box[3]>b[1])) continue;
        occupied.push(box);g.fillStyle=color;g.fillText(text,x,y);return;
      }
    };
    if (normalize) {
      const faceDepth = face => {
        const q=face.points.map(normalize).reduce((a,v)=>a.map((x,k)=>x+v[k]/face.points.length),[0,0,0]);
        return (-q[0]*Math.sin(yaw)-q[2]*Math.cos(yaw))*Math.cos(pitch)-q[1]*Math.sin(pitch);
      };
      for (const face of [...(o.faces || [])].sort((a,b)=>faceDepth(b)-faceDepth(a))) {
        const P=face.points.map(q=>project(normalize(q),w,h));if(P.length<3)continue;
        g.globalAlpha=face.opacity??.12;g.fillStyle=face.color||mark;g.beginPath();g.moveTo(...P[0]);P.slice(1).forEach(q=>g.lineTo(...q));g.closePath();g.fill();
        hits.push({type:'face',points:P,item:face});
        g.globalAlpha=.9;label(face.label,P.reduce((a,v)=>a.map((x,k)=>x+v[k]/P.length),[0,0]),face.color||mark);
      }
      for (const segment of o.segments || []) {
        const A = project(normalize(segment.from), w, h), B = project(normalize(segment.to), w, h);
        g.globalAlpha = segment.opacity??.65; g.strokeStyle = segment.color || mark; g.lineWidth = 1.4;
        g.beginPath(); g.moveTo(...A); g.lineTo(...B);
        if(segment.arrow){const t=Math.atan2(B[1]-A[1],B[0]-A[0]);g.moveTo(B[0]-7*Math.cos(t-.4),B[1]-7*Math.sin(t-.4));g.lineTo(...B);g.lineTo(B[0]-7*Math.cos(t+.4),B[1]-7*Math.sin(t+.4));}
        g.stroke();label(segment.label,B,segment.color||mark);hits.push({type:'edge',points:[A,B],item:segment});
      }
      for (const marker of o.markers || []) {
        const P = project(normalize(marker.point), w, h);
        g.globalAlpha = marker.opacity??1; g.fillStyle = marker.color || ink;
        if(marker.visible!==false){g.beginPath();g.arc(...P,4,0,2*Math.PI);g.fill();hits.push({type:'point',points:[P],item:marker});}
        label(marker.label,P,marker.color||ink);
      }
    }
    // Reference vectors live in the normalized display frame, never data units.
    for (const ref of o.referenceVectors || []) {
      const length = Math.hypot(...ref.vector);
      if (!Number.isFinite(length) || !length) continue;
      const A = project([0, 0, 0], w, h), B = project(ref.vector.map(v => .5*v/length), w, h);
      const angle = Math.atan2(B[1]-A[1], B[0]-A[0]);
      g.globalAlpha = .85; g.strokeStyle = mark; g.fillStyle = mark; g.lineWidth = 1.6;
      g.beginPath(); g.moveTo(...A); g.lineTo(...B);
      g.moveTo(B[0]-7*Math.cos(angle-.4), B[1]-7*Math.sin(angle-.4)); g.lineTo(...B);
      g.lineTo(B[0]-7*Math.cos(angle+.4), B[1]-7*Math.sin(angle+.4)); g.stroke();
      const label = ref.label || '';
      g.fillText(label, clamp(B[0]+6, 4, Math.max(4,w-g.measureText(label).width-4)), clamp(B[1]+13, 13, h-20));
    }
    if (o.referenceNote) {
      g.globalAlpha = .8; g.fillStyle = muted;
      g.fillText(o.referenceNote, 8, h-8, Math.max(10,w-16));
    }
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
    if (o.showPath === false || !pts || pts.length < 2) return;

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
    downAt=[e.clientX,e.clientY];
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
    draw();cameraChanged();
  };
  const up = (e) => {
    if(e.type!=='pointercancel' && downAt && Math.hypot(e.clientX-downAt[0],e.clientY-downAt[1])<4 && o.onSelect){
      const rect=canvas.getBoundingClientRect(),p=[e.clientX-rect.left,e.clientY-rect.top];
      const inside=poly=>{let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){const a=poly[i],b=poly[j];if((a[1]>p[1])!==(b[1]>p[1]) && p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;}return yes;};
      const distance=(a,b)=>{const dx=b[0]-a[0],dy=b[1]-a[1],t=clamp(((p[0]-a[0])*dx+(p[1]-a[1])*dy)/(dx*dx+dy*dy||1),0,1);return Math.hypot(p[0]-a[0]-t*dx,p[1]-a[1]-t*dy);};
      const hit=[...hits].reverse().find(h=>h.type==='point'?distance(h.points[0],h.points[0])<9:h.type==='edge'?distance(...h.points)<6:inside(h.points));
      if(hit)o.onSelect(hit.item);
    }
    downAt=null;pointers.delete(e.pointerId);
    if (!pointers.size) canvas.style.cursor = 'grab';
  };
  // A trackpad pinch arrives as a wheel event with ctrlKey set; a plain scroll is left to the page.
  const wheel = (e) => {
    if (!e.ctrlKey && !e.metaKey) return;
    e.preventDefault();
    zoom = clamp(zoom * (e.deltaY > 0 ? 0.93 : 1.08), 0.4, 3);
    draw();cameraChanged();
  };
  const key = (e) => {
    const turn = { ArrowLeft: [0.1, 0], ArrowRight: [-0.1, 0], ArrowUp: [0, -0.1], ArrowDown: [0, 0.1] }[e.key];
    const scale = { '+': 1.08, '=': 1.08, '-': 0.93 }[e.key];
    if (!turn && !scale) return;
    e.preventDefault();
    if (turn) { yaw += turn[0]; pitch = clamp(pitch + turn[1], -1.5, 1.5); }
    else zoom = clamp(zoom * scale, 0.4, 3);
    draw();cameraChanged();
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
    getCamera() { return {yaw,pitch,zoom}; },
    setCamera(camera) { if(Number.isFinite(camera.yaw))yaw=camera.yaw;if(Number.isFinite(camera.pitch))pitch=clamp(camera.pitch,-1.5,1.5);if(Number.isFinite(camera.zoom))zoom=clamp(camera.zoom,.4,3);draw(); },
    resetView() { ({ yaw, pitch, zoom } = VIEW); draw();cameraChanged(); },
    destroy() {
      if (ro) ro.disconnect();
      if (mo) mo.disconnect();
      if (scheme) scheme.removeEventListener('change', redraw);
      canvas.remove();
    },
  };
}


/** Phase/amplitude dials for complex samples, uniformly spaced over duration.
 * Fixed common radial scale over the whole record; interpolation is in Re/Im.
 * These are phasors, not mechanical pendulum angles. No dynamics are simulated.
 */
export function mountOscillatorBank(host, opts = {}) {
  const root = document.createElement('div');
  root.style.cssText = 'display:grid;grid-template-columns:repeat(auto-fit,minmax(108px,1fr));gap:12px';
  host.append(root);
  let o = { samples: [], duration: 1, ...opts }, time = 0, entries = [], max = 1;
  const svgEl = (name, attrs) => {
    const e = document.createElementNS('http://www.w3.org/2000/svg', name);
    for (const [key,value] of Object.entries(attrs)) e.setAttribute(key,String(value));
    return e;
  };
  function prepare() {
    root.replaceChildren(); entries = []; max = 0;
    for (const row of o.samples) for (const z of row) max = Math.max(max, Math.hypot(...z));
    max ||= 1;
    for (let k = 0; k < (o.samples[0]?.length || 0); k++) {
      const cell = document.createElement('div'), title = document.createElement('strong');
      title.textContent = o.labels?.[k] || `z${k+1}`;
      cell.style.cssText = 'text-align:center;font-variant-numeric:tabular-nums;min-width:0';
      const svg = svgEl('svg',{viewBox:'0 0 100 100',role:'img',width:'100%'});
      svg.style.cssText = 'display:block;max-width:130px;margin:auto;color:var(--muted-foreground)';
      svg.append(svgEl('circle',{cx:50,cy:50,r:38,fill:'none',stroke:'currentColor','stroke-opacity':.4}));
      svg.append(svgEl('path',{d:'M12 50H88 M50 12V88',stroke:'currentColor','stroke-opacity':.25,fill:'none'}));
      const hand = svgEl('line',{x1:50,y1:50,x2:50,y2:50,stroke:'var(--series-1, var(--chart-1, #3b6fd6))','stroke-width':2});
      const tip = svgEl('circle',{cx:50,cy:50,r:3,fill:'var(--series-4, var(--chart-4, #d6763b))'});
      svg.append(hand,tip);
      const value = document.createElement('div'); value.style.cssText = 'font-size:11px;font-family:var(--font-mono,monospace);white-space:pre-line';
      cell.append(title,svg,value); root.append(cell); entries.push({svg,hand,tip,value,title});
    }
  }
  function draw() {
    const n=o.samples.length; if(!n) return;
    const at=clamp(time/Math.max(o.duration,Number.EPSILON)*(n-1),0,n-1), i=Math.floor(at), f=at-i;
    entries.forEach(({svg,hand,tip,value,title},k)=>{
      const a=o.samples[i][k],b=o.samples[Math.min(i+1,n-1)][k];
      const re=a[0]+f*(b[0]-a[0]), im=a[1]+f*(b[1]-a[1]);
      const amp=Math.hypot(re,im), phase=amp>1e-12 ? (Math.atan2(im,re)*180/Math.PI).toFixed(1)+'°' : 'undefined';
      const x=50+38*re/max,y=50-38*im/max;
      hand.setAttribute('x2',x); hand.setAttribute('y2',y); tip.setAttribute('cx',x); tip.setAttribute('cy',y);
      value.textContent=`|z| ${amp.toPrecision(3)}\nφ ${phase}`;
      svg.setAttribute('aria-label',`${title.textContent}: real ${re.toPrecision(4)}, imaginary ${im.toPrecision(4)}, amplitude ${amp.toPrecision(4)}, phase ${phase}`);
    });
  }
  prepare(); draw();
  return {
    setTime(seconds) { time=seconds;draw(); },
    update(next) { o={...o,...next};prepare();draw(); },
    destroy() { root.remove(); },
  };
}
