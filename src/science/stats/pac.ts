/**
 * Phase–amplitude coupling (PAC) and the comodulogram.
 *
 * Method: band-limit the signal with a zero-phase FFT filter (cosine-tapered edges), take the
 * analytic signal, and measure how the amplitude of a fast band is distributed over the phase
 * of a slow one with Tort et al.'s modulation index (MI, 18 phase bins; 0 = flat, 1 = all the
 * amplitude in one bin).
 *
 * Significance: circular time-shifts of the amplitude envelope against the phase break any
 * coupling while keeping both series' own structure. Each cell gets a z against its own null,
 * and the grid gets a FAMILY-WISE threshold — the (1 − α) quantile of the per-surrogate MAXIMUM
 * over all resolvable cells — because a comodulogram is many tests at once.
 *
 * Resolvability: an amplitude band only carries modulation at f_phase if it is at least
 * 2·f_phase wide (the modulation lives in sidebands at f_amp ± f_phase), and it must sit clear
 * of the phase band. Cells failing either are marked unresolvable and excluded — never reported
 * as zero coupling, because the filter removed the thing being measured.
 */

export type ComodulogramInput = {
  signal: number[] | Float64Array
  fs: number
  /** Centre frequencies (Hz) of the phase bands — the x axis. */
  phaseFreqs: number[]
  /** Width (Hz) of each phase band. Default 2. */
  phaseBandwidth?: number
  /** Centre frequencies (Hz) of the amplitude bands — the y axis. */
  ampFreqs: number[]
  /** Width (Hz) of each amplitude band. Default 2 × the largest phase frequency, so every cell
   *  can carry its sidebands; narrower is allowed and the affected cells become unresolvable. */
  ampBandwidth?: number
  nSurrogates?: number
  /** Minimum circular shift for a surrogate, in seconds. Default 1. */
  minShiftSeconds?: number
  alpha?: number
  nBins?: number
  seed?: number
}

export type Comodulogram = {
  /** mi[ampIndex][phaseIndex] — row 0 is the lowest amplitude frequency. */
  mi: number[][]
  /** Per-cell z against its own surrogate null (NaN where unresolvable). */
  z: number[][]
  /** Family-wise p: fraction of surrogates whose grid MAXIMUM reached this cell's MI. */
  pFamilywise: number[][]
  significant: boolean[][]
  resolvable: boolean[][]
  /** The family-wise MI threshold at alpha. */
  threshold: number
  phaseFreqs: number[]
  ampFreqs: number[]
  phaseBandwidth: number
  ampBandwidth: number
  nSurrogates: number
  alpha: number
  /** Seconds analysed after trimming the filter's edge effects. */
  seconds: number
  trimmedSeconds: number
}

// ── FFT (iterative radix-2, in place) ─────────────────────────────────────────

function fft(re: Float64Array, im: Float64Array, inverse = false) {
  const n = re.length
  for (let i = 1, j = 0; i < n; i++) {
    let bit = n >> 1
    for (; j & bit; bit >>= 1) j ^= bit
    j ^= bit
    if (i < j) {
      ;[re[i], re[j]] = [re[j], re[i]]
      ;[im[i], im[j]] = [im[j], im[i]]
    }
  }
  for (let len = 2; len <= n; len <<= 1) {
    const ang = ((inverse ? 2 : -2) * Math.PI) / len
    const wr = Math.cos(ang), wi = Math.sin(ang)
    for (let i = 0; i < n; i += len) {
      let cr = 1, ci = 0
      for (let k = 0; k < len / 2; k++) {
        const a = i + k, b = a + len / 2
        const tr = re[b] * cr - im[b] * ci
        const ti = re[b] * ci + im[b] * cr
        re[b] = re[a] - tr; im[b] = im[a] - ti
        re[a] += tr; im[a] += ti
        const ncr = cr * wr - ci * wi
        ci = cr * wi + ci * wr; cr = ncr
      }
    }
  }
  if (inverse) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n }
}

