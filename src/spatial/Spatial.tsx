import * as React from "react"
import { Tier, type TierId } from "../science/evidence/tier"
import { Button } from "../components/ui/button"

/* The spatial layer: Polarize UI placed in 3-D with CSS transforms (a perspective viewport and preserve-3d), the
   standard way to draw 3-D in a page. A pointer stands in for head tracking. Every depth, lag and spacing value below
   is TASTE: a drawing choice, not derived from anything. Tier badges sit on frames that never rotate. */

/** TASTE: pane arc radius and spacing, follow lag (0..1 per frame), head range, swipe threshold, all in px or deg. */
export const SPATIAL = { perspective: 1000, radius: 1150, arcDeg: 36, followLag: 0.08, headRange: 18, swipePx: 70, dragPerPane: 320, dockDistance: 900, dockDrop: 14 } as const

const s3d: React.CSSProperties = { transformStyle: "preserve-3d" }
const mono: React.CSSProperties = { fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", letterSpacing: ".12em", textTransform: "uppercase", fontWeight: 500 }

/** Where something sits around the eye: yaw right, pitch down (deg), distance (px). */
export function aim(yaw: number, pitch: number, dist: number) {
  return `rotateY(${-yaw}deg) rotateX(${pitch}deg) translateZ(${-dist}px)`
}

function useReducedMotion() {
  const [r, setR] = React.useState(false)
  React.useEffect(() => {
    const m = globalThis.matchMedia?.("(prefers-reduced-motion: reduce)")
    if (!m) return
    setR(m.matches)
    const on = () => setR(m.matches)
    m.addEventListener("change", on)
    return () => m.removeEventListener("change", on)
  }, [])
  return r
}

/** A component that lifts toward the eye while pointed at (gaze), and presses in while held (pinch). */
export function Lift({ z = 12, press = -3, children }: { z?: number; press?: number; children: React.ReactNode }) {
  const [s, setS] = React.useState<"rest" | "gaze" | "pinch">("rest")
  const dz = s === "gaze" ? z : s === "pinch" ? press : 0
  return (
    <span
      style={{ display: "inline-block", ...s3d, transform: `translateZ(${dz}px)`, transition: "transform var(--motion-fast) var(--motion-ease)" }}
      onPointerEnter={() => setS("gaze")} onPointerLeave={() => setS("rest")}
      onPointerDown={() => setS("pinch")} onPointerUp={() => setS("gaze")}
    >{children}</span>
  )
}

/** A pane's chrome: title and tier badge on a frame that faces you. */
export function SpatialPane({ title, tier, width = 520, children }: { title: string; tier?: TierId; width?: number; children: React.ReactNode }) {
  return (
    <section style={{ width, boxSizing: "border-box", ...s3d, background: "var(--card)", color: "var(--card-foreground)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-lg)", padding: "var(--space-5)" }}>
      <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
        <h3 style={{ margin: 0, fontFamily: "var(--font-display)", fontWeight: 400, fontSize: "var(--text-xl)" }}>{title}</h3>
        {tier && <Tier id={tier} />}
      </header>
      <div style={{ marginTop: "var(--space-4)", ...s3d }}>{children}</div>
    </section>
  )
}

export type SpatialPaneSpec = { id: string; title: string; tier?: TierId; body: React.ReactNode }

export type SpatialSpaceProps = {
  panes: SpatialPaneSpec[]
  height?: number
  arcDeg?: number
  radius?: number
  /** 0..1: how far the dock and menu close on the head each frame. */
  followLag?: number
  /** deg: how far the pointer turns the head from the centre to an edge. */
  headRange?: number
}

/** Panes on an arc around you. Swipe (drag the space) or use the dock to bring the next pane in from the side; the dock
 *  and the Spaces menu trail the head. */
export function SpatialSpace({ panes, height = 680, arcDeg = SPATIAL.arcDeg, radius = SPATIAL.radius, followLag = SPATIAL.followLag, headRange = SPATIAL.headRange }: SpatialSpaceProps) {
  const [idx, setIdx] = React.useState(0)
  const [drag, setDrag] = React.useState(0)
  const [menu, setMenu] = React.useState(false)
  const [follow, setFollow] = React.useState(true)
  const reduce = useReducedMotion()
  const view = React.useRef<HTMLDivElement>(null)
  const world = React.useRef<HTMLDivElement>(null)
  const dock = React.useRef<HTMLDivElement>(null)
  const spaces = React.useRef<HTMLDivElement>(null)
  const paneEls = React.useRef<(HTMLDivElement | null)[]>([])
  const head = React.useRef({ yaw: 0, pitch: 0 })
  const st = React.useRef({ yaw: 0, pitch: 0, dockYaw: 0, dockPitch: 0, pos: 0, anchor: 0, menuT: 0 })
  const down = React.useRef<{ x: number; id: number } | null>(null)
  const live = React.useRef({ target: 0, menu: false, follow: true, reduce: false })
  live.current = { target: idx - drag / SPATIAL.dragPerPane, menu, follow, reduce }
  const last = panes.length - 1
  const go = (i: number) => setIdx(Math.max(0, Math.min(last, i)))

  React.useEffect(() => {
    let raf = 0
    const tick = () => {
      raf = requestAnimationFrame(tick)
      const s = st.current, h = head.current, L = live.current
      const k = (v: number) => (L.reduce ? 1 : v)
      s.yaw += (h.yaw - s.yaw) * k(0.25)
      s.pitch += (h.pitch - s.pitch) * k(0.25)
      if (L.follow) { s.dockYaw += (s.yaw - s.dockYaw) * k(followLag); s.dockPitch += (s.pitch - s.dockPitch) * k(followLag) }
      s.pos += (L.target - s.pos) * k(0.14)
      s.menuT += ((L.menu ? 1 : 0) - s.menuT) * k(0.16)
      if (world.current) world.current.style.transform = `translateZ(${SPATIAL.perspective}px) rotateX(${-s.pitch}deg) rotateY(${s.yaw}deg)`
      paneEls.current.forEach((el, i) => {
        if (!el) return
        const off = i - s.pos
        el.style.transform = `translate(-50%, -50%) ${aim(s.anchor + off * arcDeg, 0, radius)}`
        el.style.opacity = String(Math.max(0, 1 - Math.max(0, Math.abs(off) - 0.4) * 0.45))
        el.style.visibility = Math.abs(off) > 2.2 ? "hidden" : "visible"
      })
      if (dock.current) dock.current.style.transform = `translate(-50%, -50%) ${aim(s.dockYaw, s.dockPitch + SPATIAL.dockDrop, SPATIAL.dockDistance)}`
      if (spaces.current) {
        spaces.current.style.transform = `translate(-50%, -50%) ${aim(s.dockYaw - 30 - (1 - s.menuT) * 40, s.dockPitch, 820)}`
        spaces.current.style.opacity = String(s.menuT)
        spaces.current.style.visibility = s.menuT < 0.02 ? "hidden" : "visible"
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [arcDeg, radius, followLag])

  const grab = (e: React.PointerEvent) => !!(e.target as HTMLElement).closest?.("button, input, [data-spatial-grab], [role=slider]")
  const onPointerDown = (e: React.PointerEvent) => {
    if (grab(e)) return
    down.current = { x: e.clientX, id: e.pointerId }
    view.current?.setPointerCapture(e.pointerId)
  }
  const onPointerMove = (e: React.PointerEvent) => {
    const r = view.current?.getBoundingClientRect()
    if (r) head.current = { yaw: ((e.clientX - r.left) / r.width - 0.5) * 2 * headRange, pitch: ((e.clientY - r.top) / r.height - 0.5) * 2 * headRange * 0.6 }
    if (down.current) setDrag(e.clientX - down.current.x)
  }
  const onPointerUp = () => {
    if (!down.current) return
    if (drag < -SPATIAL.swipePx) go(idx + 1)
    else if (drag > SPATIAL.swipePx) go(idx - 1)
    down.current = null
    setDrag(0)
  }
  const recenter = () => { st.current.anchor = st.current.yaw; st.current.dockYaw = st.current.yaw }
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowRight") { go(idx + 1); e.preventDefault() }
    if (e.key === "ArrowLeft") { go(idx - 1); e.preventDefault() }
  }

  return (
    <div ref={view} tabIndex={0} aria-roledescription="spatial space" aria-label={`${panes[idx]?.title ?? ""}, pane ${idx + 1} of ${panes.length}`}
      onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp} onKeyDown={onKeyDown}
      style={{ position: "relative", height, overflow: "hidden", perspective: SPATIAL.perspective, background: "var(--background)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border)", touchAction: "none", cursor: down.current ? "grabbing" : "grab", outline: "none" }}>
      <div ref={world} style={{ position: "absolute", left: "50%", top: "50%", width: 0, height: 0, ...s3d }}>
        {panes.map((p, i) => (
          <div key={p.id} ref={(el) => { paneEls.current[i] = el }} aria-hidden={i !== idx} style={{ position: "absolute", left: 0, top: 0, ...s3d }}>
            <SpatialPane title={p.title} tier={p.tier}>{p.body}</SpatialPane>
          </div>
        ))}
        <div ref={dock} style={{ position: "absolute", left: 0, top: 0, ...s3d }}>
          <div style={{ display: "flex", alignItems: "center", gap: "var(--space-2)", padding: "var(--space-2)", background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-pill)", whiteSpace: "nowrap", ...s3d }}>
            <Lift><Button variant="outline" size="sm" aria-pressed={menu} onClick={() => setMenu(!menu)}>Spaces</Button></Lift>
            <Lift><Button variant="outline" size="sm" aria-label="Previous pane" disabled={idx === 0} onClick={() => go(idx - 1)}>‹</Button></Lift>
            <span style={{ display: "flex", gap: 6, padding: "0 var(--space-2)" }}>
              {panes.map((p, i) => (
                <button key={p.id} type="button" aria-label={`Go to ${p.title}`} aria-current={i === idx || undefined} onClick={() => go(i)}
                  style={{ width: 8, height: 8, padding: 0, border: 0, borderRadius: "var(--radius-pill)", background: i === idx ? "var(--accent)" : "var(--border-strong)", cursor: "pointer" }} />
              ))}
            </span>
            <span style={{ ...mono, color: "var(--muted-foreground)" }}>{idx + 1} / {panes.length}</span>
            <Lift><Button variant="outline" size="sm" aria-label="Next pane" disabled={idx === last} onClick={() => go(idx + 1)}>›</Button></Lift>
            <Lift><Button variant="outline" size="sm" aria-pressed={follow} onClick={() => setFollow(!follow)}>Follow</Button></Lift>
            <Lift><Button variant="outline" size="sm" onClick={recenter}>Recenter</Button></Lift>
          </div>
        </div>
        <div ref={spaces} style={{ position: "absolute", left: 0, top: 0, ...s3d }}>
          <nav aria-label="Spaces" style={{ width: 220, display: "flex", flexDirection: "column", gap: "var(--space-1)", padding: "var(--space-3)", background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-lg)" }}>
            <span style={{ ...mono, color: "var(--faint-foreground)", padding: "var(--space-1) var(--space-2)" }}>Spaces</span>
            {panes.map((p, i) => (
              <button key={p.id} type="button" onClick={() => { go(i); setMenu(false) }} aria-current={i === idx || undefined}
                style={{ textAlign: "left", font: "inherit", color: i === idx ? "var(--foreground)" : "var(--muted-foreground)", background: i === idx ? "var(--muted)" : "transparent", border: 0, borderRadius: "var(--radius-sm)", padding: "var(--space-2)", cursor: "pointer" }}>{p.title}</button>
            ))}
          </nav>
        </div>
      </div>
    </div>
  )
}

type Rot = { x: number; y: number; z: number; pull: boolean }
const REST: Rot = { x: -14, y: 22, z: 0, pull: false }

/** A turnable stage: drag to orbit; Flip, Turn, Roll and Pull out move the object. Anything inside is 3-D content. */
export function Orbit({ title, tier, width = 520, height = 300, children }: { title?: string; tier?: TierId; width?: number; height?: number; children: React.ReactNode }) {
  const [r, setR] = React.useState<Rot>(REST)
  const [dragging, setDragging] = React.useState(false)
  const d = React.useRef<{ x: number; y: number } | null>(null)
  const move = (e: React.PointerEvent) => {
    if (!d.current) return
    const dx = e.clientX - d.current.x, dy = e.clientY - d.current.y
    d.current = { x: e.clientX, y: e.clientY }
    setR((o) => ({ ...o, y: o.y + dx * 0.5, x: o.x - dy * 0.5 }))
  }
  return (
    <figure style={{ margin: 0, display: "grid", gap: "var(--space-3)", width }}>
      {(title || tier) && (
        <figcaption style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "var(--space-3)" }}>
          <span style={{ color: "var(--foreground)" }}>{title}</span>
          {tier && <Tier id={tier} />}
        </figcaption>
      )}
      <div data-spatial-grab role="img" aria-label={`${title ?? "Graph"}, turnable`} style={{ height, perspective: 900, display: "flex", alignItems: "center", justifyContent: "center", cursor: dragging ? "grabbing" : "grab", touchAction: "none" }}
        onPointerDown={(e) => { e.stopPropagation(); d.current = { x: e.clientX, y: e.clientY }; setDragging(true); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId) }}
        onPointerMove={move} onPointerUp={() => { d.current = null; setDragging(false) }} onPointerCancel={() => { d.current = null; setDragging(false) }}>
        <div style={{ ...s3d, transform: `translateZ(${r.pull ? 160 : 0}px) rotateX(${r.x}deg) rotateY(${r.y}deg) rotateZ(${r.z}deg)`, transition: dragging ? "none" : "transform var(--motion-slow) var(--motion-ease)" }}>
          {children}
        </div>
      </div>
      <div role="group" aria-label="Turn the graph" style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}>
        <Button variant="outline" size="sm" onClick={() => setR((o) => ({ ...o, x: o.x + 180 }))}>Flip</Button>
        <Button variant="outline" size="sm" onClick={() => setR((o) => ({ ...o, y: o.y + 180 }))}>Turn</Button>
        <Button variant="outline" size="sm" onClick={() => setR((o) => ({ ...o, z: o.z + 90 }))}>Roll</Button>
        <Button variant="outline" size="sm" aria-pressed={r.pull} onClick={() => setR((o) => ({ ...o, pull: !o.pull }))}>{r.pull ? "Push in" : "Pull out"}</Button>
        <Button variant="outline" size="sm" onClick={() => setR(REST)}>Reset</Button>
      </div>
    </figure>
  )
}

