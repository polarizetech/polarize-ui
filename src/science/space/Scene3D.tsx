import * as React from "react"
import { scaleLinear } from "@visx/scale"
import { useThemeKey } from "../signals/ramp"

/**
 * A small 3-D canvas: an orthographic camera you can turn, a labelled box of three axes, and
 * primitives (quads, lines, dots, text) given in DATA coordinates. No WebGL and no dependency;
 * the painter's algorithm orders primitives far to near, which is exact enough for the
 * surfaces, curves and stacks the 3-D views draw.
 *
 * Rules carried from the 2-D charts:
 *   · every axis has ticks in its own units and a label — a 3-D picture with no scale is a
 *     picture of nothing;
 *   · a perspective makes heights hard to read, so hovering always prints the exact value
 *     under the pointer, and the notes say so;
 *   · anything dropped, clipped or thinned for display is stated in `notes` by the caller.
 *
 * World axes are RIGHT-HANDED (x × y = z). Data in a left-handed frame — north, east, up is
 * one — comes out mirrored, and every sense of rotation in it reversed. Map such data to a
 * right-handed order first (east, north, up), or keep z pointing the way the data's z points.
 *
 * Turn it by dragging, or with the arrow keys once it has focus. Double-click resets.
 */
export type Vec3 = [number, number, number]
export type Axis3 = { domain: [number, number]; label: string; format?: (v: number) => string }
export type Pick = { at: Vec3; text: string }
export type Prim =
  | { kind: "quad"; pts: [Vec3, Vec3, Vec3, Vec3]; fill: string; stroke?: string; pick?: Pick[] }
  | { kind: "line"; a: Vec3; b: Vec3; stroke: string; width?: number; alpha?: number; pick?: Pick[] }
  | { kind: "dot"; at: Vec3; r: number; fill: string; pick?: Pick[] }
  | { kind: "text"; at: Vec3; text: string; color: string; align?: CanvasTextAlign }

export type View = { name: string; yaw: number; pitch: number }

export type Scene3DProps = {
  axes: { x: Axis3; y: Axis3; z: Axis3 }
  primitives: Prim[]
  /** Box half-extents in world units. Omit for [1.4, 1, 0.7]. Equal-scale views compute it. */
  aspect?: Vec3
  width?: number
  height?: number
  title?: string
  /** Printed under the plot, after the built-in note. */
  notes?: string[]
  /** Degrees. Yaw turns about the vertical axis; pitch 0 is side-on, 90 is straight down. */
  initialView?: { yaw: number; pitch: number }
  views?: View[]
  /** Drawn between the plot and the notes (a colour bar, a legend). */
  legend?: React.ReactNode
}

const DEG = Math.PI / 180
const DEFAULT_VIEW = { yaw: -35, pitch: 28 }

type Projected = { sx: number; sy: number; depth: number }

function makeCamera(yaw: number, pitch: number) {
  const cy = Math.cos(yaw * DEG), sy = Math.sin(yaw * DEG)
  const cp = Math.cos(pitch * DEG), sp = Math.sin(pitch * DEG)
  return ([x, y, z]: Vec3): Projected => {
    const x1 = x * cy - y * sy
    const y1 = x * sy + y * cy
    return { sx: x1, sy: z * cp + y1 * sp, depth: y1 * cp - z * sp }
  }
}

const fmtDefault = (v: number) => (Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(1) : String(+v.toPrecision(3)))

