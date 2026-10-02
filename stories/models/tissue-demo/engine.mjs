// The part of the demo generators that is the same for every layout: delayed rate dynamics and the
// display rule that turns activation into transmissions. A SYNTHETIC engine; nothing here is physiology.
//
//   da/dt = (-a + sigmoid(gain * 2 * (input + drive - theta))) / tau,   input = sum of w * a_pre(t - delay)
//
// Delays are rounded to whole frames, so the shortest effective delay is one frame.

export function rng(seed) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
export const gauss = (r) => Math.sqrt(-2 * Math.log(r() || 1e-12)) * Math.cos(2 * Math.PI * r())

/**
 * @param {{N:number, T:number, dtMs:number, pre:Uint32Array, post:Uint32Array, w:Float32Array, delayMs:Float32Array,
 *          drive:(i:number, ms:number)=>number, tau?:number, theta?:number, gain?:number}} o
 * @returns {{act:Float32Array, srcShare:Float32Array}} activation (T*N) and each cell's stimulus-driven share of its excitatory input
 */
export function runDynamics({ N, T, dtMs, pre, post, w, delayMs, drive, tau = 20, theta = 0.45, gain = 6 }) {
  const nSyn = pre.length
  const act = new Float32Array(T * N), srcShare = new Float32Array(T * N)
  const dSteps = Int32Array.from(delayMs, (d) => Math.max(1, Math.round(d / dtMs)))
  const inp = new Float32Array(N), inpPos = new Float32Array(N)
  for (let t = 1; t < T; t++) {
    inp.fill(0); inpPos.fill(0)
    for (let e = 0; e < nSyn; e++) {
      const tt = t - dSteps[e]
      if (tt < 0) continue
      const v = w[e] * act[tt * N + pre[e]]
      inp[post[e]] += v
      if (v > 0) inpPos[post[e]] += v
    }
    const ms = t * dtMs
    for (let i = 0; i < N; i++) {
      const d = drive(i, ms)
      const total = inp[i] + d
      const a0 = act[(t - 1) * N + i]
      act[t * N + i] = a0 + (dtMs / tau) * (-a0 + 1 / (1 + Math.exp(-gain * (total - theta) * 2)))
      const pos_ = inpPos[i] + d
      srcShare[t * N + i] = pos_ > 1e-6 ? Math.min(1, d / pos_) : 0
    }
  }
  return { act, srcShare }
}

/** A presynaptic cell's activation crossing 0.5 upward sends one pulse down a random fraction of its synapses. */
export function transmissionsFrom({ act, N, T, dtMs, pre, fraction, r }) {
  const byPre = Array.from({ length: N }, () => [])
  for (let e = 0; e < pre.length; e++) byPre[pre[e]].push(e)
  const tm = [], ts = []
  for (let t = 1; t < T; t++) for (let i = 0; i < N; i++) {
    if (act[(t - 1) * N + i] < 0.5 && act[t * N + i] >= 0.5) for (const e of byPre[i]) if (r() < fraction) { tm.push(t * dtMs); ts.push(e) }
  }
  return { n: tm.length, t_ms: Float32Array.from(tm), syn: Uint32Array.from(ts) }
}
