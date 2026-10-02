// The renderer: a density-weighted activation field drawn as a volume, optionally with the cells,
// the synapses and the pulses on them drawn over it. three.js is a PEER dependency: the host page
// provides it through an import map, so this tool carries no copy.
//
// What is drawn, and what it means (the page prints the same words):
//   colour   the value being shown (activation, stimulus-driven share, or tissue density), read from
//            a polarize-ui ramp. Colour is the only thing that carries the value.
//   opacity  follows tissue density and, within it, the activation, so quiet tissue fades instead of
//            standing as an opaque blob. Opacity carries no value of its own.
//   cells    dots at the supplied positions, coloured by their own activation. Shape, not colour,
//            separates excitatory (disc) from inhibitory (diamond).
//   pulses   one dot per supplied transmission, travelling its synapse for its declared delay.
//            Never invented: no transmissions in the data, no pulses.
import * as THREE from 'three'
import { makeGrid, Splatter } from './grid.mjs'
import { rampBytes } from './ramp.mjs'
import { makeOrbit, orbitPosition, drag, zoom } from './orbit.mjs'

const VERT = /* glsl */ `
out vec3 vLocal;
void main() {
  vLocal = position + 0.5;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`

const FRAG = /* glsl */ `
precision highp float;
precision highp sampler3D;
in vec3 vLocal;
out vec4 outColor;
uniform sampler3D uVol;
uniform sampler2D uRamp;
uniform vec3 uCam;      // camera in the box's 0..1 coordinates
uniform vec3 uSize;     // box size in world units
uniform int uMode;      // 0 activation, 1 stimulus-driven share, 2 tissue density, 3 static cell map
uniform int uMip;       // 1 = maximum intensity along the ray
uniform float uOpacity;
uniform float uFloor;
uniform int uSteps;
uniform float uCut;     // values below this fraction of the domain are not drawn

float pick(vec4 s) { return uMode == 1 ? s.b : (uMode == 2 ? s.g : s.r); }

void main() {
  vec3 dir = normalize(vLocal - uCam);
  vec3 inv = 1.0 / dir;
  vec3 t0 = (vec3(0.0) - uCam) * inv, t1 = (vec3(1.0) - uCam) * inv;
  vec3 tmin = min(t0, t1), tmax = max(t0, t1);
  float tn = max(max(tmin.x, tmin.y), max(tmin.z, 0.0));
  float tf = min(min(tmax.x, tmax.y), tmax.z);
  if (tf <= tn) discard;
  float dt = (tf - tn) / float(uSteps);
  float worldStep = length(dir * uSize) * dt;
  vec4 acc = vec4(0.0);
  float best = -1.0, bestDens = 0.0;
  for (int i = 0; i < 512; i++) {
    if (i >= uSteps || acc.a > 0.97) break;
    vec3 p = uCam + dir * (tn + (float(i) + 0.5) * dt);
    vec4 s = texture(uVol, p);
    float v = pick(s);
    float gate = smoothstep(0.02, 0.30, s.g);
    if (uMip == 1) {
      float m = v * gate;
      if (m > best) { best = m; bestDens = gate; }
      continue;
    }
    if (v < uCut && uMode < 2) continue;
    float a = 1.0 - exp(-uOpacity * gate * mix(uFloor, 1.0, v) * worldStep);
    vec3 c = texture(uRamp, vec2(clamp(v, 0.0, 1.0), 0.5)).rgb;
    acc.rgb += (1.0 - acc.a) * a * c;
    acc.a += (1.0 - acc.a) * a;
  }
  if (uMip == 1) {
    if (best < 0.0 || best < uCut) discard;
    vec3 c = texture(uRamp, vec2(clamp(best / max(bestDens, 1e-3), 0.0, 1.0), 0.5)).rgb;
    outColor = vec4(c * bestDens, bestDens);
    return;
  }
  outColor = acc;
}`

