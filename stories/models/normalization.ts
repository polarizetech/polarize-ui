/**
 * Divisive normalization (Heeger 1992; Carandini & Heeger 2012), the textbook model of how a
 * population shares its response between two stimuli. Each unit has a preferred value along
 * one axis (orientation, frequency…) and a Gaussian tuning curve. Its drive is the sum of both
 * stimuli seen through that tuning; its response is its drive raised to n, divided by a
 * constant plus the pooled drive of the whole population:
 *
 *     r_i = r_max · d_iⁿ / (σⁿ + (1/N) Σ_j d_jⁿ)
 *
 * Everything here is MODELLED. No parameter was fitted to data; the defaults sit in the
 * ranges the reviews give (n ≈ 2, σ a fraction of full contrast).
 */
export type NormParams = {
  contrastA: number // 0–1
  contrastB: number // 0–1
  posA: number // preferred-value axis, 0–1
  posB: number
  tuningWidth: number // SD of the Gaussian tuning, same axis
  exponent: number // n
  sigma: number // semi-saturation, contrast units
  units?: number
}

export function population(p: NormParams) {
  const N = p.units ?? 80
  const pref = Array.from({ length: N }, (_, i) => i / (N - 1))
  const g = (x: number, mu: number) => Math.exp(-((x - mu) ** 2) / (2 * p.tuningWidth ** 2))
  const driveA = pref.map((x) => p.contrastA * g(x, p.posA))
  const driveB = pref.map((x) => p.contrastB * g(x, p.posB))
  const drive = driveA.map((a, i) => a + driveB[i])
  const pool = drive.reduce((s, d) => s + d ** p.exponent, 0) / N
  const denom = p.sigma ** p.exponent + pool
  const resp = drive.map((d) => d ** p.exponent / denom)
  // The model does not say which stimulus a unit's response "belongs" to. The readout is
  // spatial instead: the summed response of the units whose preferred value is nearer A,
  // and of those nearer B.
  const nearerA = pref.map((x) => Math.abs(x - p.posA) < Math.abs(x - p.posB))
  const totalA = resp.reduce((s, r, i) => s + (nearerA[i] ? r : 0), 0)
  const totalB = resp.reduce((s, r, i) => s + (nearerA[i] ? 0 : r), 0)
  return { pref, driveA, driveB, drive, resp, nearerA, totalA, totalB }
}

/** Summed response of the units nearer A as A's contrast rises, B held at `contrastB`. */
export function contrastResponse(p: NormParams, steps = 41) {
  return Array.from({ length: steps }, (_, i) => {
    const c = i / (steps - 1)
    return [c, population({ ...p, contrastA: c }).totalA] as [number, number]
  })
}
