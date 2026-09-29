/**
 * The Jeffress (1948) place model of sound localisation: each ear's auditory nerve fires
 * phase-locked to a tone, and a row of coincidence detectors each delays the left input by a
 * different internal delay. The detector whose delay cancels the interaural time difference (ITD)
 * sees the most coincidences, so WHICH detector fires most encodes WHERE the sound is.
 *
 * Phase locking follows a von Mises rate profile, r(φ) ∝ exp(κ cos φ), whose vector strength is
 * I₁(κ)/I₀(κ). Spikes are inhomogeneous Poisson (thinning). A coincidence is a left spike, shifted
 * by the detector's delay, within ±window/2 of a right spike. The expected count has a closed form:
 *
 *     E[count(d)] = R² · T · w · I₀(2κ·cos(π f (ITD − d))) / I₀(κ)²
 *
 * so the simulated counts can be checked against it. Everything here is MODELLED.
 * Caveat that belongs beside any Jeffress picture: in birds the delay-line map is well supported;
 * in mammals it is contested (Brand et al. 2002; McAlpine & Grothe 2003), where the evidence
 * favours a two-channel rate code instead.
 */
export type JeffressParams = {
  toneHz: number
  itdUs: number // positive: the sound reaches the LEFT ear first
  windowUs: number
  vectorStrength: number // 0–0.95
  rateHz: number // mean spike rate per ear
  seconds: number
  seed?: number
}

function besselI(n: 0 | 1, x: number) {
  // series; adequate for the κ < 20 this model uses
  let sum = 0, term = n === 0 ? 1 : x / 2
  for (let k = 0; k < 60; k++) {
    sum += term
    term *= (x * x) / 4 / ((k + 1) * (k + 1 + n))
  }
  return sum
}

export function kappaFor(vs: number) {
  if (vs <= 0) return 0
  let lo = 0, hi = 20
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2
    if (besselI(1, mid) / besselI(0, mid) < vs) lo = mid; else hi = mid
  }
  return (lo + hi) / 2
}

function rng(seed: number) {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function spikes(r: () => number, p: JeffressParams, kappa: number, lagS: number) {
  const peak = p.rateHz * Math.exp(kappa) / besselI(0, kappa)
  const out: number[] = []
  let t = 0
  for (;;) {
    t += -Math.log(1 - r()) / peak
    if (t >= p.seconds) return out
    const phase = 2 * Math.PI * p.toneHz * (t - lagS)
    if (r() < Math.exp(kappa * (Math.cos(phase) - 1))) out.push(t)
  }
}

export function simulate(p: JeffressParams, delaysUs: number[]) {
  const kappa = kappaFor(p.vectorStrength)
  const r = rng(p.seed ?? 7)
  // the right ear hears the tone ITD later when the source is on the left
  const L = spikes(r, p, kappa, 0)
  const R = spikes(r, p, kappa, p.itdUs * 1e-6)
  const w = p.windowUs * 1e-6
  const counts = delaysUs.map((dUs) => {
    const d = dUs * 1e-6
    let n = 0, j = 0
    for (const tl of L) {
      const t = tl + d
      while (j < R.length && R[j] < t - w / 2) j++
      for (let k = j; k < R.length && R[k] <= t + w / 2; k++) n++
    }
    return n
  })
  const i0 = besselI(0, kappa)
  const expected = delaysUs.map((dUs) =>
    p.rateHz ** 2 * p.seconds * w * besselI(0, 2 * kappa * Math.abs(Math.cos(Math.PI * p.toneHz * (p.itdUs - dUs) * 1e-6))) / (i0 * i0))
  const best = delaysUs[counts.indexOf(Math.max(...counts))]
  return { counts, expected, best, spikesLeft: L.length, spikesRight: R.length, kappa }
}
