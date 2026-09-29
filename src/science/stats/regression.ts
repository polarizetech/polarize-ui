/**
 * Ordinary least-squares fit of y on x, with the intervals a scatter plot needs.
 *
 * Kept separate from the chart so the numbers can be used, and checked, without it.
 * The Student-t distribution is implemented here (regularized incomplete beta), so
 * intervals are exact t intervals, not a normal approximation — that matters most
 * at the small n typical of a bench.
 */

export type Pair = [number, number]

export type LinearFit = {
  n: number
  df: number
  slope: number
  intercept: number
  /** Standard error of the slope. */
  slopeSE: number
  /** Confidence interval for the slope at `level`. */
  slopeCI: [number, number]
  r: number
  r2: number
  /** Two-sided p for H0: slope = 0 (t test, df = n - 2). */
  p: number
  level: number
  /** The t critical value used for every interval. */
  tCrit: number
  xRange: [number, number]
  /** Fitted value and its interval at x. `kind` "confidence" is the band for the fitted
   *  mean; "prediction" is where a NEW single observation is expected to fall. */
  at: (x: number, kind?: "confidence" | "prediction") => { y: number; lo: number; hi: number }
}

// ── Student t, from the regularized incomplete beta (Numerical Recipes betacf) ──

function logGamma(z: number): number {
  const c = [76.18009172947146, -86.50532032941677, 24.01409824083091,
    -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5]
  let x = z, y = z
  let tmp = x + 5.5
  tmp -= (x + 0.5) * Math.log(tmp)
  let ser = 1.000000000190015
  for (const cj of c) ser += cj / ++y
  return -tmp + Math.log((2.5066282746310005 * ser) / x)
}

function betacf(a: number, b: number, x: number): number {
  const MAXIT = 300, EPS = 3e-16, FPMIN = 1e-300
  const qab = a + b, qap = a + 1, qam = a - 1
  let c = 1, d = 1 - (qab * x) / qap
  if (Math.abs(d) < FPMIN) d = FPMIN
  d = 1 / d
  let h = d
  for (let m = 1; m <= MAXIT; m++) {
    const m2 = 2 * m
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d; h *= d * c
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2))
    d = 1 + aa * d; if (Math.abs(d) < FPMIN) d = FPMIN
    c = 1 + aa / c; if (Math.abs(c) < FPMIN) c = FPMIN
    d = 1 / d
    const del = d * c
    h *= del
    if (Math.abs(del - 1) < EPS) break
  }
  return h
}

/** Regularized incomplete beta I_x(a, b). */
function betaInc(x: number, a: number, b: number): number {
  if (x <= 0) return 0
  if (x >= 1) return 1
  const bt = Math.exp(logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x))
  return x < (a + 1) / (a + b + 2) ? (bt * betacf(a, b, x)) / a : 1 - (bt * betacf(b, a, 1 - x)) / b
}

/** Two-sided tail probability P(|T| >= |t|) for Student t with df degrees of freedom. */
export function tTwoSidedP(t: number, df: number): number {
  return betaInc(df / (df + t * t), df / 2, 0.5)
}

/** Quantile of Student t: the value q with P(T <= q) = prob. */
export function tQuantile(prob: number, df: number): number {
  if (!(prob > 0 && prob < 1)) throw new Error("tQuantile: prob must be in (0, 1)")
  if (prob === 0.5) return 0
  const upper = prob > 0.5
  const target = 2 * (upper ? 1 - prob : prob) // two-sided tail mass beyond |q|
  let lo = 0, hi = 1
  while (tTwoSidedP(hi, df) > target) hi *= 2
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2
    if (tTwoSidedP(mid, df) > target) lo = mid
    else hi = mid
  }
  const q = (lo + hi) / 2
  return upper ? q : -q
}

// ── The fit ──────────────────────────────────────────────────────────────────

export function linearFit(points: Pair[], level = 0.95): LinearFit {
  if (!(level > 0 && level < 1)) throw new Error("linearFit: level must be in (0, 1)")
  for (const p of points) {
    if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) {
      throw new Error(`linearFit: ${JSON.stringify(p)} is not a finite pair`)
    }
  }
  const n = points.length
  if (n < 3) throw new Error("linearFit: needs at least 3 points — with 2 the line fits exactly and has no interval")
  const mx = points.reduce((s, p) => s + p[0], 0) / n
  const my = points.reduce((s, p) => s + p[1], 0) / n
  let sxx = 0, sxy = 0, syy = 0
  for (const [x, y] of points) {
    sxx += (x - mx) ** 2
    sxy += (x - mx) * (y - my)
    syy += (y - my) ** 2
  }
  if (sxx === 0) throw new Error("linearFit: every x is the same, so there is no slope to fit")
  const slope = sxy / sxx
  const intercept = my - slope * mx
  const df = n - 2
  const sse = points.reduce((s, [x, y]) => s + (y - (intercept + slope * x)) ** 2, 0)
  const s = Math.sqrt(sse / df) // residual standard error
  const slopeSE = s / Math.sqrt(sxx)
  const tCrit = tQuantile(1 - (1 - level) / 2, df)
  const r = syy === 0 ? NaN : sxy / Math.sqrt(sxx * syy)
  const tStat = slopeSE === 0 ? Infinity : slope / slopeSE
  const p = Number.isFinite(tStat) ? tTwoSidedP(tStat, df) : 0
  const xs = points.map((q) => q[0])

  return {
    n, df, slope, intercept, slopeSE,
    slopeCI: [slope - tCrit * slopeSE, slope + tCrit * slopeSE],
    r, r2: r * r, p, level, tCrit,
    xRange: [Math.min(...xs), Math.max(...xs)],
    at(x, kind = "confidence") {
      const y = intercept + slope * x
      const lever = 1 / n + (x - mx) ** 2 / sxx
      const se = s * Math.sqrt(kind === "prediction" ? 1 + lever : lever)
      return { y, lo: y - tCrit * se, hi: y + tCrit * se }
    },
  }
}
