import { AxisBottom } from "@visx/axis"
import { scaleLinear } from "@visx/scale"
import { INK, PAD, SERIES, axisLabelProps, tickLabel } from "../charts/common"

/**
 * Events as tick marks, one row per source: detected beats per detector, spikes per unit,
 * button presses per participant. The standard raster.
 *
 * It uses the same width and side padding as `LineChart`, so placed directly under a trace with
 * the same x domain its ticks line up with the trace in time. Rules:
 *   · every row is named, and the count of events in view is printed beside the name;
 *   · events outside the x domain are not drawn and are counted on the panel, never dropped silently;
 *   · a reference row (the labels others are judged against) is marked as such, not just coloured.
 */
export type RasterRow = { label: string; times: number[]; color?: string; reference?: boolean }

export function EventRaster({
  rows, x, width = 720, rowHeight = 28, title,
}: {
  rows: RasterRow[]
  x: { domain: [number, number]; label: string; format?: (v: number) => string }
  width?: number
  rowHeight?: number
  title?: string
}) {
  if (!rows.length) throw new Error("EventRaster: needs at least one row")
  if (!(x.domain[1] > x.domain[0])) throw new Error("EventRaster: x domain must have hi > lo")
  const top = 6
  const height = top + rows.length * rowHeight + 36
  const xs = scaleLinear<number>({ domain: x.domain, range: [PAD.l, width - PAD.r] })
  const inView = (t: number) => t >= x.domain[0] && t <= x.domain[1]
  const outside = rows.reduce((n, r) => n + r.times.filter((t) => !inView(t)).length, 0)
  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={title ?? `events by ${x.label}`}>
        {title && <title>{title}</title>}
        {rows.map((r, k) => {
          const y = top + k * rowHeight
          const color = r.color ?? SERIES[k % SERIES.length]
          const shown = r.times.filter(inView)
          return (
            <g key={r.label} data-row={r.label}>
              {/* the name sits ABOVE its row, so it never covers an event */}
              <text x={PAD.l} y={y + 9} fill={INK.label} fontSize={9} fontFamily="var(--font-mono)">
                {r.label}{r.reference ? " (reference)" : ""} · {shown.length} in view
              </text>
              <line x1={PAD.l} x2={width - PAD.r} y1={y + 19} y2={y + 19} stroke={INK.axis} strokeOpacity={0.5} />
              {shown.map((t, i) => (
                <line key={i} x1={xs(t)} x2={xs(t)} y1={y + 12} y2={y + rowHeight - 2} stroke={color} strokeWidth={r.reference ? 2.5 : 1.75} />
              ))}
            </g>
          )
        })}
        <AxisBottom top={top + rows.length * rowHeight} scale={xs} numTicks={6} stroke={INK.axis} tickStroke={INK.axis}
          tickLabelProps={tickLabel} label={x.label} labelProps={axisLabelProps}
          tickFormat={x.format ? (v) => x.format!(Number(v)) : undefined} />
      </svg>
      {outside > 0 && (
        <p className="m-0 font-mono text-[length:var(--text-xs)] text-muted-foreground" data-note="">
          {outside} events outside the time range not drawn
        </p>
      )}
    </figure>
  )
}
