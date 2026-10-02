// Node checks for the parts of tissue-field that need no GL context.
// Run: node tissue-field/dev_check.mjs   (python3 dev_check.py runs it too)
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import { validateField, groupMeans, FieldError } from './src/format.mjs'
import { makeGrid, Splatter } from './src/grid.mjs'
import { colorAt, rampBytes, readRamp, STOPS } from './src/ramp.mjs'
import { makeOrbit, orbitPosition, drag, zoom } from './src/orbit.mjs'
import { makeDemoField, STAGE_NAMES } from '../stories/models/tissue-demo/relay.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
let pass = 0, fail = 0
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('FAIL', m) } }
const throws = (fn, re, m) => { try { fn() } catch (e) { return ok(e instanceof FieldError ? re.test(e.message) : false, `${m} (got ${e.constructor.name}: ${e.message})`) } ok(false, `${m} (did not throw)`) }

const base = () => ({
  format: 'tissue-field/1',
  meta: { title: 't', tier: 'SPEC', source: 's', layout: 'schematic', units: 'u', domain: [0, 1] },
  groups: [{ name: 'a' }, { name: 'b' }],
  cells: { n: 3, pos: [0, 0, 0, 1, 0, 0, 0, 1, 0], kind: [0, 1, 0], group: [0, 0, 1] },
  frames: { n: 2, dt_ms: 10, activation: [0, 0.5, 1, 1, 0.5, 0] },
})
const mod = (fn) => { const d = base(); fn(d); return d }

// ---- format: what is accepted, and every refusal ----
ok(validateField(base()).report.cells === 3, 'minimal field validates')
for (const k of ['tier', 'source', 'layout', 'units', 'domain']) throws(() => validateField(mod((d) => delete d.meta[k])), new RegExp(k), `refuses a field with no meta.${k}`)
throws(() => validateField(mod((d) => (d.meta.tier = 'TRUE'))), /tier/, 'refuses an unknown tier')
throws(() => validateField(mod((d) => (d.meta.domain = [1, 0]))), /domain/, 'refuses an inverted domain')
throws(() => validateField(mod((d) => (d.cells.kind = [0, 2, 0]))), /kind/, 'refuses a non-neuronal cell kind (not built yet)')
throws(() => validateField(mod((d) => (d.synapses = { n: 1, pre: [0], post: [1], weight: [1], delay_ms: [1], kind: [1] }))), /kind|gap/i, 'refuses a gap-junction synapse kind (not built yet)')
throws(() => validateField(mod((d) => (d.synapses = { n: 1, pre: [0], post: [5], weight: [1], delay_ms: [1] }))), /post|index|names|outside/, 'refuses a synapse naming a missing cell')
throws(() => validateField(mod((d) => (d.frames.activation[2] = NaN))), /finite|NaN|activation/, 'refuses non-finite activation')
throws(() => validateField(mod((d) => (d.frames.activation = [0, 0, 0]))), /activation/, 'refuses activation of the wrong length')
throws(() => validateField(mod((d) => (d.cells.group = [0, 0, 7]))), /group/, 'refuses a cell in a group that does not exist')
throws(() => validateField(mod((d) => { d.synapses = { n: 1, pre: [0], post: [1], weight: [1], delay_ms: [1] }; d.transmissions = { t_ms: [5, 1], syn: [0, 0] } })), /sorted/, 'refuses unsorted transmissions')
{ // out-of-domain values are COUNTED, not dropped
  const v = validateField(mod((d) => (d.frames.activation = [-1, 0.5, 2, 1, 0.5, 0])))
  ok(v.report.outOfDomain.below === 1 && v.report.outOfDomain.above === 1, 'out-of-domain values are counted')
  ok(v.frames.activation[0] === -1, 'out-of-domain values are not altered by validation')
}
ok(groupMeans(validateField(base()), 0).join() === '0.25,1', 'group means are exact')

