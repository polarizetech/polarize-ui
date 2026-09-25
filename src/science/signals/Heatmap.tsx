import * as React from "react"
import { AxisBottom, AxisLeft } from "@visx/axis"
import { scaleLinear } from "@visx/scale"
import { INK, axisLabelProps, tickLabel } from "../charts/common"

/**
 * A magnitude grid — a spectrogram, a time–frequency map, a comodulogram, a density.
 *
 * Colour is the sequential token ramp (--seq-1 … --seq-13): ONE hue, light to dark, never
 * a rainbow. --seq-1 is always "near zero", so the zero end recedes toward the surface in
 * light and dark alike. Rules carried from the charts:
 *   · the colour range is printed on a colour bar, never implied;
 *   · a shared colour range is declared on the panel ("shared colour scale"), and so is
 *     an independent one — two heatmaps autoscaled to themselves cannot be compared;
 *   · values outside the range are clipped AND counted on the panel; missing cells are
 *     drawn empty and counted. Nothing is silently dropped.
 */
export type HeatmapProps = {
  /** values[row][col]; row 0 is the BOTTOM of the plot (lowest y). */
  values: number[][]
  x: { domain: [number, number]; label: string; format?: (v: number) => string }
  y: { domain: [number, number]; label: string; format?: (v: number) => string }
  /** Colour range. Omit to autoscale to this panel's own data (it says so). */
  colorDomain?: [number, number]
  colorLabel: string
  /** "shared" when colorDomain is common to several panels. */
  scaleNote?: "shared" | "independent"
  width?: number
  height?: number
  title?: string
}

const STOPS = 13
const PAD = { l: 56, r: 88, t: 16, b: 40 }

function readRamp(): [number, number, number][] {
  const cs = getComputedStyle(document.documentElement)
  const out: [number, number, number][] = []
  for (let i = 1; i <= STOPS; i++) {
    const hex = cs.getPropertyValue(`--seq-${i}`).trim()
    if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`Heatmap: --seq-${i} is not defined — load the polarize-ui theme`)
    out.push([1, 3, 5].map((j) => parseInt(hex.slice(j, j + 2), 16)) as [number, number, number])
  }
  return out
}

function colorAt(ramp: [number, number, number][], t: number): [number, number, number] {
  const x = Math.min(1, Math.max(0, t)) * (ramp.length - 1)
  const i = Math.min(ramp.length - 2, Math.floor(x))
  const f = x - i
  return [0, 1, 2].map((k) => Math.round(ramp[i][k] + (ramp[i + 1][k] - ramp[i][k]) * f)) as [number, number, number]
}

/** Re-render when the page switches between light and dark (the ramp flips). */
function useThemeKey() {
  const [key, setKey] = React.useState(0)
  React.useEffect(() => {
    const mo = new MutationObserver(() => setKey((k) => k + 1))
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] })
    return () => mo.disconnect()
  }, [])
  return key
}

