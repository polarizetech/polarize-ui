import { AxisBottom, AxisLeft } from "@visx/axis"
import { GridRows } from "@visx/grid"
import { Group } from "@visx/group"
import { scaleLinear } from "@visx/scale"
import { Bar, Line } from "@visx/shape"
import { INK, SERIES, TIER_COLOR, axisLabelProps, tickLabel } from "../charts/common"

/**
 * An observed statistic against its null: surrogates, permutations, a bootstrap under H0.
 *
 * What it states, because each is how a null test gets misread:
 *   · the observed value is drawn on the SAME axis as the null it is judged against;
 *   · p is the permutation p with the +1 correction, (1 + k) / (1 + n), and the count
 *     behind it is printed — a p-value without its n cannot be checked;
 *   · when no surrogate reached the observed value, p is at its floor 1/(n+1) and the
 *     panel says so: more surrogates, not a smaller p, is what that result supports;
 *   · the distance from the null in its own SDs (z) is printed beside p, because a
 *     p-value is not an effect size.
 */
export type NullDistributionProps = {
  /** The statistic computed on each surrogate / permutation. */
  nullValues: number[]
  /** The statistic computed on the real data. */
  observed: number
  /** Name of the statistic, with units — the x-axis label. */
  statistic: string
  /** Which tail counts as "at least as extreme". */
  alternative?: "greater" | "less" | "two-sided"
  alpha?: number
  bins?: number
  /** What the null was built from, e.g. "phase-randomised surrogates". */
  nullLabel?: string
  width?: number
  height?: number
  title?: string
}

const PAD = { l: 56, r: 16, t: 20, b: 40 }

function quantile(sorted: number[], q: number) {
  const i = (sorted.length - 1) * q
  const lo = Math.floor(i), hi = Math.ceil(i)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (i - lo)
}

export function nullTest(nullValues: number[], observed: number, alternative: "greater" | "less" | "two-sided" = "greater") {
  const n = nullValues.length
  if (n < 1) throw new Error("nullTest: the null needs at least one value")
  if (!nullValues.every(Number.isFinite) || !Number.isFinite(observed)) throw new Error("nullTest: non-finite value")
  const sorted = [...nullValues].sort((a, b) => a - b)
  const mean = nullValues.reduce((a, b) => a + b, 0) / n
  const sd = Math.sqrt(nullValues.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1))
  const centre = quantile(sorted, 0.5)
  const k = nullValues.filter((v) =>
    alternative === "greater" ? v >= observed
    : alternative === "less" ? v <= observed
    : Math.abs(v - centre) >= Math.abs(observed - centre)).length
  return { n, k, p: (1 + k) / (1 + n), atFloor: k === 0, z: sd > 0 ? (observed - mean) / sd : NaN, sorted, centre }
}