const face = (w: number, h: number, t: string, extra: React.CSSProperties = {}): React.CSSProperties => ({
  position: "absolute", left: "50%", top: "50%", width: w, height: h, marginLeft: -w / 2, marginTop: -h / 2, transform: t, boxSizing: "border-box", ...extra,
})

/** Any flat chart as a slab with depth: the chart on the front, the same chart on the reverse side (labelled so), rim faces. */
export function OrbitGraph({ title, tier, width = 520, height = 300, depth = 40, children }: { title?: string; tier?: TierId; width?: number; height?: number; depth?: number; children: React.ReactNode }) {
  const w = width, h = height
  const plate: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border-strong)", borderRadius: "var(--radius-sm)", backfaceVisibility: "hidden", overflow: "hidden" }
  const rim: React.CSSProperties = { background: "var(--muted)", border: "1px solid var(--border)" }
  return (
    <Orbit title={title} tier={tier} width={w} height={h + 80}>
      <div style={{ position: "relative", width: w, height: h, ...s3d }}>
        <div style={face(w, h, `translateZ(${depth / 2}px)`, plate)}>{children}</div>
        <div style={face(w, h, `rotateY(180deg) translateZ(${depth / 2}px)`, plate)}>
          <span style={{ ...mono, position: "absolute", right: "var(--space-3)", top: "var(--space-2)", color: "var(--faint-foreground)" }}>Reverse side</span>
          {children}
        </div>
        <div style={face(w, depth, `rotateX(90deg) translateZ(${h / 2}px)`, rim)} />
        <div style={face(w, depth, `rotateX(-90deg) translateZ(${h / 2}px)`, rim)} />
        <div style={face(depth, h, `rotateY(90deg) translateZ(${w / 2}px)`, rim)} />
        <div style={face(depth, h, `rotateY(-90deg) translateZ(${w / 2}px)`, rim)} />
      </div>
    </Orbit>
  )
}