/** Spectrum of a (mean-removed, zero-padded) signal, computed once and reused per band. */
function spectrum(signal: ArrayLike<number>) {
  const n = signal.length
  let size = 1
  while (size < n) size <<= 1
  const re = new Float64Array(size), im = new Float64Array(size)
  let mean = 0
  for (let i = 0; i < n; i++) mean += signal[i]
  mean /= n
  for (let i = 0; i < n; i++) re[i] = signal[i] - mean
  fft(re, im)
  return { re, im, n, size }
}

/** Phase and amplitude of the band [lo, hi] Hz: zero-phase band-pass → analytic signal. */
export function bandAnalytic(spec: ReturnType<typeof spectrum>, fs: number, lo: number, hi: number) {
  const { size, n } = spec
  const re = new Float64Array(size), im = new Float64Array(size)
  const taper = Math.max((hi - lo) * 0.1, fs / size)
  for (let k = 1; k < size / 2; k++) {
    const f = (k * fs) / size
    let w = 0
    if (f >= lo && f <= hi) w = 1
    else if (f > lo - taper && f < lo) w = 0.5 * (1 - Math.cos((Math.PI * (f - (lo - taper))) / taper))
    else if (f > hi && f < hi + taper) w = 0.5 * (1 + Math.cos((Math.PI * (f - hi)) / taper))
    if (w > 0) { re[k] = 2 * w * spec.re[k]; im[k] = 2 * w * spec.im[k] } // positive freqs only → analytic
  }
  fft(re, im, true)
  const phase = new Float64Array(n), amp = new Float64Array(n)
  for (let i = 0; i < n; i++) { phase[i] = Math.atan2(im[i], re[i]); amp[i] = Math.hypot(re[i], im[i]) }
  return { phase, amp }
}

/** Tort et al. (2010) modulation index. 0 = amplitude flat over phase, 1 = all in one bin. */
export function modulationIndex(phase: ArrayLike<number>, amp: ArrayLike<number>, nBins = 18): number {
  const sums = new Float64Array(nBins), counts = new Float64Array(nBins)
  for (let i = 0; i < phase.length; i++) {
    let b = Math.floor(((phase[i] + Math.PI) / (2 * Math.PI)) * nBins)
    if (b === nBins) b = nBins - 1
    sums[b] += amp[i]; counts[b]++
  }
  return miFromBins(sums, counts, nBins)
}

function miFromBins(sums: Float64Array, counts: Float64Array, nBins: number) {
  const means = new Float64Array(nBins)
  let total = 0
  for (let b = 0; b < nBins; b++) { means[b] = counts[b] ? sums[b] / counts[b] : 0; total += means[b] }
  if (total <= 0) return 0
  let h = 0
  for (let b = 0; b < nBins; b++) { const p = means[b] / total; if (p > 0) h -= p * Math.log(p) }
  return (Math.log(nBins) - h) / Math.log(nBins)
}

