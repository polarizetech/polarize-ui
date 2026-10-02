// A SYNTHETIC field, to exercise the renderer. It is not a model of any brain.
//
// Five stages of cells laid out along a curve; each stage's cells carry a best frequency along the
// stage's long axis; a stage drives the next through tonotopically-aligned synapses with a
// distance-dependent delay, plus short lateral excitation (so activity spreads across the tissue
// instead of hopping between points) and local inhibition. The "loop" preset adds weak feedback from
// the last stage to the first, so activity can continue after the stimulus stops.
//
// Every rule below is a stated choice of THIS demo. Nothing about timing, convergence or gain is
// taken from physiology, and the field says so (tier SPEC, meta.notes). Real fields come from a
// model or decoder that can name its source; this one exists so the picture can be tested
// against data whose answer is known (dev_check.mjs does exactly that).

import { rng, gauss, runDynamics, transmissionsFrom } from './engine.mjs'

export const STAGE_NAMES = ['Stage 1', 'Stage 2', 'Stage 3', 'Stage 4', 'Stage 5']

/**
 * @param {{preset?: 'driven'|'loop', seed?: number, cellsPerStage?: number, durationMs?: number, dtMs?: number}} o
 */
export function makeDemoField({ preset = 'driven', seed = 29, cellsPerStage = 600, durationMs = 3000, dtMs = 4 } = {}) {
  const r = rng(seed)
  const S = STAGE_NAMES.length, N = S * cellsPerStage
  const pos = new Float32Array(3 * N), bf = new Float32Array(N), group = new Uint16Array(N), kind = new Uint8Array(N)
  // ---- layout: stages along a gentle arc; best frequency along each stage's long (y) axis ----
  for (let s = 0; s < S; s++) {
    const cx = -2 + (4 * s) / (S - 1), cy = 0.35 * Math.sin((s / (S - 1)) * Math.PI), cz = 0.18 * Math.cos((s / (S - 1)) * Math.PI)
    for (let j = 0; j < cellsPerStage; j++) {
      const i = s * cellsPerStage + j
      const u = r() * 2 - 1                                   // position along the tonotopic axis
      bf[i] = 0.5 * Math.pow(32, (u + 1) / 2)                 // 0.5 .. 16 kHz, log-spaced
      const taper = Math.sqrt(Math.max(0, 1 - u * u * 0.6))   // a lens, thinner at the ends
      pos[3 * i] = cx + 0.30 * gauss(r) * 0.6 * taper
      pos[3 * i + 1] = cy + 0.62 * u
      pos[3 * i + 2] = cz + 0.26 * gauss(r) * 0.6 * taper
      group[i] = s
      kind[i] = r() < 0.2 ? 1 : 0
    }
  }
  // ---- synapses ----
  const pre = [], post = [], weight = [], delay = [], speed = 0.1 // units per ms
  const addSyn = (a, b, w) => {
    const dx = pos[3 * a] - pos[3 * b], dy = pos[3 * a + 1] - pos[3 * b + 1], dz = pos[3 * a + 2] - pos[3 * b + 2]
    pre.push(a); post.push(b); weight.push(w); delay.push(2 + Math.hypot(dx, dy, dz) / speed)
  }
  const octDist = (a, b) => Math.abs(Math.log2(bf[a] / bf[b]))
  const pickNear = (b, lo, hi, k, sigmaOct) => {   // k presynaptic cells in [lo,hi), weighted by tonotopic closeness
    const out = []
    for (let tries = 0; tries < k * 40 && out.length < k; tries++) {
      const a = lo + Math.floor(r() * (hi - lo))
      if (a !== b && r() < Math.exp(-0.5 * (octDist(a, b) / sigmaOct) ** 2)) out.push(a)
    }
    return out
  }
  for (let s = 0; s < S; s++) {
    const lo = s * cellsPerStage, hi = lo + cellsPerStage
    for (let i = lo; i < hi; i++) {
      if (s > 0) for (const a of pickNear(i, lo - cellsPerStage, lo, 8, 0.3)) if (kind[a] === 0) addSyn(a, i, 0.30)
      for (const a of pickNear(i, lo, hi, 3, 0.2)) if (kind[a] === 0) addSyn(a, i, 0.18)          // lateral excitation
      if (kind[i] === 1) for (const b of pickNear(i, lo, hi, 6, 0.5)) addSyn(i, b, -0.35)        // local inhibition
    }
  }
  if (preset === 'loop') {
    const last = (S - 1) * cellsPerStage
    for (let i = 0; i < cellsPerStage; i++) for (const a of pickNear(i, last, last + cellsPerStage, 4, 0.3)) if (kind[a] === 0) addSyn(a, i, 0.34)
  }
  const nSyn = pre.length
  const preA = Uint32Array.from(pre), postA = Uint32Array.from(post), wA = Float32Array.from(weight), dA = Float32Array.from(delay)
  // ---- stimulus: (frequency kHz, onset ms, duration ms, amplitude) ----
  const events = preset === 'loop'
    ? [{ f: 1.0, on: 150, dur: 180, amp: 1.0 }, { f: 4.0, on: 380, dur: 180, amp: 1.0 }]
    : [{ f: 1.0, on: 150, dur: 1000, amp: 1.0 }, { f: 6.0, on: 1500, dur: 900, amp: 1.0 }]
  const drive = (i, t) => {
    let d = 0
    if (group[i] !== 0) return 0
    for (const e of events) {
      const x = (t - e.on) / 10, y = (e.on + e.dur - t) / 10
      const env = Math.min(1, Math.max(0, Math.min(x, y)))
      if (env > 0) d += e.amp * env * Math.exp(-0.5 * (Math.log2(bf[i] / e.f) / 0.25) ** 2)
    }
    return d
  }
  // ---- dynamics and transmissions: shared engine ----
  const T = Math.round(durationMs / dtMs)
  const { act, srcShare } = runDynamics({ N, T, dtMs, pre: preA, post: postA, w: wA, delayMs: dA, drive })
  const transmissions = transmissionsFrom({ act, N, T, dtMs, pre: preA, fraction: 0.5, r })
  return {
    format: 'tissue-field/1',
    meta: {
      title: `Synthetic relay chain (${preset})`, tier: 'SPEC',
      source: 'stories/models/tissue-demo/relay.mjs: a synthetic generator written to exercise the renderer',
      layout: 'schematic', units: 'unitless rate, 0 to 1', domain: [0, 1],
      notes: [
        'Not a model of any brain. Stage timing, convergence and gain are choices of this demo, not physiology.',
        'Stage k drives stage k+1 through tonotopically aligned synapses (best frequency within about 0.3 octave), plus short lateral excitation and local inhibition.',
        'Synapse delay = 2 ms + distance / 0.1 units per ms. Positions are schematic units with no anatomical scale.',
        'A pulse on a synapse is drawn when its presynaptic cell\'s activation crosses 0.5 upward (half of its synapses chosen at random): a display rule of this demo, not a spike model.',
        preset === 'loop'
          ? 'Loop preset: weak feedback from the last stage to the first lets activity continue after a two-tone cue stops. The stimulus-driven share is the part of a cell\'s excitatory input that comes straight from the stimulus.'
          : 'Driven preset: two tones, 1 kHz then 6 kHz, held while the relay runs. The stimulus-driven share is the part of a cell\'s excitatory input that comes straight from the stimulus, so only stage 1 is ever above zero.',
      ],
    },
    groups: STAGE_NAMES.map((name) => ({ name })),
    cells: { n: N, pos, kind, group },
    synapses: { n: nSyn, pre: preA, post: postA, weight: wA, delay_ms: dA },
    frames: { n: T, dt_ms: dtMs, activation: act, source: srcShare },
    transmissions,
    stimulus: events,
    bf,
  }
}
