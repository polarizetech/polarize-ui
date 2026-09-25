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

/**
 * A synthetic spectrogram in dB: 1/f background, a 10 Hz alpha burst between 20 and 40 s,
 * and a slow chirp. rows = frequency bins (row 0 = lowest), cols = time bins.
 */
export function spectrogram({ rows = 60, cols = 240, alpha = 1, seed = 11 } = {}) {
  const r = rng(seed)
  const fMax = 30, tMax = 60
  const grid: number[][] = []
  for (let i = 0; i < rows; i++) {
    const f = ((i + 0.5) / rows) * fMax
    const row: number[] = []
    for (let j = 0; j < cols; j++) {
      const t = ((j + 0.5) / cols) * tMax
      let p = 40 / (f + 1)
      const burst = t > 20 && t < 40 ? Math.sin(((t - 20) / 20) * Math.PI) : 0
      p += alpha * 60 * burst * Math.exp(-((f - 10) ** 2) / 2)
      p += 12 * Math.exp(-((f - (4 + t * 0.35)) ** 2) / 0.6)
      p *= Math.exp(0.35 * gauss(r))
      row.push(10 * Math.log10(p))
    }
    grid.push(row)
  }
  return { grid, x: [0, tMax] as [number, number], y: [0, fMax] as [number, number] }
}

/** A null distribution of a statistic: n draws from a noisy null centred at `centre`. */
export function nullDraws(n = 999, centre = 0.21, spread = 0.04, seed = 5) {
  const r = rng(seed)
  return Array.from({ length: n }, () => centre + spread * gauss(r))
}