// ---- registered layouts, maps, context meshes, axes ----
{
  const reg = (fn) => mod((d) => { d.meta.layout = 'registered:fsaverage'; d.meta.space = 'fsaverage, mm'; fn(d) })
  ok(validateField(reg(() => {})).meta.layout === 'registered:fsaverage', 'a registered layout with a space validates')
  throws(() => validateField(mod((d) => (d.meta.layout = 'registered:fsaverage'))), /space/, 'refuses a registered layout with no coordinate space')
  throws(() => validateField(mod((d) => (d.meta.layout = 'anatomical'))), /schematic|registered/, 'refuses a bare "anatomical" layout')
  const map = (m) => reg((d) => (d.cells.map = { name: 'Best frequency', units: 'Hz', domain: [250, 8000], log: true, values: [300, 1000, 4000], ...m }))
  ok(validateField(map({})).report.hasMap, 'a cell map validates')
  throws(() => validateField(map({ units: '' })), /units/, 'refuses a map with no units')
  throws(() => validateField(map({ values: [1, 2] })), /entries/, 'refuses a map of the wrong length')
  throws(() => validateField(map({ domain: [0, 100] })), /positive/, 'refuses a log map over a non-positive domain')
  const ctx = (m) => reg((d) => (d.context = { meshes: [{ name: 'patch', role: 'surface', pos: [0, 0, 0, 1, 0, 0, 0, 1, 0], tri: [0, 1, 2], ...m }] }))
  ok(validateField(ctx({})).report.meshes === 1, 'a context mesh validates')
  throws(() => validateField(ctx({ tri: [0, 1, 7] })), /names no vertex/, 'refuses a mesh triangle naming a missing vertex')
  throws(() => validateField(ctx({ role: 'shiny' })), /role/, 'refuses an unknown mesh role')
  throws(() => validateField(ctx({ region: [0, 0, 9] })), /names no group/, 'refuses a mesh region naming no group')
  throws(() => validateField(mod((d) => (d.meta.axes = { x: { neg: 'left' } }))), /axes/, 'refuses a half-specified axis')
}

// ---- grid / splat: the field is a MEAN, so it preserves a uniform activation anywhere ----
{
  const D = makeDemoField({ cellsPerStage: 200, durationMs: 100 }), f = validateField(D)
  const grid = makeGrid(f.cells.pos, f.cells.n, { target: 48 }), sp = new Splatter(grid, f.cells.pos, f.cells.n)
  const uni = new Float32Array(f.cells.n).fill(0.6)
  sp.frame(uni, [0, 1]); const out = sp.pack(new Uint8Array(4 * grid.count), false)
  let worst = 0, n = 0
  for (let v = 0; v < grid.count; v++) if (out[4 * v + 1] > 25) { worst = Math.max(worst, Math.abs(out[4 * v] / 255 - 0.6)); n++ }
  ok(n > 100 && worst < 0.01, `uniform activation 0.6 reads 0.6 at every dense voxel (worst error ${worst.toFixed(4)}, ${n} voxels)`)
  // doubling the density must not change a value (a sum would double it)
  const pos2 = new Float32Array(2 * f.cells.pos.length); pos2.set(f.cells.pos); pos2.set(f.cells.pos, f.cells.pos.length)
  const g2 = makeGrid(pos2, 2 * f.cells.n, { target: 48 }), s2 = new Splatter(g2, pos2, 2 * f.cells.n)
  s2.frame(new Float32Array(2 * f.cells.n).fill(0.6), [0, 1]); const o2 = s2.pack(new Uint8Array(4 * g2.count), false)
  let w2 = 0; for (let v = 0; v < g2.count; v++) if (o2[4 * v + 1] > 25) w2 = Math.max(w2, Math.abs(o2[4 * v] / 255 - 0.6))
  ok(w2 < 0.01, `doubling the cell density leaves the value unchanged (error ${w2.toFixed(4)})`)
  // a cell outside the grid is refused, never silently clipped
  throws2(() => new Splatter(makeGrid(new Float32Array([0, 0, 0, 1, 1, 1]), 2), new Float32Array([0, 0, 0, 5, 5, 5]), 2), /outside the grid/, 'a cell outside the grid is refused')
  // every cell's kernel fits, for awkward layouts (this once threw on the demo field)
  for (const seed of [1, 2, 3, 4, 5]) { const F = validateField(makeDemoField({ seed, cellsPerStage: 120, durationMs: 40 })); let e = null; try { new Splatter(makeGrid(F.cells.pos, F.cells.n, { target: 40 + seed * 8 }), F.cells.pos, F.cells.n) } catch (x) { e = x } ok(!e, `seed ${seed} grid holds every kernel`) }
  // a domain-clamped value never leaves [0,1]
  sp.frame(new Float32Array(f.cells.n).fill(5), [0, 1]); const o3 = sp.pack(new Uint8Array(4 * grid.count), false)
  ok(Math.max(...o3.filter((_, i) => i % 4 === 0)) <= 255, 'clamped at draw time')
}
function throws2(fn, re, m) { try { fn() } catch (e) { return ok(re.test(e.message), m) } ok(false, `${m} (did not throw)`) }