export function NullDistribution({
  nullValues, observed, statistic, alternative = "greater", alpha = 0.05, bins = 30,
  nullLabel = "surrogates", width = 720, height = 260, title,
}: NullDistributionProps) {
  const t = nullTest(nullValues, observed, alternative)
  const lo = Math.min(t.sorted[0], observed), hi = Math.max(t.sorted[t.n - 1], observed)
  const span = hi - lo || 1
  const xs = scaleLinear<number>({ domain: [lo - span * 0.04, hi + span * 0.04], range: [PAD.l, width - PAD.r] })

  const [d0, d1] = xs.domain()
  const w = (d1 - d0) / bins
  const counts = Array.from({ length: bins }, () => 0)
  for (const v of nullValues) counts[Math.min(bins - 1, Math.floor((v - d0) / w))]++
  const ys = scaleLinear<number>({ domain: [0, Math.max(...counts)], range: [height - PAD.b, PAD.t], nice: true })

  // Critical values at alpha, from the null itself.
  const crit: number[] =
    alternative === "greater" ? [quantile(t.sorted, 1 - alpha)]
    : alternative === "less" ? [quantile(t.sorted, alpha)]
    : [quantile(t.sorted, alpha / 2), quantile(t.sorted, 1 - alpha / 2)]

  const fmt = (v: number) => (Math.abs(v) >= 1000 || (Math.abs(v) < 0.01 && v !== 0) ? v.toExponential(2) : +v.toPrecision(3))
  const pText = t.p < 0.001 ? t.p.toExponential(1) : t.p.toFixed(3)
  const tail = alternative === "two-sided" ? "two-sided" : `one-sided, ${alternative}`

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={title ?? `${statistic}: observed against ${t.n} ${nullLabel}`}>
        {title && <title>{title}</title>}
        <GridRows scale={ys} left={PAD.l} width={width - PAD.l - PAD.r} numTicks={4} stroke={INK.axis} strokeOpacity={0.6} />
        {counts.map((c, i) => {
          const x0 = xs(d0 + i * w), x1 = xs(d0 + (i + 1) * w)
          return (
            <Bar key={i} x={x0 + 1} y={ys(c)} width={Math.max(0, x1 - x0 - 2)} height={ys(0) - ys(c)} fill={SERIES[0]} fillOpacity={0.55} rx={1}>
              <title>{`${fmt(d0 + i * w)} to ${fmt(d0 + (i + 1) * w)}: ${c} ${nullLabel}`}</title>
            </Bar>
          )
        })}
        {crit.map((v, i) => (
          <Group key={i}>
            <Line from={{ x: xs(v), y: PAD.t }} to={{ x: xs(v), y: height - PAD.b }} stroke={TIER_COLOR.refuted} strokeDasharray="4 3" />
            {i === crit.length - 1 && (
              <text x={xs(v) + (xs(v) > width - PAD.r - 70 ? -4 : 4)} y={PAD.t + 10} textAnchor={xs(v) > width - PAD.r - 70 ? "end" : "start"}
                fill={TIER_COLOR.refuted} fontSize={10} fontFamily="var(--font-mono)">α = {alpha}</text>
            )}
          </Group>
        ))}
        <Line from={{ x: xs(observed), y: PAD.t - 6 }} to={{ x: xs(observed), y: height - PAD.b }} stroke={TIER_COLOR.measured} strokeWidth={2.5} />
        {(() => {
          // Keep the label on the plot: flip to the left of the line near the right edge.
          const flip = xs(observed) > width - PAD.r - 110
          return (
            <text x={xs(observed) + (flip ? -4 : 4)} y={PAD.t + 24} textAnchor={flip ? "end" : "start"}
              fill={TIER_COLOR.measured} fontSize={10} fontFamily="var(--font-mono)">observed {fmt(observed)}</text>
          )
        })()}
        <AxisBottom top={height - PAD.b} scale={xs} numTicks={6} stroke={INK.axis} tickStroke={INK.axis}
          tickLabelProps={tickLabel} label={statistic} labelProps={axisLabelProps} tickFormat={(v) => String(fmt(Number(v)))} />
        <AxisLeft left={PAD.l} scale={ys} numTicks={4} stroke={INK.axis} tickStroke={INK.axis}
          tickLabelProps={{ ...tickLabel, textAnchor: "end", dx: -4, dy: 3 }} label={`${nullLabel} (count)`} labelProps={axisLabelProps} labelOffset={36} />
      </svg>
      <figcaption className="mt-1 font-mono text-[length:var(--text-xs)] text-muted-foreground tabular-nums">
        p = {pText} = (1 + {t.k}) / (1 + {t.n}) · {tail} · z = {Number.isFinite(t.z) ? t.z.toFixed(2) : "n/a"} from the null mean
        {t.atFloor && (
          <span className="block">
            No {nullLabel.replace(/s$/, "")} reached the observed value, so p is at its floor 1/(n + 1). Only more {nullLabel} can
            resolve a smaller p.
          </span>
        )}
      </figcaption>
    </figure>
  )
}