export function Scene3D({
  axes, primitives, aspect = [1.4, 1, 0.7], width = 720, height = 480, title,
  notes = [], initialView = DEFAULT_VIEW, views, legend,
}: Scene3DProps) {
  for (const k of ["x", "y", "z"] as const) {
    const [lo, hi] = axes[k].domain
    if (!(Number.isFinite(lo) && Number.isFinite(hi) && hi > lo)) throw new Error(`Scene3D: ${k} axis needs a finite domain with hi > lo`)
  }
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const [view, setView] = React.useState(initialView)
  const [hover, setHover] = React.useState<string | null>(null)
  const [pointer, setPointer] = React.useState<{ x: number; y: number } | null>(null)
  const drag = React.useRef<{ x: number; y: number; yaw: number; pitch: number } | null>(null)
  const drawn = React.useRef<{ prim: Prim; pts: Projected[]; px: [number, number][] }[]>([])
  const themeKey = useThemeKey()

  // data → world
  const toWorld = React.useMemo(() => {
    const s = (["x", "y", "z"] as const).map((k, i) => {
      const [lo, hi] = axes[k].domain
      return (v: number) => ((v - lo) / (hi - lo) * 2 - 1) * aspect[i]
    })
    return ([x, y, z]: Vec3): Vec3 => [s[0](x), s[1](y), s[2](z)]
  }, [axes, aspect])

  // Fit the box at ANY rotation (so turning it never changes the zoom): horizontally it can
  // span at most its floor diagonal, vertically at most the floor diagonal and height combined.
  const rXY = Math.hypot(aspect[0], aspect[1])
  const MARGIN = 64
  const scale = Math.min((width / 2 - MARGIN) / rXY, (height / 2 - MARGIN / 2) / Math.hypot(rXY, aspect[2]))
  const cx = width / 2, cy = height / 2

  React.useLayoutEffect(() => {
    const cvs = canvasRef.current
    if (!cvs) return
    const dpr = window.devicePixelRatio || 1
    cvs.width = Math.round(width * dpr)
    cvs.height = Math.round(height * dpr)
    const ctx = cvs.getContext("2d")!
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, width, height)

    const cs = getComputedStyle(cvs)
    const cache = new Map<string, string>()
    const color = (c: string) => {
      const m = /^var\((--[\w-]+)\)$/.exec(c.trim())
      if (!m) return c
      if (!cache.has(c)) cache.set(c, cs.getPropertyValue(m[1]).trim() || "#888")
      return cache.get(c)!
    }
    const mono = cs.getPropertyValue("--font-mono").trim() || "monospace"
    const sans = cs.getPropertyValue("--font-sans").trim() || "sans-serif"
    const cam = makeCamera(view.yaw, view.pitch)
    const px = (p: Projected): [number, number] => [cx + p.sx * scale, cy - p.sy * scale]
    const P = (w: Vec3) => { const p = cam(w); return { p, xy: px(p) } }

    // ── the box: edges, then ticks on the edges nearest the viewer ──
    const [ax, ay, az] = aspect
    const axisInk = color("var(--border)")
    const labelInk = color("var(--muted-foreground)")
    const corners: Vec3[] = []
    for (const X of [-ax, ax]) for (const Y of [-ay, ay]) for (const Z of [-az, az]) corners.push([X, Y, Z])
    ctx.strokeStyle = axisInk
    ctx.lineWidth = 1
    for (let i = 0; i < 8; i++) for (let j = i + 1; j < 8; j++) {
      const a = corners[i], b = corners[j]
      const diff = a.filter((v, k) => v !== b[k]).length
      if (diff !== 1) continue
      const [pa, pb] = [P(a).xy, P(b).xy]
      ctx.beginPath(); ctx.moveTo(...pa); ctx.lineTo(...pb); ctx.stroke()
    }
    const centre = P([0, 0, 0]).xy

    function labelEdge(k: 0 | 1 | 2, a: Vec3, b: Vec3, spec: Axis3) {
      const [lo, hi] = spec.domain
      const s = scaleLinear<number>({ domain: [lo, hi], range: [0, 1] })
      const fmt = spec.format ?? fmtDefault
      const mid = P([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]).xy
      // An edge seen nearly end-on has no room for ticks; drawing them anyway stacks the
      // labels into an unreadable pile. Say nothing rather than something illegible.
      const [pa, pb] = [P(a).xy, P(b).xy]
      if (Math.hypot(pb[0] - pa[0], pb[1] - pa[1]) < 70) return
      let ox = mid[0] - centre[0], oy = mid[1] - centre[1]
      const n = Math.hypot(ox, oy) || 1
      ox /= n; oy /= n
      ctx.fillStyle = labelInk
      ctx.font = `10px ${mono}`
      ctx.textAlign = Math.abs(ox) < 0.3 ? "center" : ox > 0 ? "left" : "right"
      ctx.textBaseline = "middle"
      const ticks = s.ticks(5)
      const widest = Math.max(...ticks.map((t) => ctx.measureText(fmt(t)).width))
      for (const t of ticks) {
        const f = s(t)
        const w: Vec3 = [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, a[2] + (b[2] - a[2]) * f]
        const q = P(w).xy
        ctx.beginPath(); ctx.moveTo(...q); ctx.lineTo(q[0] + ox * 4, q[1] + oy * 4); ctx.strokeStyle = axisInk; ctx.stroke()
        ctx.fillText(fmt(t), q[0] + ox * 8, q[1] + oy * 8)
      }
      ctx.font = `11px ${sans}`
      if (k === 2) {
        // the vertical axis: its name goes above the top of its edge, clear of the ticks
        const top = P(a[2] > b[2] ? a : b).xy
        ctx.textAlign = "center"
        ctx.textBaseline = "bottom"
        ctx.fillText(spec.label, top[0], top[1] - 12)
        return
      }
      // clear the widest tick label along the outward direction, then a gap
      const reach = 8 + Math.abs(ox) * widest + Math.abs(oy) * 12 + 14
      ctx.textAlign = "center"
      ctx.textBaseline = "middle"
      ctx.fillText(spec.label, mid[0] + ox * reach, mid[1] + oy * reach)
    }
    const nearer = (u: Vec3, v: Vec3) => (cam([(u[0] + v[0]) / 2, (u[1] + v[1]) / 2, (u[2] + v[2]) / 2]).depth)
    // x: floor edges at y = ±ay
    const xe: [Vec3, Vec3][] = [[[-ax, -ay, -az], [ax, -ay, -az]], [[-ax, ay, -az], [ax, ay, -az]]]
    const xEdge = xe.sort((p, q) => nearer(...p) - nearer(...q))[0]
    const ye: [Vec3, Vec3][] = [[[-ax, -ay, -az], [-ax, ay, -az]], [[ax, -ay, -az], [ax, ay, -az]]]
    const yEdge = ye.sort((p, q) => nearer(...p) - nearer(...q))[0]
    const ze: [Vec3, Vec3][] = [[-ax, -ay], [-ax, ay], [ax, -ay], [ax, ay]].map(([X, Y]) => [[X, Y, -az], [X, Y, az]] as [Vec3, Vec3])
    const zEdge = ze.sort((p, q) => P(p[0]).xy[0] - P(q[0]).xy[0])[0]

    // ── primitives, far to near ──
    const items = primitives.map((prim) => {
      const ws: Vec3[] = prim.kind === "quad" ? prim.pts.map(toWorld) : prim.kind === "line" ? [toWorld(prim.a), toWorld(prim.b)] : [toWorld(prim.at)]
      const pts = ws.map(cam)
      const depth = pts.reduce((s, p) => s + p.depth, 0) / pts.length
      return { prim, pts, px: pts.map(px), depth }
    })
    const solid = items.filter((i) => i.prim.kind !== "text").sort((a, b) => b.depth - a.depth)
    for (const it of solid) {
      const pr = it.prim
      if (pr.kind === "quad") {
        ctx.beginPath()
        it.px.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)))
        ctx.closePath()
        ctx.fillStyle = color(pr.fill)
        ctx.fill()
        ctx.strokeStyle = color(pr.stroke ?? pr.fill)
        ctx.lineWidth = 0.6
        ctx.stroke()
      } else if (pr.kind === "line") {
        ctx.globalAlpha = pr.alpha ?? 1
        ctx.beginPath(); ctx.moveTo(...it.px[0]); ctx.lineTo(...it.px[1])
        ctx.strokeStyle = color(pr.stroke); ctx.lineWidth = pr.width ?? 1.25; ctx.lineCap = "round"
        ctx.stroke()
        ctx.globalAlpha = 1
      } else if (pr.kind === "dot") {
        ctx.beginPath(); ctx.arc(it.px[0][0], it.px[0][1], pr.r, 0, Math.PI * 2)
        ctx.fillStyle = color(pr.fill); ctx.fill()
      }
    }
    drawn.current = solid
    labelEdge(0, xEdge[0], xEdge[1], axes.x)
    labelEdge(1, yEdge[0], yEdge[1], axes.y)
    labelEdge(2, zEdge[0], zEdge[1], axes.z)
    for (const it of items) {
      if (it.prim.kind !== "text") continue
      ctx.font = `11px ${sans}`
      ctx.fillStyle = color(it.prim.color)
      ctx.textAlign = it.prim.align ?? "left"
      ctx.textBaseline = "middle"
      ctx.fillText(it.prim.text, it.px[0][0] + (it.prim.align === "right" ? -6 : 6), it.px[0][1])
    }
    if (pointer) {
      ctx.beginPath(); ctx.arc(pointer.x, pointer.y, 3.5, 0, Math.PI * 2)
      ctx.strokeStyle = color("var(--foreground)"); ctx.lineWidth = 1.5; ctx.stroke()
    }
  }, [primitives, view, width, height, aspect, axes, toWorld, scale, cx, cy, themeKey, pointer])

  function local(e: React.PointerEvent | React.MouseEvent) {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: ((e.clientX - r.left) / r.width) * width, y: ((e.clientY - r.top) / r.height) * height }
  }

  function pick(x: number, y: number) {
    const list = drawn.current
    for (let i = list.length - 1; i >= 0; i--) {
      const { prim, px } = list[i]
      let hit = false
      if (prim.kind === "quad") {
        let inside = false
        for (let a = 0, b = px.length - 1; a < px.length; b = a++) {
          const [xa, ya] = px[a], [xb, yb] = px[b]
          if ((ya > y) !== (yb > y) && x < ((xb - xa) * (y - ya)) / (yb - ya) + xa) inside = !inside
        }
        hit = inside
      } else if (prim.kind === "line") {
        const [[x1, y1], [x2, y2]] = px
        const L = (x2 - x1) ** 2 + (y2 - y1) ** 2
        const t = L ? Math.max(0, Math.min(1, ((x - x1) * (x2 - x1) + (y - y1) * (y2 - y1)) / L)) : 0
        hit = Math.hypot(x - (x1 + t * (x2 - x1)), y - (y1 + t * (y2 - y1))) < 5
      } else if (prim.kind === "dot") {
        hit = Math.hypot(x - px[0][0], y - px[0][1]) < prim.r + 4
      }
      if (!hit || !("pick" in prim) || !prim.pick?.length) continue
      const cam = makeCamera(view.yaw, view.pitch)
      let best: { d: number; p: Pick; xy: [number, number] } | null = null
      for (const p of prim.pick) {
        const q = cam(toWorld(p.at))
        const xy: [number, number] = [cx + q.sx * scale, cy - q.sy * scale]
        const d = Math.hypot(xy[0] - x, xy[1] - y)
        if (!best || d < best.d) best = { d, p, xy }
      }
      return best
    }
    return null
  }

  function onPointerDown(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    const { x, y } = local(e)
    drag.current = { x, y, ...view }
  }
  function onPointerMove(e: React.PointerEvent<HTMLCanvasElement>) {
    const { x, y } = local(e)
    if (drag.current) {
      const d = drag.current
      setView({ yaw: d.yaw - (x - d.x) * 0.5, pitch: Math.max(0, Math.min(90, d.pitch + (y - d.y) * 0.5)) })
      setHover(null); setPointer(null)
      return
    }
    const hit = pick(x, y)
    setHover(hit?.p.text ?? null)
    setPointer(hit ? { x: hit.xy[0], y: hit.xy[1] } : null)
  }
  function onKey(e: React.KeyboardEvent) {
    const step = 5
    const k: Record<string, [number, number]> = { ArrowLeft: [step, 0], ArrowRight: [-step, 0], ArrowUp: [0, step], ArrowDown: [0, -step] }
    if (!(e.key in k)) return
    e.preventDefault()
    const [dy, dp] = k[e.key]
    setView((v) => ({ yaw: v.yaw + dy, pitch: Math.max(0, Math.min(90, v.pitch + dp)) }))
  }

  const allViews: View[] = views ?? [
    { name: "Default", ...initialView },
    { name: "Top", yaw: 0, pitch: 90 },
    { name: "Front", yaw: 0, pitch: 0 },
    { name: "Side", yaw: -90, pitch: 0 },
  ]
  const builtIn = "3-D view: heights are hard to read in perspective; hover for exact values · drag or use arrow keys to turn, double-click to reset"

  return (
    <figure className="m-0">
      <div className="mb-1 flex flex-wrap items-center gap-1.5" role="group" aria-label="Camera">
        {allViews.map((v) => (
          <button key={v.name} type="button" onClick={() => setView({ yaw: v.yaw, pitch: v.pitch })}
            className="rounded-md border px-2 py-0.5 font-mono text-[length:var(--text-xs)] text-muted-foreground hover:bg-accent"
            aria-pressed={view.yaw === v.yaw && view.pitch === v.pitch}>
            {v.name}
          </button>
        ))}
        <span className="ml-auto font-mono text-[length:var(--text-xs)] text-muted-foreground tabular-nums">
          yaw {Math.round(view.yaw)}° · elevation {Math.round(view.pitch)}°
        </span>
      </div>
      <canvas
        ref={canvasRef}
        role="img"
        aria-label={title ?? `${axes.z.label} by ${axes.x.label} and ${axes.y.label}, 3-D`}
        tabIndex={0}
        style={{ width: "100%", aspectRatio: `${width} / ${height}`, touchAction: "none", cursor: drag.current ? "grabbing" : "grab" }}
        className="block rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/50"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={() => { drag.current = null }}
        onPointerLeave={() => { if (!drag.current) { setHover(null); setPointer(null) } }}
        onDoubleClick={() => setView(initialView)}
        onKeyDown={onKey}
      />
      {legend}
      <p className="m-0 font-mono text-[length:var(--text-xs)] text-muted-foreground" data-note="">{[...notes, builtIn].join(" · ")}</p>
      <figcaption className="mt-1 min-h-5 font-mono text-[length:var(--text-xs)] text-muted-foreground tabular-nums" aria-live="polite">
        {hover ?? "Hover the plot to read a value."}
      </figcaption>
    </figure>
  )
}
