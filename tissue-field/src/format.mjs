// tissue-field/1 -- the data a <tissue-field> draws, and everything it refuses.
//
// The component draws what it is GIVEN. It decides nothing about physiology: how activation
// spreads from cell to cell, what a synapse does, which cells are stimulus-driven are all facts
// the PRODUCER of a field states (a model, a decoder, a recording). So this file is mostly refusals:
// a field that cannot say what it is, where it came from, how its positions are laid out and what
// range its numbers live in is not drawn, because a picture with no stated scale is a picture of nothing.
//
// Zero-build ES module, no DOM, so it runs under node (dev_check.mjs) and in the browser.

export const FORMAT = 'tissue-field/1'

/** Epistemic ids, the same ones polarize-ui's <ui-tier> knows (tokens.json epistemic.tiers). */
export const TIERS = ['A', 'MEASURED', 'PHYSICS', 'B', 'PREDICTED', 'MODELLED', 'C', 'EXPLORATORY', 'SPEC', 'ADDED', 'TASTE', 'REFUTED']

/** Cell kinds. 0 and 1 are neurons. Everything else is reserved and REFUSED until it is built, so
 *  a producer cannot hand over an astrocyte and have it drawn as a neuron. */
export const CELL_KIND = { EXCITATORY: 0, INHIBITORY: 1 }
export const CELL_KIND_NAME = ['excitatory neuron', 'inhibitory neuron']

/** Synapse kinds. 0 is a chemical synapse (directed, delayed, signed by `weight`). Gap junctions
 *  (undirected, electrical) are reserved and REFUSED until they are built. */
export const SYNAPSE_KIND = { CHEMICAL: 0 }

export class FieldError extends Error {
  constructor(message) { super(message); this.name = 'FieldError' }
}

const need = (cond, msg) => { if (!cond) throw new FieldError(msg) }
const isNum = (x) => typeof x === 'number' && Number.isFinite(x)
const asF32 = (a, name) => {
  if (a instanceof Float32Array) return a
  need(Array.isArray(a) || ArrayBuffer.isView(a), `${name} must be an array or a typed array`)
  return Float32Array.from(a)
}
const asU = (Ctor, a, name) => {
  if (a instanceof Ctor) return a
  need(Array.isArray(a) || ArrayBuffer.isView(a), `${name} must be an array or a typed array`)
  return Ctor.from(a)
}

/**
 * Validate and normalise a field. Returns a new object with typed arrays and a `report` of
 * everything that was counted, clipped or thinned (nothing is dropped silently).
 * Throws FieldError on anything it cannot draw honestly.
 */