const POINT_VERT = /* glsl */ `
attribute float aAct;
attribute float aKind;
attribute float aSel;
uniform float uPx;
uniform float uSizeScale;
out float vAct; out float vKind; out float vSel;
void main() {
  vAct = aAct; vKind = aKind; vSel = aSel;
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(uSizeScale * uPx / -mv.z, 2.0, 18.0) * (1.0 + aSel);
}`

const POINT_FRAG = /* glsl */ `
precision highp float;
uniform sampler2D uRamp;
uniform float uAlpha;
uniform vec3 uInk;
in float vAct; in float vKind; in float vSel;
out vec4 outColor;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float d = vKind > 0.5 ? abs(q.x) + abs(q.y) : length(q);   // diamond for inhibitory
  if (d > 1.0) discard;
  vec3 c = texture(uRamp, vec2(clamp(vAct, 0.0, 1.0), 0.5)).rgb;
  float edge = smoothstep(0.72, 1.0, d);
  c = mix(c, uInk, max(edge * 0.9, vSel));
  outColor = vec4(c, uAlpha);
}`

const PULSE_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uPulse;
uniform float uAlpha;
out vec4 outColor;
void main() {
  vec2 q = gl_PointCoord * 2.0 - 1.0;
  float d = length(q);
  if (d > 1.0) discard;
  outColor = vec4(uPulse, uAlpha * (1.0 - 0.5 * d));
}`

const SYN_VERT = /* glsl */ `
attribute float aSign;
out float vSign;
void main() { vSign = aSign; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`
const SYN_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uExc; uniform vec3 uInh; uniform float uAlpha;
in float vSign; out vec4 outColor;
void main() { outColor = vec4(vSign < 0.0 ? uInh : uExc, uAlpha); }`

/** Data coordinates -> view coordinates. up:'z' maps (x, y, z) to (x, z, -y), so z is up on screen and anterior (+y) points away. */
function toView(arr, up) {
  if (up !== 'z') return arr
  const out = new Float32Array(arr.length)
  for (let i = 0; i < arr.length; i += 3) { out[i] = arr[i]; out[i + 1] = arr[i + 2]; out[i + 2] = -arr[i + 1] }
  return out
}

const CTX_VERT = /* glsl */ `
attribute float aRegion;
out vec3 vN; out float vReg;
void main() {
  vN = normalize(normalMatrix * normal); vReg = aRegion;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`
const CTX_FRAG = /* glsl */ `
precision highp float;
uniform vec3 uInk; uniform float uAlpha; uniform float uRegions; uniform vec3 uPal[8];
in vec3 vN; in float vReg; out vec4 outColor;
void main() {
  float l = max(dot(normalize(vN), normalize(vec3(0.3, 0.5, 0.8))), 0.0);
  vec3 c = uInk;
  if (uRegions > 0.5) c = mix(uInk, uPal[int(vReg + 0.5)], 0.9);
  outColor = vec4(c * (0.65 + 0.35 * l), uAlpha * (0.5 + 0.5 * l));
}`

export class TissueVolume {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {ReturnType<import('./format.mjs').validateField>} field
   * @param {{target?: number, sigmaVox?: number, maxSynapses?: number, maxPulses?: number, ramp: {stops:number[][]}, ink?: number[], pulse?: number[], exc?: number[], inh?: number[]}} o
   */
  constructor(canvas, field, o) {
    this.field = field
    this.canvas = canvas
    this.opt = { target: 64, sigmaVox: 1.6, maxSynapses: 4000, maxPulses: 6000, ...o }
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, preserveDrawingBuffer: true })
    this.renderer.setClearColor(0x000000, 0)
    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(35, 1, 0.01, 100)
    this.up = field.meta.up || 'y'
    this.cp = toView(field.cells.pos, this.up)       // cell positions in view coordinates
    this.state = { context: true, outline: false, regions: false, mode: 0, mip: false, opacity: 6, floor: 0.25, cut: 0.02, cells: false, synapses: false, pulses: true, steps: 192, pulseWindowMs: 0 }
    this.frameIndex = 0
    this._buildVolume()
    this._buildOverlays()
    this._buildContext()
    this.setRamp(this.opt.ramp)
    this.fit()
    this.setFrame(0)
  }

  /* ------------------------------------------------------------------ build */

  _buildVolume() {
    const { cells } = this.field, N = cells.n
    this.grid = makeGrid(this.cp, N, { target: this.opt.target, sigmaVox: this.opt.sigmaVox })
    this.splat = new Splatter(this.grid, this.cp, N)
    this.mapNorm = null
    if (cells.map) {
      const mp = cells.map, [lo, hi] = mp.domain, f = mp.log ? Math.log : (x) => x
      this.mapNorm = new Float32Array(N)
      for (let i = 0; i < N; i++) this.mapNorm[i] = Math.min(1, Math.max(0, (f(mp.values[i]) - f(lo)) / (f(hi) - f(lo))))
      this.splat.frame(this.mapNorm, [0, 1])
      this.bytesMap = this.splat.pack(new Uint8Array(4 * this.grid.count), false)
    }
    const { dims, size } = this.grid
    this.bytes = new Uint8Array(4 * this.grid.count)
    this.tex = new THREE.Data3DTexture(this.bytes, dims[0], dims[1], dims[2])
    this.tex.format = THREE.RGBAFormat
    this.tex.type = THREE.UnsignedByteType
    this.tex.minFilter = this.tex.magFilter = THREE.LinearFilter
    this.tex.wrapS = this.tex.wrapT = this.tex.wrapR = THREE.ClampToEdgeWrapping
    this.tex.unpackAlignment = 1
    this.tex.needsUpdate = true
    if (this.bytesMap) {
      this.texMap = new THREE.Data3DTexture(this.bytesMap, dims[0], dims[1], dims[2])
      this.texMap.format = THREE.RGBAFormat; this.texMap.type = THREE.UnsignedByteType
      this.texMap.minFilter = this.texMap.magFilter = THREE.LinearFilter
      this.texMap.wrapS = this.texMap.wrapT = this.texMap.wrapR = THREE.ClampToEdgeWrapping
      this.texMap.unpackAlignment = 1; this.texMap.needsUpdate = true
    }
    // world units: longest side = 2 so the camera maths does not depend on the data's units
    this.worldScale = 2 / Math.max(...size)
    this.worldSize = size.map((s) => s * this.worldScale)
    this.rampTex = new THREE.DataTexture(new Uint8Array(256 * 4), 256, 1, THREE.RGBAFormat)
    this.rampTex.minFilter = this.rampTex.magFilter = THREE.LinearFilter
    this.uniforms = {
      uVol: { value: this.tex }, uRamp: { value: this.rampTex },
      uCam: { value: new THREE.Vector3() }, uSize: { value: new THREE.Vector3(...this.worldSize) },
      uMode: { value: 0 }, uMip: { value: 0 }, uOpacity: { value: 6 }, uFloor: { value: 0.25 }, uSteps: { value: 192 }, uCut: { value: 0.02 },
    }
    const mat = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: VERT, fragmentShader: FRAG, uniforms: this.uniforms,
      side: THREE.BackSide, transparent: true, depthWrite: false, premultipliedAlpha: true,
      blending: THREE.CustomBlending, blendSrc: THREE.OneFactor, blendDst: THREE.OneMinusSrcAlphaFactor,
    })
    this.box = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), mat)
    this.box.scale.set(...this.worldSize)
    this.box.renderOrder = 1
    this.scene.add(this.box)
    this.world = new THREE.Group()           // cells, synapses and pulses live in the same box-centred frame
    this.scene.add(this.world)
  }

  /** A data-space position as a box-centred world position. */
  _w(x, y, z) {
    const { origin, size } = this.grid
    return [((x - origin[0]) / size[0] - 0.5) * this.worldSize[0], ((y - origin[1]) / size[1] - 0.5) * this.worldSize[1], ((z - origin[2]) / size[2] - 0.5) * this.worldSize[2]]
  }

  _buildOverlays() {
    const { cells, synapses, transmissions } = this.field, N = cells.n
    const px = new Float32Array(3 * N)
    for (let i = 0; i < N; i++) px.set(this._w(this.cp[3 * i], this.cp[3 * i + 1], this.cp[3 * i + 2]), 3 * i)
    this.cellWorld = px
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(px, 3))
    this.aAct = new Float32Array(N); this.aSel = new Float32Array(N)
    g.setAttribute('aAct', new THREE.BufferAttribute(this.aAct, 1))
    g.setAttribute('aKind', new THREE.BufferAttribute(Float32Array.from(cells.kind), 1))
    g.setAttribute('aSel', new THREE.BufferAttribute(this.aSel, 1))
    this.cellUniforms = { uRamp: { value: this.rampTex }, uPx: { value: 1 }, uSizeScale: { value: 3.2 }, uAlpha: { value: 0.7 }, uInk: { value: new THREE.Vector3(...(this.opt.ink || [0.1, 0.1, 0.1])) } }
    this.cellPoints = new THREE.Points(g, new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3, vertexShader: POINT_VERT, fragmentShader: POINT_FRAG, uniforms: this.cellUniforms, transparent: true, depthWrite: false,
    }))
    this.cellPoints.renderOrder = 3
    this.cellPoints.frustumCulled = false
    this.world.add(this.cellPoints)

    this.synapseDrawn = 0
    if (synapses) {
      const S = synapses.n, take = Math.min(S, this.opt.maxSynapses), stride = S / take
      const pos = new Float32Array(take * 6), sign = new Float32Array(take * 2)
      for (let k = 0; k < take; k++) {
        const e = Math.floor(k * stride), a = synapses.pre[e], b = synapses.post[e]
        pos.set(this._w(this.cp[3 * a], this.cp[3 * a + 1], this.cp[3 * a + 2]), 6 * k)
        pos.set(this._w(this.cp[3 * b], this.cp[3 * b + 1], this.cp[3 * b + 2]), 6 * k + 3)
        sign[2 * k] = sign[2 * k + 1] = synapses.weight[e] < 0 ? -1 : 1
      }
      this.synapseDrawn = take
      const sg = new THREE.BufferGeometry()
      sg.setAttribute('position', new THREE.BufferAttribute(pos, 3))
      sg.setAttribute('aSign', new THREE.BufferAttribute(sign, 1))
      this.synUniforms = { uExc: { value: new THREE.Vector3(...(this.opt.exc || [0.5, 0.5, 0.5])) }, uInh: { value: new THREE.Vector3(...(this.opt.inh || [0.7, 0.3, 0.3])) }, uAlpha: { value: 0.12 } }
      this.synLines = new THREE.LineSegments(sg, new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3, vertexShader: SYN_VERT, fragmentShader: SYN_FRAG, uniforms: this.synUniforms, transparent: true, depthWrite: false,
      }))
      this.synLines.renderOrder = 2
      this.synLines.frustumCulled = false
      this.world.add(this.synLines)
    }

    this.pulseDrawn = 0; this.pulseActive = 0
    if (transmissions && synapses) {
      this.pulsePos = new Float32Array(3 * this.opt.maxPulses)
      const pg = new THREE.BufferGeometry()
      pg.setAttribute('position', new THREE.BufferAttribute(this.pulsePos, 3))
      pg.setAttribute('aAct', new THREE.BufferAttribute(new Float32Array(this.opt.maxPulses), 1))
      pg.setAttribute('aKind', new THREE.BufferAttribute(new Float32Array(this.opt.maxPulses), 1))
      pg.setAttribute('aSel', new THREE.BufferAttribute(new Float32Array(this.opt.maxPulses), 1))
      this.pulseUniforms = { uPx: this.cellUniforms.uPx, uSizeScale: { value: 4 }, uPulse: { value: new THREE.Vector3(...(this.opt.pulse || [1, 0.8, 0.2])) }, uAlpha: { value: 0.95 } }
      this.pulsePoints = new THREE.Points(pg, new THREE.ShaderMaterial({
        glslVersion: THREE.GLSL3, vertexShader: POINT_VERT, fragmentShader: PULSE_FRAG, uniforms: this.pulseUniforms, transparent: true, depthWrite: false,
      }))
      this.pulsePoints.renderOrder = 4
      this.pulsePoints.frustumCulled = false
      this.world.add(this.pulsePoints)
    }
    this.cellPoints.visible = false
    if (this.synLines) this.synLines.visible = false
  }

  _buildContext() {
    this.ctx = []
    const pal = new Array(8).fill(0).map((_, i) => new THREE.Vector3(...((this.opt.regionColors || [])[i % Math.max(1, (this.opt.regionColors || []).length)] || [0.5, 0.5, 0.5])))
    for (const ms of this.field.context || []) {
      const vpos = toView(ms.pos, this.up), nv = vpos.length / 3, wp = new Float32Array(vpos.length)
      for (let i = 0; i < nv; i++) wp.set(this._w(vpos[3 * i], vpos[3 * i + 1], vpos[3 * i + 2]), 3 * i)
      const g = new THREE.BufferGeometry()
      g.setAttribute('position', new THREE.BufferAttribute(wp, 3))
      g.setIndex(new THREE.BufferAttribute(Uint32Array.from(ms.tri), 1))
      g.setAttribute('aRegion', new THREE.BufferAttribute(Float32Array.from(ms.region || new Uint16Array(nv)), 1))
      g.computeVertexNormals()
      const uni = { uInk: { value: new THREE.Vector3(...(this.opt.ink || [0.5, 0.5, 0.5])) }, uAlpha: { value: ms.role === 'outline' ? 0.07 : 0.3 }, uRegions: { value: 0 }, uPal: { value: pal } }
      const mesh = new THREE.Mesh(g, new THREE.ShaderMaterial({ glslVersion: THREE.GLSL3, vertexShader: CTX_VERT, fragmentShader: CTX_FRAG, uniforms: uni, transparent: true, depthWrite: false, side: THREE.DoubleSide }))
      mesh.renderOrder = 0; mesh.frustumCulled = false; mesh.visible = ms.role === 'outline' ? false : true
      this.scene.add(mesh); this.ctx.push({ role: ms.role, mesh, uni, name: ms.name })
    }
  }

  /* ------------------------------------------------------------------ state */

  setRamp(ramp) {
    this.ramp = ramp
    this.rampTex.image.data.set(rampBytes(ramp.stops))
    this.rampTex.needsUpdate = true
  }

  set(opts) {
    Object.assign(this.state, opts)
    const s = this.state, u = this.uniforms
    u.uMode.value = { activation: 0, driven: 1, density: 2, map: 3 }[s.colorBy ?? 'activation'] ?? 0
    u.uVol.value = (u.uMode.value === 3 && this.texMap) ? this.texMap : this.tex
    for (const c of this.ctx) {
      c.mesh.visible = c.role === 'outline' ? !!s.outline : !!s.context
      c.uni.uRegions.value = s.regions ? 1 : 0
    }
    u.uMip.value = s.mip ? 1 : 0
    u.uOpacity.value = s.opacity; u.uFloor.value = s.floor; u.uSteps.value = s.steps; u.uCut.value = s.cut
    this.cellPoints.visible = !!s.cells
    if (this.synLines) this.synLines.visible = !!s.synapses
    if (this.pulsePoints) this.pulsePoints.visible = !!s.pulses
    this.setFrame(this.frameIndex)
  }

  /** The domain-normalised value a cell is drawn at (same clamping as the field). */
  cellValue(i, k = this.frameIndex) {
    if (this.mapNorm && this.uniforms.uMode.value === 3) return this.mapNorm[i]
    const [lo, hi] = this.field.meta.domain
    const a = this.field.frames.activation[k * this.field.cells.n + i]
    return Math.min(1, Math.max(0, (a - lo) / (hi - lo)))
  }

  setFrame(k) {
    const { frames, cells, synapses, transmissions } = this.field, N = cells.n
    k = Math.min(frames.n - 1, Math.max(0, Math.round(k)))
    this.frameIndex = k
    const act = frames.activation.subarray(k * N, (k + 1) * N)
    const src = frames.source ? frames.source.subarray(k * N, (k + 1) * N) : null
    if (this.uniforms.uMode.value !== 3) {           // the static map does not change with time
      this.splat.frame(act, this.field.meta.domain, src)
      this.splat.pack(this.bytes, !!src)
      this.tex.needsUpdate = true
    }
    if (this.state.cells) {
      for (let i = 0; i < N; i++) this.aAct[i] = this.cellValue(i, k)
      this.cellPoints.geometry.attributes.aAct.needsUpdate = true
    }
    if (this.pulsePoints && this.state.pulses) this._pulses(k * frames.dt_ms)
  }

  _pulses(tMs) {
    const { transmissions: T, synapses: S, cells } = this.field
    // transmissions are sorted by t_ms; the longest delay bounds how far back to look
    if (this._maxDelay === undefined) this._maxDelay = S.delay_ms.reduce((m, v) => (v > m ? v : m), 0)
    let lo = 0, hi = T.n
    const from = tMs - this._maxDelay
    while (lo < hi) { const m = (lo + hi) >> 1; if (T.t_ms[m] < from) lo = m + 1; else hi = m }
    const out = this.pulsePos, cap = this.opt.maxPulses
    let active = 0, drawn = 0
    for (let j = lo; j < T.n && T.t_ms[j] <= tMs; j++) {
      const e = T.syn[j], f = (tMs - T.t_ms[j]) / S.delay_ms[e]
      if (f < 0 || f > 1) continue
      active++
      if (drawn >= cap) continue
      const a = S.pre[e], b = S.post[e]
      const cp = this.cp
      const x = cp[3 * a] + (cp[3 * b] - cp[3 * a]) * f
      const y = cp[3 * a + 1] + (cp[3 * b + 1] - cp[3 * a + 1]) * f
      const z = cp[3 * a + 2] + (cp[3 * b + 2] - cp[3 * a + 2]) * f
      out.set(this._w(x, y, z), 3 * drawn)
      drawn++
    }
    this.pulseActive = active; this.pulseDrawn = drawn
    this.pulsePoints.geometry.setDrawRange(0, drawn)
    this.pulsePoints.geometry.attributes.position.needsUpdate = true
  }

  /** Counts the page must print: what exists versus what is drawn. */
  disclosure() {
    const { synapses } = this.field
    return {
      voxels: this.grid.dims, voxel: this.grid.voxel, sigmaVox: this.grid.sigmaVox,
      synapses: { total: synapses ? synapses.n : 0, drawn: this.synapseDrawn },
      pulses: { active: this.pulseActive, drawn: this.pulseDrawn },
    }
  }

  /* ------------------------------------------------------------------ camera */

  fit() {
    const v = this.field.meta.view || {}
    this.orbit = makeOrbit({ theta: v.theta ?? 0.9, phi: v.phi ?? 1.15, dist: v.dist ?? 3.0 })
  }
  dragBy(dx, dy) { drag(this.orbit, dx, dy) }
  zoomBy(dy) { zoom(this.orbit, dy) }

  resize(w, h, dpr = Math.min(2, globalThis.devicePixelRatio || 1)) {
    this.renderer.setPixelRatio(dpr)
    this.renderer.setSize(w, h, false)
    this.camera.aspect = w / h
    this.camera.updateProjectionMatrix()
    this.cellUniforms.uPx.value = h * dpr * 0.5
    this._w_px = w; this._h_px = h
  }

  render() {
    const p = orbitPosition(this.orbit)
    this.camera.position.set(...p)
    this.camera.lookAt(0, 0, 0)
    this.camera.updateMatrixWorld()
    // camera in the box's own 0..1 coordinates
    this.uniforms.uCam.value.set(p[0] / this.worldSize[0] + 0.5, p[1] / this.worldSize[1] + 0.5, p[2] / this.worldSize[2] + 0.5)
    this.renderer.render(this.scene, this.camera)
  }

  /**
   * Where the data axes and a length scale land on screen, for the orientation widget. Each axis is the
   * foreshortened screen direction of +1 unit of data (so an axis pointing at the camera is drawn short),
   * and `bar` is how many CSS pixels `mm` data units span at the centre of the volume.
   */
  annotate(mm = 10) {
    const U = toView(new Float32Array([1, 0, 0, 0, 1, 0, 0, 0, 1]), this.up), g = this.grid
    const o = this._w(g.origin[0], g.origin[1], g.origin[2])
    const sx = (v) => (v.x * 0.5 + 0.5) * this._w_px, sy = (v) => (-v.y * 0.5 + 0.5) * this._h_px
    const c = new THREE.Vector3(0, 0, 0).project(this.camera)
    const axes = [0, 1, 2].map((k) => {
      const e = this._w(g.origin[0] + U[3 * k], g.origin[1] + U[3 * k + 1], g.origin[2] + U[3 * k + 2])
      const p = new THREE.Vector3(e[0] - o[0], e[1] - o[1], e[2] - o[2]).multiplyScalar(mm).project(this.camera)
      return { dx: sx(p) - sx(c), dy: sy(p) - sy(c) }
    })
    const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrixWorld, 0).multiplyScalar(mm * this.worldScale).project(this.camera)
    return { axes, barPx: Math.abs(sx(right) - sx(c)), mm }
  }

  /** The cell under a pointer (CSS px relative to the canvas), nearest in screen space; null if none within `radius`. */
  pickCell(px, py, radius = 10) {
    const N = this.field.cells.n, w = this._w_px, h = this._h_px, v = new THREE.Vector3()
    let best = -1, bd = radius * radius, bz = Infinity
    for (let i = 0; i < N; i++) {
      v.set(this.cellWorld[3 * i], this.cellWorld[3 * i + 1], this.cellWorld[3 * i + 2]).project(this.camera)
      if (v.z < -1 || v.z > 1) continue
      const dx = (v.x * 0.5 + 0.5) * w - px, dy = (-v.y * 0.5 + 0.5) * h - py, d = dx * dx + dy * dy
      if (d < bd || (d <= bd && v.z < bz)) { if (d < bd) bd = d; bz = v.z; best = i }
    }
    return best < 0 ? null : best
  }

  select(i) {
    this.aSel.fill(0)
    if (i != null) this.aSel[i] = 1
    this.cellPoints.geometry.attributes.aSel.needsUpdate = true
  }

  /** Rendered pixel at the canvas centre of a projected data point, read from the framebuffer (verification). */
  readPixel(x, y) {
    const gl = this.renderer.getContext(), c = this.canvas
    const out = new Uint8Array(4)
    gl.readPixels(Math.round(x * c.width / this._w_px), Math.round(c.height - y * c.height / this._h_px), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, out)
    return out
  }

  dispose() {
    this.tex.dispose(); this.rampTex.dispose(); this.renderer.dispose()
  }
}
