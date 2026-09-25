// Deterministic SYNTHETIC data for the stories. Nothing here is a measurement.
export function rng(seed = 1) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}
const gauss = (r: () => number) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r())

/** A 1/f-ish spectrum with lines at 10 Hz (alpha) and 60 Hz (mains). */
export function spectrum(seed = 3): [number, number][] {
  const r = rng(seed)
  const out: [number, number][] = []
  for (let f = 1; f <= 100; f += 0.5) {
    let p = 20 / f ** 1.2
    p += 6 * Math.exp(-((f - 10) ** 2) / 2)
    p += 40 * Math.exp(-((f - 60) ** 2) / 0.08)
    out.push([f, p * Math.exp(0.25 * gauss(r))])
  }
  return out
}

/** A detection curve: recovery fraction against injected amplitude. */
export function detectionCurve(k95 = 0.153): [number, number][] {
  const out: [number, number][] = []
  for (let k = 0.01; k <= 0.3; k += 0.01) out.push([+k.toFixed(2), 1 / (1 + Math.exp(-(k - (k95 - 0.018 * Math.log(19))) / 0.018))])
  return out
}

/** A long noisy trace to show decimation. */
export function longTrace(n = 12000, seed = 7): [number, number][] {
  const r = rng(seed)
  let v = 0
  const out: [number, number][] = []
  for (let i = 0; i < n; i++) {
    v = 0.97 * v + gauss(r) * 0.4
    const spike = i % 2500 === 1200 ? 8 : 0
    out.push([i / 250, v + spike])
  }
  return out
}

export function amTone(n = 1200) {
  return Array.from({ length: n }, (_, i) => (0.55 + 0.45 * Math.sin(i * 0.02)) * Math.sin(i * 0.9))
}