export function validateField(raw) {
  need(raw && typeof raw === 'object', 'field must be an object')
  need(raw.format === FORMAT, `format must be "${FORMAT}" (got ${JSON.stringify(raw.format)})`)

  // ---- meta: what this is, where it came from, how to read its numbers ----
  const m = raw.meta
  need(m && typeof m === 'object', 'meta is required')
  need(typeof m.title === 'string' && m.title.trim(), 'meta.title is required')
  need(typeof m.tier === 'string' && TIERS.includes(m.tier.toUpperCase()),
    `meta.tier is required and must be one of ${TIERS.join(', ')} (a field that cannot say how much to trust it is not drawn)`)
  need(typeof m.source === 'string' && m.source.trim(), 'meta.source is required: what produced these numbers')
  need(typeof m.layout === 'string' && m.layout.trim(),
    'meta.layout is required: "schematic" or "registered:<atlas>" (positions are never silently anatomical)')
  need(m.layout === 'schematic' || (/^registered:\S+/.test(m.layout) && typeof m.space === 'string' && m.space.trim()),
    'meta.layout must be "schematic" or "registered:<atlas>"; a registered layout must also say its coordinate space in meta.space (units and template), or it is a schematic wearing anatomy')
  need(typeof m.units === 'string' && m.units.trim(), 'meta.units is required: what activation is measured in')
  need(Array.isArray(m.domain) && m.domain.length === 2 && isNum(m.domain[0]) && isNum(m.domain[1]) && m.domain[1] > m.domain[0],
    'meta.domain must be [lo, hi] with hi > lo: the activation range the colour scale spans')
  const notes = m.notes === undefined ? [] : m.notes
  need(Array.isArray(notes) && notes.every((s) => typeof s === 'string'), 'meta.notes must be a list of strings')
  if (m.axes !== undefined) {
    need(m.axes && typeof m.axes === 'object', 'meta.axes must be {x,y,z}, each {neg,pos} naming the two ends')
    for (const k of Object.keys(m.axes)) need(['x', 'y', 'z'].includes(k) && typeof m.axes[k].neg === 'string' && typeof m.axes[k].pos === 'string', `meta.axes.${k} must be {neg, pos} strings`)
  }
  const meta = { ...m, tier: m.tier.toUpperCase(), notes: [...notes] }

  // ---- groups ----
  const groups = raw.groups
  need(Array.isArray(groups) && groups.length >= 1, 'groups is required: at least one named group of cells')
  groups.forEach((g, i) => need(g && typeof g.name === 'string' && g.name.trim(), `groups[${i}].name is required`))

  // ---- cells ----
  const c = raw.cells
  need(c && Number.isInteger(c.n) && c.n >= 1, 'cells.n must be a positive integer')
  const N = c.n
  const pos = asF32(c.pos, 'cells.pos')
  need(pos.length === 3 * N, `cells.pos must hold 3 * n = ${3 * N} numbers (got ${pos.length})`)
  for (let i = 0; i < pos.length; i++) need(Number.isFinite(pos[i]), `cells.pos[${i}] is not a finite number`)
  const kind = c.kind === undefined ? new Uint8Array(N) : asU(Uint8Array, c.kind, 'cells.kind')
  need(kind.length === N, `cells.kind must have n = ${N} entries`)
  for (let i = 0; i < N; i++) {
    need(kind[i] === CELL_KIND.EXCITATORY || kind[i] === CELL_KIND.INHIBITORY,
      `cells.kind[${i}] = ${kind[i]}: only neurons (0 excitatory, 1 inhibitory) are supported yet; non-neuronal cells are refused rather than drawn as neurons`)
  }
  const group = asU(Uint16Array, c.group, 'cells.group')
  need(group.length === N, `cells.group must have n = ${N} entries`)
  for (let i = 0; i < N; i++) need(group[i] < groups.length, `cells.group[${i}] = ${group[i]} names no group (there are ${groups.length})`)

  // ---- a per-cell static map (e.g. best frequency): its own name, units and domain, never mixed with activation ----
  let map = null
  if (c.map) {
    const mp = c.map
    need(typeof mp.name === 'string' && mp.name.trim() && typeof mp.units === 'string' && mp.units.trim(),
      'cells.map needs a name and units: a map with no units cannot be read')
    need(Array.isArray(mp.domain) && mp.domain.length === 2 && isNum(mp.domain[0]) && isNum(mp.domain[1]) && mp.domain[1] > mp.domain[0],
      'cells.map.domain must be [lo, hi] with hi > lo')
    const vals = asF32(mp.values, 'cells.map.values')
    need(vals.length === N, `cells.map.values must have n = ${N} entries`)
    for (let i = 0; i < N; i++) need(Number.isFinite(vals[i]), `cells.map.values[${i}] is not a finite number`)
    if (mp.log) need(mp.domain[0] > 0, 'a log cells.map needs a positive domain')
    map = { name: mp.name, units: mp.units, domain: [...mp.domain], log: !!mp.log, values: vals, note: mp.note || '' }
  }

  // ---- context meshes (optional): the shape the cells live in, drawn faint and never coloured by activation ----
  let context = null
  if (raw.context) {
    need(Array.isArray(raw.context.meshes), 'context.meshes must be a list')
    context = raw.context.meshes.map((ms, k) => {
      need(typeof ms.name === 'string' && ms.name.trim(), `context.meshes[${k}].name is required`)
      need(ms.role === 'surface' || ms.role === 'outline', `context.meshes[${k}].role must be "surface" or "outline"`)
      const mpos = asF32(ms.pos, `context.meshes[${k}].pos`), mtri = asU(Uint32Array, ms.tri, `context.meshes[${k}].tri`)
      need(mpos.length % 3 === 0 && mpos.length >= 9, `context.meshes[${k}].pos must be a multiple of 3 numbers`)
      need(mtri.length % 3 === 0 && mtri.length >= 3, `context.meshes[${k}].tri must be a multiple of 3 indices`)
      for (let i = 0; i < mpos.length; i++) need(Number.isFinite(mpos[i]), `context.meshes[${k}].pos[${i}] is not finite`)
      const nv = mpos.length / 3
      for (let i = 0; i < mtri.length; i++) need(mtri[i] < nv, `context.meshes[${k}].tri[${i}] = ${mtri[i]} names no vertex (${nv})`)
      let region = null
      if (ms.region !== undefined) {
        region = asU(Uint16Array, ms.region, `context.meshes[${k}].region`)
        need(region.length === nv, `context.meshes[${k}].region must have one entry per vertex (${nv})`)
        for (let i = 0; i < nv; i++) need(region[i] < groups.length, `context.meshes[${k}].region[${i}] names no group`)
      }
      return { name: ms.name, role: ms.role, pos: mpos, tri: mtri, region }
    })
  }

  // ---- synapses (optional) ----
  let synapses = null
  if (raw.synapses) {
    const s = raw.synapses
    need(Number.isInteger(s.n) && s.n >= 0, 'synapses.n must be a non-negative integer')
    const pre = asU(Uint32Array, s.pre, 'synapses.pre'), post = asU(Uint32Array, s.post, 'synapses.post')
    const weight = asF32(s.weight, 'synapses.weight'), delay = asF32(s.delay_ms, 'synapses.delay_ms')
    const skind = s.kind === undefined ? new Uint8Array(s.n) : asU(Uint8Array, s.kind, 'synapses.kind')
    for (const [name, arr] of [['pre', pre], ['post', post], ['weight', weight], ['delay_ms', delay], ['kind', skind]]) {
      need(arr.length === s.n, `synapses.${name} must have n = ${s.n} entries (got ${arr.length})`)
    }
    for (let i = 0; i < s.n; i++) {
      need(pre[i] < N && post[i] < N, `synapses[${i}] connects cell ${pre[i]} -> ${post[i]}, outside 0..${N - 1}`)
      need(Number.isFinite(weight[i]), `synapses.weight[${i}] is not a finite number`)
      need(Number.isFinite(delay[i]) && delay[i] >= 0, `synapses.delay_ms[${i}] must be >= 0`)
      need(skind[i] === SYNAPSE_KIND.CHEMICAL,
        `synapses.kind[${i}] = ${skind[i]}: only chemical synapses (0) are supported yet; gap junctions are refused rather than drawn as chemical`)
    }
    synapses = { n: s.n, pre, post, weight, delay_ms: delay, kind: skind }
  }

  // ---- frames ----
  const f = raw.frames
  need(f && Number.isInteger(f.n) && f.n >= 1, 'frames.n must be a positive integer')
  need(isNum(f.dt_ms) && f.dt_ms > 0, 'frames.dt_ms must be > 0')
  const activation = asF32(f.activation, 'frames.activation')
  need(activation.length === f.n * N, `frames.activation must hold frames.n * cells.n = ${f.n * N} numbers (got ${activation.length})`)
  let nanCount = 0, below = 0, above = 0
  const [lo, hi] = meta.domain
  for (let i = 0; i < activation.length; i++) {
    const v = activation[i]
    if (!Number.isFinite(v)) nanCount++
    else if (v < lo) below++
    else if (v > hi) above++
  }
  need(nanCount === 0, `frames.activation holds ${nanCount} non-finite values`)
  let source = null
  if (f.source !== undefined && f.source !== null) {
    source = asF32(f.source, 'frames.source')
    need(source.length === f.n * N, 'frames.source must have the same length as frames.activation')
    for (let i = 0; i < source.length; i++) need(source[i] >= 0 && source[i] <= 1, `frames.source[${i}] is outside [0, 1]: it is the share of this cell's activation that the stimulus drives`)
  }

  // ---- transmissions (optional): explicit events, never inferred by the component ----
  let transmissions = null
  if (raw.transmissions) {
    need(synapses, 'transmissions need synapses to travel along')
    const t = raw.transmissions
    const tms = asF32(t.t_ms, 'transmissions.t_ms'), syn = asU(Uint32Array, t.syn, 'transmissions.syn')
    need(tms.length === syn.length, 'transmissions.t_ms and transmissions.syn must be the same length')
    for (let i = 0; i < syn.length; i++) {
      need(syn[i] < synapses.n, `transmissions.syn[${i}] = ${syn[i]} names no synapse`)
      if (i) need(tms[i] >= tms[i - 1], 'transmissions must be sorted by t_ms')
    }
    transmissions = { n: syn.length, t_ms: tms, syn }
  }

  return {
    format: FORMAT, meta, groups: groups.map((g) => ({ ...g })),
    cells: { n: N, pos, kind, group, map }, synapses, context,
    frames: { n: f.n, dt_ms: f.dt_ms, activation, source }, transmissions,
    report: {
      cells: N, synapses: synapses ? synapses.n : 0, frames: f.n,
      duration_s: (f.n * f.dt_ms) / 1000,
      // values outside meta.domain are COUNTED here and clamped only at draw time, never silently dropped
      outOfDomain: { below, above },
      hasSource: !!source, hasTransmissions: !!transmissions, hasMap: !!map, meshes: context ? context.length : 0,
    },
  }
}

/** Mean activation of each group at one frame: what the readout and the timeline strip print. */
export function groupMeans(field, frame) {
  const { n } = field.cells, G = field.groups.length
  const sums = new Float64Array(G), counts = new Uint32Array(G)
  const base = frame * n
  for (let i = 0; i < n; i++) { const g = field.cells.group[i]; sums[g] += field.frames.activation[base + i]; counts[g]++ }
  return Array.from(sums, (s, g) => (counts[g] ? s / counts[g] : 0))
}