/** Categories as boxes standing on a floor: height is the value, colour the sequential ramp (a second cue, never the only one). */
export function OrbitBars({ title, tier, values, labels, max, format = (v) => v.toFixed(1), valueLabel, width = 520, height = 220, depth = 36 }: {
  title?: string; tier?: TierId; values: number[]; labels: string[]; max?: number; format?: (v: number) => string; valueLabel?: string; width?: number; height?: number; depth?: number
}) {
  if (values.length !== labels.length) throw new Error("OrbitBars: one label per value")
  values.forEach((v) => { if (!Number.isFinite(v) || v < 0) throw new Error(`OrbitBars: ${v} is not a finite value ≥ 0`) })
  const top = max ?? Math.max(...values, 1e-9)
  const n = values.length, gap = 14, bw = (width - gap * (n + 1)) / n
  const floor: React.CSSProperties = { background: "var(--card)", border: "1px solid var(--border-strong)" }
  return (
    <Orbit title={title} tier={tier} width={width} height={height + 120}>
      <div style={{ position: "relative", width, height, ...s3d }}>
        <div style={face(width, depth + 40, `translateY(${height / 2}px) rotateX(90deg)`, floor)} />
        {values.map((v, i) => {
          const bh = (v / top) * height
          const x = -width / 2 + gap + i * (bw + gap) + bw / 2
          const k = 3 + Math.round((v / top) * 9)
          const c = `var(--seq-${k})`
          const side: React.CSSProperties = { background: c, opacity: 0.82, border: "1px solid var(--border)" }
          return (
            <div key={labels[i]} style={{ position: "absolute", left: "50%", top: "50%", ...s3d, transform: `translate3d(${x}px, ${height / 2 - bh / 2}px, 0)` }}>
              <div style={face(bw, bh, `translateZ(${depth / 2}px)`, { background: c, border: "1px solid var(--border)" })} />
              <div style={face(bw, bh, `rotateY(180deg) translateZ(${depth / 2}px)`, side)} />
              <div style={face(depth, bh, `rotateY(90deg) translateZ(${bw / 2}px)`, side)} />
              <div style={face(depth, bh, `rotateY(-90deg) translateZ(${bw / 2}px)`, side)} />
              <div style={face(bw, depth, `rotateX(90deg) translateZ(${bh / 2}px)`, { background: c, border: "1px solid var(--border-strong)" })} />
              <span style={{ ...face(bw + 40, 16, `translate3d(0, ${-bh / 2 - 14}px, ${depth / 2}px)`), textAlign: "center", fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--foreground)" }}>{format(v)}</span>
              <span style={{ ...face(bw + 40, 16, `translate3d(0, ${bh / 2 + 14}px, ${depth / 2 + 20}px)`), ...mono, textAlign: "center", color: "var(--muted-foreground)" }}>{labels[i]}</span>
            </div>
          )
        })}
        {valueLabel && <span style={{ ...face(width, 16, `translate3d(0, ${-height / 2 - 30}px, 0)`), ...mono, color: "var(--faint-foreground)" }}>{valueLabel}</span>}
      </div>
    </Orbit>
  )
}