export function Heatmap({
  values, x, y, colorDomain, colorLabel, scaleNote, width = 720, height = 280, title,
}: HeatmapProps) {
  const rows = values.length
  const cols = rows ? values[0].length : 0
  if (!rows || !cols) throw new Error("Heatmap: values is empty")
  if (values.some((r) => r.length !== cols)) throw new Error("Heatmap: every row needs the same number of columns")

  const finite = values.flat().filter(Number.isFinite)
  const [lo, hi] = colorDomain ?? [Math.min(...finite), Math.max(...finite)]
  if (!(hi > lo)) throw new Error("Heatmap: colour range must have hi > lo")

  const themeKey = useThemeKey()
  const [image, setImage] = React.useState<string | null>(null)
  const [hover, setHover] = React.useState<{ x: number; y: number; v: number } | null>(null)

  const plotW = width - PAD.l - PAD.r
  const plotH = height - PAD.t - PAD.b
  const xs = scaleLinear<number>({ domain: x.domain, range: [PAD.l, PAD.l + plotW] })
  const ys = scaleLinear<number>({ domain: y.domain, range: [PAD.t + plotH, PAD.t] })
  const cs = scaleLinear<number>({ domain: [lo, hi], range: [PAD.t + plotH, PAD.t] })

  let below = 0, above = 0, missing = 0
  for (const v of values.flat()) {
    if (!Number.isFinite(v)) missing++
    else if (v < lo) below++
    else if (v > hi) above++
  }
  const notes: string[] = []
  if (scaleNote === "shared") notes.push("shared colour scale")
  else if (scaleNote === "independent" || !colorDomain) notes.push("INDEPENDENT colour scale — not comparable across panels")
  if (below || above) notes.push(`clipped to the colour range: ${below} below, ${above} above`)
  if (missing) notes.push(`${missing} missing cells drawn empty`)

  React.useLayoutEffect(() => {
    const ramp = readRamp()
    const cvs = document.createElement("canvas")
    cvs.width = cols
    cvs.height = rows
    const ctx = cvs.getContext("2d")!
    const img = ctx.createImageData(cols, rows)
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const v = values[r][c]
        const o = ((rows - 1 - r) * cols + c) * 4 // row 0 at the bottom
        if (!Number.isFinite(v)) { img.data[o + 3] = 0; continue }
        const [R, G, B] = colorAt(ramp, (v - lo) / (hi - lo))
        img.data[o] = R; img.data[o + 1] = G; img.data[o + 2] = B; img.data[o + 3] = 255
      }
    }
    ctx.putImageData(img, 0, 0)
    setImage(cvs.toDataURL())
  }, [values, rows, cols, lo, hi, themeKey])

  const gradientId = React.useId().replace(/:/g, "")
  const fmt = (v: number) => (Math.abs(v) >= 1000 || (Math.abs(v) < 0.01 && v !== 0) ? v.toExponential(1) : +v.toPrecision(3))

  function onMove(e: React.MouseEvent<SVGRectElement>) {
    const svg = e.currentTarget.ownerSVGElement!
    const pt = svg.createSVGPoint()
    pt.x = e.clientX; pt.y = e.clientY
    const p = pt.matrixTransform(svg.getScreenCTM()!.inverse())
    const c = Math.min(cols - 1, Math.max(0, Math.floor(((p.x - PAD.l) / plotW) * cols)))
    const r = Math.min(rows - 1, Math.max(0, Math.floor(((PAD.t + plotH - p.y) / plotH) * rows)))
    setHover({ x: xs.invert(PAD.l + ((c + 0.5) / cols) * plotW), y: ys.invert(PAD.t + plotH - ((r + 0.5) / rows) * plotH), v: values[r][c] })
  }

  return (
    <figure className="m-0">
      <svg viewBox={`0 0 ${width} ${height}`} width="100%" role="img" aria-label={title ?? `${colorLabel} by ${x.label} and ${y.label}`}>
        {title && <title>{title}</title>}
        <defs>
          <linearGradient id={gradientId} x1="0" y1="1" x2="0" y2="0">
            {Array.from({ length: STOPS }, (_, i) => (
              <stop key={i} offset={`${(i / (STOPS - 1)) * 100}%`} stopColor={`var(--seq-${i + 1})`} />
            ))}
          </linearGradient>
        </defs>
        {image && (
          <image href={image} x={PAD.l} y={PAD.t} width={plotW} height={plotH} preserveAspectRatio="none" style={{ imageRendering: "pixelated" }} />
        )}
        <rect x={PAD.l} y={PAD.t} width={plotW} height={plotH} fill="transparent" stroke={INK.axis}
          onMouseMove={onMove} onMouseLeave={() => setHover(null)} />
        <AxisBottom top={PAD.t + plotH} scale={xs} numTicks={6} stroke={INK.axis} tickStroke={INK.axis}
          tickLabelProps={tickLabel} label={x.label} labelProps={axisLabelProps}
          tickFormat={x.format ? (v) => x.format!(Number(v)) : undefined} />
        <AxisLeft left={PAD.l} scale={ys} numTicks={5} stroke={INK.axis} tickStroke={INK.axis}
          tickLabelProps={{ ...tickLabel, textAnchor: "end", dx: -4, dy: 3 }} label={y.label} labelProps={axisLabelProps} labelOffset={36}
          tickFormat={y.format ? (v) => y.format!(Number(v)) : undefined} />
        {/* Colour bar: the range is stated, never implied. */}
        <rect x={width - PAD.r + 16} y={PAD.t} width={10} height={plotH} fill={`url(#${gradientId})`} stroke={INK.axis} />
        <AxisLeft left={width - PAD.r + 44} scale={cs} numTicks={4} hideAxisLine tickStroke={INK.axis}
          tickLabelProps={{ ...tickLabel, textAnchor: "start", dx: 2, dy: 3 }} tickFormat={(v) => String(fmt(Number(v)))} tickLength={0} />
        <text x={width - 12} y={PAD.t + plotH / 2} fill={INK.label} fontSize={10} fontFamily="var(--font-sans)" textAnchor="middle"
          transform={`rotate(90 ${width - 12} ${PAD.t + plotH / 2})`}>{colorLabel}</text>
      </svg>
      {/* Notes go below the plot, not over the cells, where they would be unreadable. */}
      <p className="m-0 font-mono text-[length:var(--text-xs)] text-muted-foreground" data-note="">{notes.join(" · ")}</p>
      <figcaption className="mt-1 h-5 font-mono text-[length:var(--text-xs)] text-muted-foreground tabular-nums" aria-live="polite">
        {hover
          ? `${x.label}: ${fmt(hover.x)} · ${y.label}: ${fmt(hover.y)} · ${colorLabel}: ${Number.isFinite(hover.v) ? fmt(hover.v) : "missing"}`
          : "Hover the plot to read a cell."}
      </figcaption>
    </figure>
  )
}
