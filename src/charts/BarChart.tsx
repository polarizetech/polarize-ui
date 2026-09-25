import * as React from "react"
import { AxisBottom, AxisLeft } from "@visx/axis"
import { GridRows } from "@visx/grid"
import { Group } from "@visx/group"
import { scaleBand } from "@visx/scale"
import { Bar, Line } from "@visx/shape"
import {
  type AxisSpec, INK, Legend, PAD, SERIES, TIER_COLOR, type TierFamily,
  axisLabel, axisLabelProps, makeScale, tickLabel,
} from "./common"

export type BarDatum = { category: string; value: number; tier?: TierFamily }

export function BarChart({
  data, y = {}, xLabel, threshold, width = 720, height = 240, title, valueFormat = (v: number) => String(v),
}: {
  data: BarDatum[]
  y?: AxisSpec
  xLabel?: string
  threshold?: { value: number; label: string; tier?: TierFamily }
  width?: number
  height?: number
  title?: string
  valueFormat?: (v: number) => string
}) {
  // x is a CATEGORY and is never coerced to a number — +'1 hour' is NaN, and NaN stacks every
  // bar at x=0 while every count and width still looks right.
  const xs = scaleBand<string>({ domain: data.map((d) => d.category), range: [PAD.l, width - PAD.r], padding: 0.25 })
  const vals = [0, ...data.map((d) => d.value), ...(threshold ? [threshold.value] : [])]
  const ys = makeScale({ ...y, domain: y.domain ?? (y.type === "log" ? undefined : [0, Math.max(...vals)]) },
    y.type === "log" ? vals.filter((v) => v > 0) : vals, [height - PAD.b, PAD.t])
  const base = ys.range()[0] as number

  // A tier colour is never the only channel: any bar coloured by tier gets a named legend.
  const families = [...new Set(data.map((d) => d.tier).filter(Boolean))] as TierFamily[]
  return (
    <figure className="m-0">
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={title}>
      {title && <title>{title}</title>}
      <GridRows scale={ys} left={PAD.l} width={width - PAD.l - PAD.r} numTicks={4} stroke={INK.axis} strokeOpacity={0.6} />
      {data.map((d) => {
        const x0 = xs(d.category), yv = ys(d.value)
        if (x0 === undefined || !Number.isFinite(yv)) {
          throw new Error(`chart: ${JSON.stringify(d)} is off this chart's scales`)
        }
        const color = d.tier ? TIER_COLOR[d.tier] : SERIES[0]
        return (
          <Group key={d.category}>
            <Bar x={x0} y={Math.min(yv, base)} width={xs.bandwidth()} height={Math.abs(base - yv)} fill={color} rx={2} />
            <text x={x0 + xs.bandwidth() / 2} y={yv - 5} textAnchor="middle" fontSize={10} fontFamily="var(--font-mono)" fill="var(--foreground)">
              {valueFormat(d.value)}
            </text>
          </Group>
        )
      })}
      {threshold && (() => {
        const v = ys(threshold.value), c = TIER_COLOR[threshold.tier ?? "refuted"]
        return (
          <Group>
            <Line from={{ x: PAD.l, y: v }} to={{ x: width - PAD.r, y: v }} stroke={c} strokeDasharray="4 3" />
            <text x={width - PAD.r} y={v - 5} textAnchor="end" fill={c} fontSize={10} fontFamily="var(--font-mono)">{threshold.label}</text>
          </Group>
        )
      })()}
      <AxisBottom top={height - PAD.b} scale={xs} stroke={INK.axis} tickStroke={INK.axis} tickLabelProps={tickLabel}
        label={xLabel} labelProps={axisLabelProps} />
      <AxisLeft left={PAD.l} scale={ys} numTicks={4} stroke={INK.axis} tickStroke={INK.axis}
        tickLabelProps={{ ...tickLabel, textAnchor: "end", dx: -4, dy: 3 }} label={axisLabel(y)} labelProps={axisLabelProps} labelOffset={36} />
    </svg>
    {families.length > 0 && <Legend items={families.map((f) => ({ label: f, color: TIER_COLOR[f] }))} />}
    </figure>
  )
}
