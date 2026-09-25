import * as React from "react"
import { scaleLinear, scaleLog } from "@visx/scale"

/** Series colours come from the theme (tokens.json → shadcn/theme.css). Never a literal. */
export const SERIES = [1, 2, 3, 4, 5].map((n) => `var(--chart-${n})`)
/** Epistemic colours. A tier is a word as well as a hue. */
export const TIER_COLOR = {
  measured: "var(--tier-measured)",
  predicted: "var(--tier-predicted)",
  exploring: "var(--tier-exploring)",
  spec: "var(--tier-spec)",
  refuted: "var(--tier-refuted)",
} as const
export type TierFamily = keyof typeof TIER_COLOR

export const INK = { axis: "var(--border)", label: "var(--muted-foreground)" }

export type AxisSpec = { type?: "linear" | "log"; domain?: [number, number]; label?: string; format?: (v: number) => string }

export const PAD = { l: 56, r: 16, t: 16, b: 40 }

/** A log axis ANNOUNCES ITSELF in its own label. */
export function axisLabel(spec: AxisSpec) {
  const text = spec.label ?? ""
  return spec.type === "log" && !/log/i.test(text) ? `${text} (log)`.trim() : text
}

export function makeScale(spec: AxisSpec, values: number[], range: [number, number]) {
  const lo = spec.domain?.[0] ?? Math.min(...values)
  const hi = spec.domain?.[1] ?? Math.max(...values)
  if (!Number.isFinite(lo) || !Number.isFinite(hi)) throw new Error("chart: axis has no finite values to scale")
  if (spec.type === "log") {
    // Refuse rather than clamp: a log axis over zero or a negative is not a picture of anything.
    if (lo <= 0 || hi <= 0) throw new Error("chart: a log axis needs a strictly positive domain")
    return scaleLog<number>({ domain: [lo, hi], range })
  }
  return scaleLinear<number>({ domain: [lo, hi], range, nice: !spec.domain })
}

export const tickLabel = { fill: INK.label, fontSize: 10, fontFamily: "var(--font-mono)" } as const
export const axisLabelProps = { fill: INK.label, fontSize: 11, fontFamily: "var(--font-sans)", textAnchor: "middle" } as const

/** Notes printed on the panel itself — decimation, shared or independent scale. Never silent. */
export function PanelNotes({ notes, x, y }: { notes: string[]; x: number; y: number }) {
  return (
    <>
      {notes.map((n, i) => (
        <text key={n} data-note="" x={x} y={y + i * 12} textAnchor="end" fill={INK.label} fontSize={9} fontFamily="var(--font-mono)">
          {n}
        </text>
      ))}
    </>
  )
}

/** Legend: colour AND name, so hue is never load-bearing. */
export function Legend({ items }: { items: { label: string; color: string; dash?: boolean }[] }) {
  return (
    <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
      {items.map((it) => (
        <li key={it.label} className="flex items-center gap-1.5">
          <svg width={18} height={8} aria-hidden="true">
            <line x1={0} x2={18} y1={4} y2={4} stroke={it.color} strokeWidth={2} strokeDasharray={it.dash ? "4 3" : undefined} />
          </svg>
          {it.label}
        </li>
      ))}
    </ul>
  )
}

/** Log axes tick once per decade — every minor tick labelled is unreadable. */
export function decadeTicks(spec: AxisSpec, scale: { domain: () => number[] }): number[] | undefined {
  if (spec.type !== "log") return undefined
  const [lo, hi] = scale.domain()
  const out: number[] = []
  for (let e = Math.ceil(Math.log10(lo)); e <= Math.floor(Math.log10(hi)); e++) out.push(10 ** e)
  return out.length >= 2 ? out : undefined
}