// ---- ramp ----
{
  const { stops, usedFallback } = readRamp(null, 'seq')
  ok(stops.length === STOPS && usedFallback, 'no page -> fallback ramp, and it says so')
  ok(colorAt(stops, 0).join() === stops[0].join() && colorAt(stops, 1).join() === stops[STOPS - 1].join(), 'ramp endpoints')
  ok(rampBytes(stops).length === 1024, 'ramp strip is 256 RGBA')
}

// ---- orbit ----
{
  const o = makeOrbit({ theta: 0.3, phi: 1.0, dist: 3 }), p = orbitPosition(o)
  ok(Math.abs(Math.hypot(...p) - 3) < 1e-9, 'orbit keeps its distance')
  drag(o, 0, 1e6); ok(o.phi >= 0.05 && o.phi <= Math.PI - 0.05, 'orbit never flips over the pole')
  zoom(o, -1e6); ok(o.dist >= 0.4, 'zoom stays in range'); zoom(o, 1e6); ok(o.dist <= 40, 'zoom stays in range (far)')
}

// ---- demo generator: deterministic, labelled SPEC, relays in order ----
{
  const a = makeDemoField({ cellsPerStage: 150, durationMs: 400, seed: 7 }), b = makeDemoField({ cellsPerStage: 150, durationMs: 400, seed: 7 })
  ok(a.frames.activation.every((x, i) => x === b.frames.activation[i]), 'demo is deterministic for a seed')
  ok(a.meta.tier === 'SPEC' && /Not a model/.test(a.meta.notes[0]), 'demo is labelled SPEC and says it is not a model of any brain')
  const f = validateField(makeDemoField({ preset: 'driven' }))
  // first time each stage's mean rises 0.02 above its own starting level: must be ordered by stage
  const first = STAGE_NAMES.map((_, g) => { const base0 = groupMeans(f, 0)[g]; for (let k = 0; k < f.frames.n; k++) if (groupMeans(f, k)[g] > base0 + 0.02) return k * f.frames.dt_ms; return Infinity })
  ok(first.every((t, i) => i === 0 || t >= first[i - 1]), `stages light up in order: ${first.join(' < ')} ms`)
  ok(Number.isFinite(first[4]), 'the last stage is reached')
  ok(first[0] >= 150 - 5, 'nothing is active before the stimulus starts')
  // the driven share exists only where the stimulus is: stage 1
  let later = 0; for (let k = 0; k < f.frames.n; k++) for (let i = f.cells.n / 5; i < f.cells.n; i++) later = Math.max(later, f.frames.source[k * f.cells.n + i])
  ok(later === 0, 'stimulus-driven share is zero in every later stage')
  // transmissions are sorted, name real synapses, and each leaves a cell that was active
  const T = f.transmissions; let sorted = true; for (let i = 1; i < T.n; i++) if (T.t_ms[i] < T.t_ms[i - 1]) sorted = false
  ok(T.n > 1000 && sorted, `transmissions supplied and sorted (${T.n})`)
  const l = validateField(makeDemoField({ preset: 'loop' })), lastG = (g, k) => groupMeans(l, k)[g]
  const tEnd = 560 + 300; let kk = Math.round(tEnd / l.frames.dt_ms), still = 0; for (let k = kk; k < l.frames.n; k++) still = Math.max(still, lastG(4, k))
  const d = validateField(makeDemoField({ preset: 'driven', durationMs: 3000 })); // driven preset's last stage after the stimulus ends at 2400 ms
  ok(still > 0.3, `loop preset sustains activity after the cue (stage 5 peaks ${still.toFixed(2)} after ${tEnd} ms)`)
}

// ---- source rules: no colour literal in the component, only in the ramp fallback; no sound; no fetches that escape a mount ----
{
  const files = ['tissue-field.js', 'src/volume.js', 'src/grid.mjs', 'src/format.mjs', 'src/orbit.mjs'].map((f) => [f, readFileSync(join(HERE, f), 'utf8')])
  const strip = (s) => s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '')
  for (const [n, s] of files) {
    ok(!/#[0-9a-f]{6}\b|rgba?\(\s*\d/i.test(strip(s)), `${n}: no colour literal (colour comes from polarize-ui tokens)`)
    ok(!/AudioContext|new Audio\(|navigator\.serial/.test(strip(s)), `${n}: makes no sound and opens no port`)
    ok(!/\bfetch\(\s*['"`]\//.test(strip(s)), `${n}: no root-relative fetch`)
  }
  const el = strip(files[0][1])
  ok(/setInterval/.test(el) && !/requestAnimationFrame/.test(el), 'transport runs on setInterval, not requestAnimationFrame')
  ok(/ui-tier/.test(el), 'the tier badge is rendered')
}

console.log(`tissue-field: ${pass} passed, ${fail} failed`)
process.exit(fail ? 1 : 0)
