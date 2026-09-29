import * as React from "react"
import { scaleLinear } from "@visx/scale"
import { Scene3D, type Axis3, type Prim, type Vec3, type View } from "./Scene3D"
import { colorAt, readRamp, rgb, useThemeKey, type RGB } from "../signals/ramp"
import { Legend } from "../charts/common"

const fmt = (v: number) => (Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(1) : String(+v.toPrecision(3)))

function useRamp(): RGB[] | null {
  const key = useThemeKey()
  const [ramp, setRamp] = React.useState<RGB[] | null>(null)
  React.useLayoutEffect(() => setRamp(readRamp()), [key])
  return ramp
}

/** A colour bar in HTML: the range is printed, never implied. */
export function ColorBar({ domain, label, from = 0, to = 1 }: { domain: [string, string]; label: string; from?: number; to?: number }) {
  const stops = Array.from({ length: 13 }, (_, i) => i).filter((i) => i / 12 >= from - 1e-9 && i / 12 <= to + 1e-9)
  return (
    <div className="mt-2 flex items-center gap-2 font-mono text-[length:var(--text-xs)] text-muted-foreground tabular-nums">
      <span>{domain[0]}</span>
      <span className="h-2.5 w-40 rounded-sm border"
        style={{ background: `linear-gradient(to right, ${stops.map((i) => `var(--seq-${i + 1})`).join(", ")})` }} />
      <span>{domain[1]}</span>
      <span className="font-sans">{label}</span>
    </div>
  )
}

// ────────────────────────────────────────────────────────────────────────────────────────
/**
 * A spectrogram (or any magnitude grid) as a landscape: x and y on the floor, the value as
 * both height and colour. It shows the same numbers as `Heatmap`; the 2-D map is the one to
 * read values from, and this one is for seeing where the ridges and plateaus are.
 * Vertices sit at cell centres; values outside the colour range are clipped to it and counted.
 */
export type Surface3DProps = {
  /** values[row][col]; row 0 is the lowest y. */
  values: number[][]
  x: Axis3
  y: Axis3
  valueLabel: string
  valueDomain?: [number, number]
  scaleNote?: "shared" | "independent"
  width?: number
  height?: number
  title?: string
  notes?: string[]
  initialView?: { yaw: number; pitch: number }
}

export function Surface3D({ values, x, y, valueLabel, valueDomain, scaleNote, width, height, title, notes = [], initialView }: Surface3DProps) {
  const rows = values.length
  const cols = rows ? values[0].length : 0
  if (rows < 2 || cols < 2) throw new Error("Surface3D: needs at least a 2 × 2 grid")
  if (values.some((r) => r.length !== cols)) throw new Error("Surface3D: every row needs the same number of columns")
  const finite = values.flat().filter(Number.isFinite)
  const [lo, hi] = valueDomain ?? [Math.min(...finite), Math.max(...finite)]
  if (!(hi > lo)) throw new Error("Surface3D: value range must have hi > lo")
  const ramp = useRamp()

  const { prims, clipped, missing } = React.useMemo(() => {
    const out: Prim[] = []
    let clipped = 0, missing = 0
    if (!ramp) return { prims: out, clipped, missing }
    const xs = (c: number) => x.domain[0] + ((c + 0.5) / cols) * (x.domain[1] - x.domain[0])
    const ys = (r: number) => y.domain[0] + ((r + 0.5) / rows) * (y.domain[1] - y.domain[0])
    const clamp = (v: number) => Math.min(hi, Math.max(lo, v))
    for (const v of values.flat()) {
      if (!Number.isFinite(v)) missing++
      else if (v < lo || v > hi) clipped++
    }
    const fx = x.format ?? fmt, fy = y.format ?? fmt
    for (let r = 0; r < rows - 1; r++) {
      for (let c = 0; c < cols - 1; c++) {
        const idx: [number, number][] = [[r, c], [r, c + 1], [r + 1, c + 1], [r + 1, c]]
        const vs = idx.map(([i, j]) => values[i][j])
        if (!vs.every(Number.isFinite)) continue
        const pts = idx.map(([i, j]) => [xs(j), ys(i), clamp(values[i][j])] as Vec3) as [Vec3, Vec3, Vec3, Vec3]
        const t = (vs.reduce((s, v) => s + clamp(v), 0) / 4 - lo) / (hi - lo)
        out.push({
          kind: "quad", pts, fill: rgb(colorAt(ramp, t)),
          pick: idx.map(([i, j], k) => ({ at: pts[k], text: `${x.label}: ${fx(xs(j))} · ${y.label}: ${fy(ys(i))} · ${valueLabel}: ${fmt(values[i][j])}` })),
        })
      }
    }
    return { prims: out, clipped, missing }
  }, [values, rows, cols, x, y, lo, hi, ramp, valueLabel])

  const all: string[] = []
  if (scaleNote === "shared") all.push("shared value scale")
  else if (scaleNote === "independent" || !valueDomain) all.push("INDEPENDENT value scale — not comparable across panels")
  if (clipped) all.push(`${clipped} cells clipped to the value range`)
  if (missing) all.push(`${missing} missing cells leave holes`)
  all.push("height and colour show the same value")
  all.push(...notes)

  return (
    <Scene3D axes={{ x, y, z: { domain: [lo, hi], label: valueLabel } }} primitives={prims} width={width} height={height}
      title={title} notes={all} initialView={initialView}
      legend={<ColorBar domain={[fmt(lo), fmt(hi)]} label={valueLabel} />} />
  )
}

