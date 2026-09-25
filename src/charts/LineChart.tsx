import * as React from "react"
import { AxisBottom, AxisLeft } from "@visx/axis"
import { GridRows } from "@visx/grid"
import { Group } from "@visx/group"
import { Line, LinePath } from "@visx/shape"
import { curveLinear, curveMonotoneX } from "@visx/curve"
import { decimate, type Pt } from "./decimate"
import {
  type AxisSpec, INK, Legend, PAD, PanelNotes, SERIES, TIER_COLOR, type TierFamily,
  axisLabel, axisLabelProps, decadeTicks, makeScale, tickLabel,
} from "./common"

export type Series = { label: string; points: Pt[]; color?: string; dash?: boolean; curve?: "linear" | "monotone" }
export type Threshold = { value: number; axis?: "x" | "y"; label: string; tier?: TierFamily }

export type LineChartProps = {
  series: Series[]
  x?: AxisSpec
  y?: AxisSpec
  /** Drawn on the SAME axes as the series they judge — never quoted in prose beside the chart. */
  thresholds?: Threshold[]
  /** Above this a trace is thinned by LTTB and the panel SAYS SO. */
  maxPoints?: number
  /** "shared" / "independent" is printed on the panel; see sharedDomain(). */
  scaleNote?: "shared" | "independent"
  width?: number
  height?: number
  title?: string
}

export function LineChart({
  series, x = {}, y = {}, thresholds = [], maxPoints = 2000, scaleNote,
  width = 720, height = 260, title,
}: LineChartProps) {
  const notes: string[] = []
  const prepared = series.map((s) => {
    for (const p of s.points) {
      if (!Number.isFinite(p[0]) || !Number.isFinite(p[1])) {
        throw new Error(`chart: ${JSON.stringify(p)} in "${s.label}" is not a finite coordinate`)
      }
    }
    const cut = decimate(s.points, maxPoints)
    if (cut.length < s.points.length) notes.push(`${s.label}: decimated for display, ${s.points.length} → ${cut.length} points`)
    return { ...s, points: cut }
  })
  if (scaleNote === "shared") notes.push("shared Y scale")
  if (scaleNote === "independent") notes.push("INDEPENDENT SCALE — panels are NOT comparable")

  const all = prepared.flatMap((s) => s.points)
  const xs = makeScale(x, all.map((p) => p[0]), [PAD.l, width - PAD.r])
  const yVals = [...all.map((p) => p[1]), ...thresholds.filter((t) => (t.axis ?? "y") === "y").map((t) => t.value)]
  const ys = makeScale(y, yVals, [height - PAD.b, PAD.t])

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={title}>
        {title && <title>{title}</title>}
        <GridRows scale={ys} left={PAD.l} width={width - PAD.l - PAD.r} numTicks={4} tickValues={decadeTicks(y, ys)} stroke={INK.axis} strokeOpacity={0.6} />
        {prepared.map((s, i) => (
          <LinePath<Pt>
            key={s.label}
            data={s.points}
            x={(p) => xs(p[0]) ?? 0}
            y={(p) => ys(p[1]) ?? 0}
            curve={s.curve === "monotone" ? curveMonotoneX : curveLinear}
            stroke={s.color ?? SERIES[i % SERIES.length]}
            strokeWidth={1.75}
            strokeDasharray={s.dash ? "5 3" : undefined}
            strokeLinejoin="round"
            fill="none"
            data-label={s.label}
          />
        ))}
        {thresholds.map((t) => {
          const color = TIER_COLOR[t.tier ?? "refuted"]
          if ((t.axis ?? "y") === "y") {
            const v = ys(t.value) ?? 0
            return (
              <Group key={t.label}>
                <Line from={{ x: PAD.l, y: v }} to={{ x: width - PAD.r, y: v }} stroke={color} strokeDasharray="4 3" />
                <text x={PAD.l + 6} y={v - 5} fill={color} fontSize={10} fontFamily="var(--font-mono)">{t.label}</text>
              </Group>
            )
          }
          const v = xs(t.value) ?? 0
          return (
            <Group key={t.label}>
              <Line from={{ x: v, y: PAD.t }} to={{ x: v, y: height - PAD.b }} stroke={color} strokeDasharray="4 3" />
              <text x={v + 4} y={height - PAD.b - 6} fill={color} fontSize={10} fontFamily="var(--font-mono)">{t.label}</text>
            </Group>
          )
        })}
        <AxisBottom
          top={height - PAD.b} scale={xs} numTicks={6} tickValues={decadeTicks(x, xs)} stroke={INK.axis} tickStroke={INK.axis}
          tickLabelProps={tickLabel} label={axisLabel(x)} labelProps={axisLabelProps}
          tickFormat={x.format ? (v) => x.format!(Number(v)) : undefined}
        />
        <AxisLeft
          left={PAD.l} scale={ys} numTicks={4} tickValues={decadeTicks(y, ys)} stroke={INK.axis} tickStroke={INK.axis}
          tickLabelProps={{ ...tickLabel, textAnchor: "end", dx: -4, dy: 3 }}
          label={axisLabel(y)} labelProps={axisLabelProps} labelOffset={36}
          tickFormat={y.format ? (v) => y.format!(Number(v)) : undefined}
        />
        <PanelNotes notes={notes} x={width - PAD.r} y={PAD.t + 10} />
      </svg>
      {prepared.length > 1 && (
        <Legend items={prepared.map((s, i) => ({ label: s.label, color: s.color ?? SERIES[i % SERIES.length], dash: s.dash }))} />
      )}
    </figure>
  )
}

/** One y domain across several panels. Pass it to each panel's `y.domain` with scaleNote="shared". */
export function sharedDomain(...groups: Series[][]): [number, number] {
  const ys = groups.flat().flatMap((s) => s.points.map((p) => p[1]))
  return [Math.min(...ys), Math.max(...ys)]
}
