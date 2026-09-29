import * as React from "react"
import { AxisBottom, AxisLeft } from "@visx/axis"
import { GridRows } from "@visx/grid"
import { Area, LinePath } from "@visx/shape"
import { linearFit, type LinearFit, type Pair } from "../stats/regression"
import { type AxisSpec, INK, PAD, SERIES, axisLabel, axisLabelProps, makeScale, tickLabel } from "./common"

/**
 * A scatter with an ordinary least-squares fit and its interval band.
 *
 * What it states, because each is how a fitted line gets misread:
 *   · WHICH band is drawn. "confidence" is uncertainty in the fitted mean line; it narrows
 *     with n and says nothing about where the next point will land. "prediction" is where a
 *     new single observation is expected to fall. Both are labelled on the panel.
 *   · The fit is drawn only across the x range that was measured — never extrapolated.
 *   · n, the slope with its interval, r, R² and the slope's p are printed. p comes with its
 *     t test and df; R² is shown beside it because a small p is not a strong relationship.
 *   · Every point is drawn. A scatter is not thinned for display.
 *   · Axes are linear: a straight line fitted to linear data. A log axis would show a curve
 *     that is not the model, so it is refused.
 */
export type ScatterPlotProps = {
  points: Pair[]
  x: AxisSpec & { label: string }
  y: AxisSpec & { label: string }
  /** Band(s) around the fit. Default "confidence". "none" draws the line only. */
  band?: "confidence" | "prediction" | "both" | "none"
  /** Interval level for the band and the slope interval. Default 0.95. */
  level?: number
  /** Omit the fit entirely (points only). */
  fit?: boolean
  width?: number
  height?: number
  title?: string
}

const fmt = (v: number) =>
  !Number.isFinite(v) ? "n/a"
  : Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(2)
  : String(+v.toPrecision(3))

const fmtP = (p: number) => (p < 1e-4 ? p.toExponential(1) : p < 0.001 ? p.toFixed(4) : p.toFixed(3))

export function ScatterPlot({
  points, x, y, band = "confidence", level = 0.95, fit = true, width = 720, height = 300, title,
}: ScatterPlotProps) {
  if (x.type === "log" || y.type === "log") {
    throw new Error("ScatterPlot: a straight-line fit is drawn on linear axes; a log axis would show a curve that is not the model")
  }
  const [hover, setHover] = React.useState<number | null>(null)
  const f: LinearFit | null = fit ? linearFit(points, level) : null

  // The band must fit on the plot: include it in the y domain unless the caller fixed one.
  const steps = 60
  const bandX = f ? Array.from({ length: steps + 1 }, (_, i) => f.xRange[0] + ((f.xRange[1] - f.xRange[0]) * i) / steps) : []
  const kinds: ("confidence" | "prediction")[] =
    !f || band === "none" ? [] : band === "both" ? ["prediction", "confidence"] : [band]
  const bands = kinds.map((k) => ({ kind: k, rows: bandX.map((xv) => ({ x: xv, ...f!.at(xv, k) })) }))
  const yValues = [...points.map((p) => p[1]), ...bands.flatMap((b) => b.rows.flatMap((r) => [r.lo, r.hi]))]

  const xs = makeScale(x, points.map((p) => p[0]), [PAD.l, width - PAD.r])
  const ys = makeScale(y, yValues, [height - PAD.b, PAD.t])
  const colour = SERIES[0]
  const pct = `${Math.round(level * 100)}%`

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={title ?? `${y.label} against ${x.label}`}>
        {title && <title>{title}</title>}
        <GridRows scale={ys} left={PAD.l} width={width - PAD.l - PAD.r} numTicks={4} stroke={INK.axis} strokeOpacity={0.6} />
        {bands.map((b) => (
          <Area
            key={b.kind}
            data={b.rows}
            x={(r) => xs(r.x) ?? 0}
            y0={(r) => ys(r.lo) ?? 0}
            y1={(r) => ys(r.hi) ?? 0}
            fill={colour}
            fillOpacity={b.kind === "prediction" ? 0.08 : 0.2}
            stroke={b.kind === "prediction" ? colour : "none"}
            strokeOpacity={0.5}
            strokeDasharray={b.kind === "prediction" ? "4 3" : undefined}
          />
        ))}
        {f && (
          <LinePath
            data={[f.xRange[0], f.xRange[1]]}
            x={(v) => xs(v) ?? 0}
            y={(v) => ys(f.intercept + f.slope * v) ?? 0}
            stroke={colour}
            strokeWidth={2}
          />
        )}
        {points.map((p, i) => (
          <g key={i}>
            <circle cx={xs(p[0])} cy={ys(p[1])} r={hover === i ? 6 : 4} fill={colour} stroke="var(--background)" strokeWidth={2} />
            {/* A hit target bigger than the mark. */}
            <circle cx={xs(p[0])} cy={ys(p[1])} r={10} fill="transparent"
              onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover((h) => (h === i ? null : h))} />
          </g>
        ))}
        <AxisBottom top={height - PAD.b} scale={xs} numTicks={6} stroke={INK.axis} tickStroke={INK.axis}
          tickLabelProps={tickLabel} label={axisLabel(x)} labelProps={axisLabelProps}
          tickFormat={x.format ? (v) => x.format!(Number(v)) : undefined} />
        <AxisLeft left={PAD.l} scale={ys} numTicks={4} stroke={INK.axis} tickStroke={INK.axis}
          tickLabelProps={{ ...tickLabel, textAnchor: "end", dx: -4, dy: 3 }} label={axisLabel(y)} labelProps={axisLabelProps} labelOffset={36}
          tickFormat={y.format ? (v) => y.format!(Number(v)) : undefined} />
      </svg>
      <div className="mt-1 space-y-0.5 font-mono text-[length:var(--text-xs)] text-muted-foreground tabular-nums">
        {f ? (
          <>
            <p className="m-0">
              n = {f.n} · slope {fmt(f.slope)} [{fmt(f.slopeCI[0])}, {fmt(f.slopeCI[1])}] ({pct} CI) · intercept {fmt(f.intercept)} ·
              r = {fmt(f.r)} · R² = {fmt(f.r2)} · p = {fmtP(f.p)} (t test on the slope, df = {f.df})
            </p>
            <p className="m-0" data-note="">
              {kinds.length === 0 && "Least-squares fit, no band. "}
              {kinds.includes("confidence") && `Solid band: ${pct} confidence band for the fitted line, not for individual points. `}
              {kinds.includes("prediction") && `Dashed band: ${pct} prediction band, where a new single observation is expected to fall. `}
              Fit drawn over the measured x range only.
            </p>
          </>
        ) : (
          <p className="m-0">n = {points.length} · points only, no fit</p>
        )}
        <p className="m-0 h-4" aria-live="polite">
          {hover !== null
            ? `${x.label}: ${fmt(points[hover][0])} · ${y.label}: ${fmt(points[hover][1])}${f ? ` · residual ${fmt(points[hover][1] - (f.intercept + f.slope * points[hover][0]))}` : ""}`
            : "Hover a point to read it."}
        </p>
      </div>
    </figure>
  )
}