// ────────────────────────────────────────────────────────────────────────────────────────
/**
 * A hodogram: the tip of a vector traced through time, in three dimensions. All three axes
 * share ONE scale, because an ellipse drawn on unequal axes is a different ellipse — the
 * shape is the thing being looked at. Colour runs light to dark with time.
 *
 * A hodogram shows a trajectory. It does not by itself establish that a wave is polarised,
 * nor which way it turns: the sense of rotation is only defined against a reference
 * direction (for a magnetic field, the background field), and a degree of polarisation needs
 * its noise floor. Draw the reference with `reference`; claim nothing else from the picture.
 *
 * The three axes must be given in a RIGHT-HANDED order, or the trajectory is drawn mirrored
 * and turns the wrong way. Geomagnetic north–east–down is right-handed; north–east–UP is not,
 * so to put "up" up, pass east, north, up (x = east, y = north, z = −down).
 */
export type Trajectory3DProps = {
  x: number[]
  y: number[]
  z: number[]
  /** Time of each sample, in the units `timeLabel` names. */
  t: number[]
  axisLabels: [string, string, string]
  unit: string
  timeLabel: string
  timeFormat?: (v: number) => string
  /** A direction to draw from the origin (e.g. the background field). Direction only. */
  reference?: { direction: Vec3; label: string }
  width?: number
  height?: number
  title?: string
  notes?: string[]
  initialView?: { yaw: number; pitch: number }
}

