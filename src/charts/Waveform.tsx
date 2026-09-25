import * as React from "react"
import { scaleLinear } from "@visx/scale"
import { AreaClosed, LinePath } from "@visx/shape"

/**
 * A sample trace with a playhead and optional marked regions. Samples are drawn as given —
 * pass decimated data yourself and say so, the same rule as the charts.
 */
export function Waveform({
  samples, progress = 0, regions = [], height = 96, width = 720,
}: {
  samples: number[]
  progress?: number
  regions?: { start: number; end: number; label: string; kind?: "annotation" | "attention" }[]
  height?: number
  width?: number
}) {
  const xs = scaleLinear<number>({ domain: [0, samples.length - 1], range: [0, width] })
  const peak = Math.max(1e-12, ...samples.map(Math.abs))
  const ys = scaleLinear<number>({ domain: [-peak, peak], range: [height - 4, 4] })
  const px = progress * width
  const pts = samples.map((v, i) => [i, v] as [number, number])
  return (
    <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label="waveform" className="rounded-md bg-muted">
      <defs>
        <clipPath id="wf-played"><rect x={0} y={0} width={px} height={height} /></clipPath>
      </defs>
      {regions.map((r) => (
        <g key={r.label}>
          <rect x={r.start * width} width={(r.end - r.start) * width} y={0} height={height}
            fill={r.kind === "attention" ? "var(--chart-2)" : "var(--chart-4)"} opacity={0.16} />
          <text x={r.start * width + 4} y={12} fontSize={9} fontFamily="var(--font-mono)" fill="var(--muted-foreground)">{r.label}</text>
        </g>
      ))}
      <LinePath data={pts} x={(p) => xs(p[0])} y={(p) => ys(p[1])} stroke="var(--muted-foreground)" strokeOpacity={0.5} strokeWidth={1} />
      <g clipPath="url(#wf-played)">
        <AreaClosed data={pts} x={(p) => xs(p[0])} y={(p) => ys(p[1])} yScale={ys} fill="var(--primary)" fillOpacity={0.12} />
        <LinePath data={pts} x={(p) => xs(p[0])} y={(p) => ys(p[1])} stroke="var(--primary)" strokeWidth={1} />
      </g>
      <line x1={px} x2={px} y1={0} y2={height} stroke="var(--primary)" strokeWidth={1.5} />
    </svg>
  )
}