function mulberry32(seed: number) {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function computeComodulogram({
  signal, fs, phaseFreqs, phaseBandwidth = 2, ampFreqs, ampBandwidth,
  nSurrogates = 200, minShiftSeconds = 1, alpha = 0.05, nBins = 18, seed = 1,
}: ComodulogramInput): Comodulogram {
  if (!phaseFreqs.length || !ampFreqs.length) throw new Error("computeComodulogram: needs phase and amplitude frequencies")
  const bwA = ampBandwidth ?? 2 * Math.max(...phaseFreqs)
  const nyq = fs / 2
  if (Math.max(...ampFreqs) + bwA / 2 >= nyq) throw new Error("computeComodulogram: an amplitude band reaches Nyquist — lower the frequencies or the bandwidth")
  if (nSurrogates < Math.ceil(1 / alpha)) throw new Error(`computeComodulogram: ${nSurrogates} surrogates cannot resolve alpha = ${alpha}`)

  const spec = spectrum(signal)
  // Trim filter edge effects: three cycles of the slowest phase frequency at each end.
  const trim = Math.ceil((3 / Math.min(...phaseFreqs)) * fs)
  const n = spec.n - 2 * trim
  if (n < fs * 2 * minShiftSeconds) throw new Error("computeComodulogram: the signal is too short for its lowest phase frequency")
  const cut = (a: Float64Array) => a.subarray(trim, trim + n)

  const phases = phaseFreqs.map((f) => {
    const { phase } = bandAnalytic(spec, fs, Math.max(0.01, f - phaseBandwidth / 2), f + phaseBandwidth / 2)
    const p = cut(phase), bins = new Uint8Array(n)
    for (let i = 0; i < n; i++) { let b = Math.floor(((p[i] + Math.PI) / (2 * Math.PI)) * nBins); if (b === nBins) b = nBins - 1; bins[i] = b }
    return bins
  })
  const amps = ampFreqs.map((f) => cut(bandAnalytic(spec, fs, f - bwA / 2, f + bwA / 2).amp))

  const resolvable = ampFreqs.map((fa) => phaseFreqs.map((fp) =>
    bwA >= 2 * fp && fa - bwA / 2 > fp + phaseBandwidth / 2))

  const counts = phases.map((bins) => { const c = new Float64Array(nBins); for (let i = 0; i < n; i++) c[bins[i]]++; return c })
  const miAt = (ai: number, pi: number, shift: number) => {
    const bins = phases[pi], amp = amps[ai], sums = new Float64Array(nBins)
    for (let i = 0; i < n; i++) sums[bins[i]] += amp[(i + shift) % n]
    return miFromBins(sums, counts[pi], nBins)
  }

  const mi = ampFreqs.map((_, ai) => phaseFreqs.map((_, pi) => miAt(ai, pi, 0)))

  // Surrogates: one random circular shift per surrogate, applied to every cell, so the
  // per-surrogate maximum across the grid is a proper family-wise null.
  const rand = mulberry32(seed)
  const minShift = Math.round(minShiftSeconds * fs)
  const nullSum = mi.map((row) => row.map(() => 0)), nullSq = mi.map((row) => row.map(() => 0))
  const maxNull: number[] = []
  for (let s = 0; s < nSurrogates; s++) {
    const shift = minShift + Math.floor(rand() * (n - 2 * minShift))
    let mx = 0
    for (let ai = 0; ai < ampFreqs.length; ai++) {
      for (let pi = 0; pi < phaseFreqs.length; pi++) {
        if (!resolvable[ai][pi]) continue
        const v = miAt(ai, pi, shift)
        nullSum[ai][pi] += v; nullSq[ai][pi] += v * v
        if (v > mx) mx = v
      }
    }
    maxNull.push(mx)
  }
  const sortedMax = [...maxNull].sort((a, b) => a - b)
  const threshold = sortedMax[Math.min(sortedMax.length - 1, Math.ceil((1 - alpha) * sortedMax.length) - 1)]

  const z = mi.map((row, ai) => row.map((v, pi) => {
    if (!resolvable[ai][pi]) return NaN
    const m = nullSum[ai][pi] / nSurrogates
    const sd = Math.sqrt(Math.max(0, nullSq[ai][pi] / nSurrogates - m * m))
    return sd > 0 ? (v - m) / sd : NaN
  }))
  const pFamilywise = mi.map((row, ai) => row.map((v, pi) =>
    resolvable[ai][pi] ? (1 + maxNull.filter((x) => x >= v).length) / (1 + nSurrogates) : NaN))
  const significant = mi.map((row, ai) => row.map((v, pi) => resolvable[ai][pi] && v > threshold))

  return {
    mi, z, pFamilywise, significant, resolvable, threshold,
    phaseFreqs, ampFreqs, phaseBandwidth, ampBandwidth: bwA, nSurrogates, alpha,
    seconds: n / fs, trimmedSeconds: (2 * trim) / fs,
  }
}