export function Trajectory3D({
  x, y, z, t, axisLabels, unit, timeLabel, timeFormat = fmt, reference, width, height = 480, title, notes = [], initialView,
}: Trajectory3DProps) {
  const n = x.length
  if (n < 2 || y.length !== n || z.length !== n || t.length !== n) throw new Error("Trajectory3D: x, y, z and t need the same length (≥ 2)")
  const ramp = useRamp()
  const maxAbs = Math.max(...x.map(Math.abs), ...y.map(Math.abs), ...z.map(Math.abs))
  const M = scaleLinear<number>({ domain: [0, maxAbs || 1], nice: true }).domain()[1]
  const dom: [number, number] = [-M, M]

  const prims = React.useMemo(() => {
    const out: Prim[] = []
    if (!ramp) return out
    const at = (i: number): Vec3 => [x[i], y[i], z[i]]
    const txt = (i: number) => `${timeLabel}: ${timeFormat(t[i])} · ${axisLabels[0]} ${fmt(x[i])} · ${axisLabels[1]} ${fmt(y[i])} · ${axisLabels[2]} ${fmt(z[i])} ${unit}`
    const shade = (i: number) => rgb(colorAt(ramp, 0.3 + 0.7 * (i / (n - 1))))
    for (let i = 0; i < n - 1; i++) {
      out.push({ kind: "line", a: at(i), b: at(i + 1), stroke: shade(i), width: 1.75, pick: [{ at: at(i), text: txt(i) }, { at: at(i + 1), text: txt(i + 1) }] })
    }
    out.push({ kind: "dot", at: at(0), r: 3.5, fill: shade(0), pick: [{ at: at(0), text: `start · ${txt(0)}` }] })
    out.push({ kind: "dot", at: at(n - 1), r: 3.5, fill: shade(n - 1), pick: [{ at: at(n - 1), text: `end · ${txt(n - 1)}` }] })
    out.push({ kind: "text", at: at(0), text: "start", color: "var(--muted-foreground)" })
    out.push({ kind: "text", at: at(n - 1), text: "end", color: "var(--muted-foreground)" })
    if (reference) {
      const d = reference.direction
      const L = Math.hypot(...d) || 1
      const tip: Vec3 = [(d[0] / L) * M * 0.9, (d[1] / L) * M * 0.9, (d[2] / L) * M * 0.9]
      out.push({ kind: "line", a: [0, 0, 0], b: tip, stroke: "var(--chart-2)", width: 2 })
      out.push({ kind: "dot", at: tip, r: 3, fill: "var(--chart-2)" })
      out.push({ kind: "text", at: tip, text: reference.label, color: "var(--chart-2)" })
    }
    return out
  }, [x, y, z, t, n, ramp, M, reference, axisLabels, unit, timeLabel, timeFormat])

  const all = ["equal scale on all three axes", ...(reference ? [`${reference.label}: direction only, not to scale`] : []), ...notes]
  return (
    <Scene3D
      axes={{ x: { domain: dom, label: `${axisLabels[0]} (${unit})` }, y: { domain: dom, label: `${axisLabels[1]} (${unit})` }, z: { domain: dom, label: `${axisLabels[2]} (${unit})` } }}
      primitives={prims} aspect={[1, 1, 1]} width={width} height={height} title={title} notes={all} initialView={initialView}
      views={[
        { name: "Default", ...(initialView ?? { yaw: -35, pitch: 28 }) },
        { name: `${axisLabels[0]}–${axisLabels[1]}`, yaw: 0, pitch: 90 },
        { name: `${axisLabels[0]}–${axisLabels[2]}`, yaw: 0, pitch: 0 },
        { name: `${axisLabels[1]}–${axisLabels[2]}`, yaw: -90, pitch: 0 },
      ] satisfies View[]}
      legend={<ColorBar domain={[timeFormat(t[0]), timeFormat(t[n - 1])]} label={timeLabel} from={0.3} />}
    />
  )
}

// ────────────────────────────────────────────────────────────────────────────────────────
/**
 * An event-aligned stack: one row per repeat (a trial, a beat, an epoch), all cut around the
 * same event, stacked front to back, with their average in front. It answers "do the repeats
 * line up?" — an average can look clean while most repeats do not contribute to it, and the
 * stack is where that shows. Each row is drawn as an opaque ridge so rows behind stay legible.
 */
export type Waterfall3DProps = {
  rows: number[][]
  lags: number[]
  lagLabel: string
  rowLabel: string
  valueLabel: string
  valueDomain?: [number, number]
  /** Vertical marks across every row at these lags (e.g. the event at 0). */
  markers?: { at: number; label: string }[]
  /** Extra hover text for a row. */
  describeRow?: (i: number) => string
  /** Rows the caller left out, with the reason. Printed, never silent. */
  excluded?: { count: number; reason: string }
  width?: number
  height?: number
  title?: string
  notes?: string[]
  initialView?: { yaw: number; pitch: number }
}

export function Waterfall3D({
  rows, lags, lagLabel, rowLabel, valueLabel, valueDomain, markers = [], describeRow, excluded,
  width, height = 460, title, notes = [], initialView = { yaw: -20, pitch: 32 },
}: Waterfall3DProps) {
  const N = rows.length, L = lags.length
  if (N < 1 || L < 2) throw new Error("Waterfall3D: needs at least one row of two samples")
  if (rows.some((r) => r.length !== L)) throw new Error("Waterfall3D: every row needs one value per lag")
  const mean = React.useMemo(() => lags.map((_, j) => rows.reduce((s, r) => s + r[j], 0) / N), [rows, lags, N])
  const finite = rows.flat().filter(Number.isFinite)
  const [lo, hi] = valueDomain ?? [Math.min(...finite, ...mean), Math.max(...finite, ...mean)]
  if (!(hi > lo)) throw new Error("Waterfall3D: value range must have hi > lo")

  const { prims, clipped } = React.useMemo(() => {
    const out: Prim[] = []
    let clipped = 0
    const clamp = (v: number) => { if (v < lo || v > hi) clipped++; return Math.min(hi, Math.max(lo, v)) }
    const ridge = (vals: number[], yRow: number, stroke: string, width: number, name: string) => {
      const vs = vals.map(clamp)
      for (let j = 0; j < L - 1; j++) {
        const a: Vec3 = [lags[j], yRow, vs[j]], b: Vec3 = [lags[j + 1], yRow, vs[j + 1]]
        out.push({ kind: "quad", pts: [a, b, [lags[j + 1], yRow, lo], [lags[j], yRow, lo]], fill: "var(--background)", stroke: "var(--background)" })
        const text = (k: number) => `${name} · ${lagLabel}: ${fmt(lags[k])} · ${valueLabel}: ${fmt(vals[k])}`
        out.push({ kind: "line", a: [a[0], yRow - 1e-6, a[2]], b: [b[0], yRow - 1e-6, b[2]], stroke, width, pick: [{ at: a, text: text(j) }, { at: b, text: text(j + 1) }] })
      }
    }
    for (let i = N - 1; i >= 0; i--) ridge(rows[i], i + 1, "var(--muted-foreground)", 1, `${rowLabel} ${i + 1}${describeRow ? ` (${describeRow(i)})` : ""}`)
    ridge(mean, 0, "var(--chart-1)", 2, `mean of ${N}`)
    for (const m of markers) {
      out.push({ kind: "line", a: [m.at, 0, lo], b: [m.at, N, lo], stroke: "var(--chart-2)", width: 1.5 })
      out.push({ kind: "line", a: [m.at, N, lo], b: [m.at, N, hi], stroke: "var(--chart-2)", width: 1.5 })
      out.push({ kind: "text", at: [m.at, N, hi], text: m.label, color: "var(--chart-2)" })
    }
    return { prims: out, clipped }
  }, [rows, mean, lags, N, L, lo, hi, markers, describeRow, rowLabel, lagLabel, valueLabel])

  const all = [`${N} ${rowLabel}s, mean in front`, `rows are opaque, so from low angles the nearer ${rowLabel}s hide the ones behind`]
  if (excluded?.count) all.push(`${excluded.count} left out: ${excluded.reason}`)
  if (clipped) all.push(`${clipped} samples clipped to the value range`)
  if (!valueDomain) all.push("value range fitted to this panel")
  all.push(...notes)

  return (
    <Scene3D
      axes={{
        x: { domain: [lags[0], lags[L - 1]], label: lagLabel },
        y: { domain: [0, N], label: rowLabel, format: (v) => (v === 0 ? "mean" : String(v)) },
        z: { domain: [lo, hi], label: valueLabel },
      }}
      primitives={prims} aspect={[1.4, 1.1, 0.8]} width={width} height={height} title={title} notes={all} initialView={initialView}
      views={[
        { name: "Default", ...initialView },
        { name: "Top", yaw: 0, pitch: 90 },
        { name: "Front", yaw: 0, pitch: 0 },
      ]}
      legend={<Legend items={[
        { label: `mean of ${N} (front row)`, color: "var(--chart-1)" },
        { label: `each ${rowLabel}`, color: "var(--muted-foreground)" },
        ...markers.map((m) => ({ label: m.label, color: "var(--chart-2)" })),
      ]} />}
    />
  )
}
