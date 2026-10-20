/**
 * Controls — React renderers for controls.css, the same classes controls.js enhances on a
 * zero-build page. The behaviour IS controls.js: these components render its markup and
 * call initControl / initHold / mountTimeline / mountLane / mountPanner, so the drag, the
 * fine adjust, the detents and the drawing cannot disagree between the two forms.
 *
 * Values are reported as they move (onChange) and when a gesture ends (onCommit). Every
 * number is printed with its unit, and every limit is drawn rather than silently applied.
 * A crossed detent fires a bubbling `ui-detent` DOM event: listen for it to drive haptics.
 */
import * as React from "react"
import {
  initControl, initHold, mountLane, mountPanner, mountTimeline, formatValue,
  type ControlHandle, type ControlOptions, type HoldHandle, type LaneHandle, type LaneOptions,
  type PannerHandle, type PannerOptions, type Scale, type TimelineHandle, type TimelineOptions,
} from "../../controls.js"
import { cn } from "../lib/utils"

export type {
  Scene, SceneEnding, TimelineCurve, TimelineOptions, LaneOptions, PannerOptions, MotionPath, DetentDetail, Scale,
} from "../../controls.js"
export { layoutScenes, valueAt, pathPoint, formatValue, toFrac, fromFrac, snap } from "../../controls.js"

/** Keep the latest callbacks without re-running an effect when a parent re-renders. */
function useLatest<T>(value: T) {
  const ref = React.useRef(value)
  ref.current = value
  return ref
}

/** Data props only (functions dropped), so an effect re-runs when the data changes. */
function dataKey(o: object) {
  return JSON.stringify(o, (_, v) => (typeof v === "function" ? undefined : v))
}

/* ---------- Fader and knob ---------- */

type RangeProps = {
  /** The control's name; it labels the input. */
  label: string
  value: number
  min: number
  max: number
  /** 0 or omitted: continuous. */
  step?: number
  unit?: string
  digits?: number
  signed?: boolean
  scale?: Scale
  /** Values a drag snaps to; PageUp / PageDown jump between them. */
  detents?: number[]
  /** The person's own value, drawn in the human ink; also a detent. */
  mark?: number | null
  markLabel?: string
  ticks?: number
  format?: (value: number) => string
  /** Printed beside the value, e.g. a <LinkedValue>. */
  adornment?: React.ReactNode
  /** Print the two hard limits under the control. Default true. */
  showRange?: boolean
  disabled?: boolean
  onChange?: (value: number) => void
  onCommit?: (value: number) => void
  className?: string
  id?: string
}

function useRangeControl(p: RangeProps, el: React.RefObject<HTMLDivElement | null>) {
  const cb = useLatest(p)
  const handle = React.useRef<ControlHandle | null>(null)
  const opts: ControlOptions = {
    scale: p.scale, detents: p.detents, mark: p.mark ?? null, markLabel: p.markLabel, unit: p.unit,
    digits: p.digits, signed: p.signed, ticks: p.ticks,
  }
  const key = dataKey(opts)
  React.useEffect(() => {
    const h = initControl(el.current, {
      ...opts, value: p.value,
      format: (v) => (cb.current.format ? cb.current.format(v) : formatValue(v, cb.current)),
      onInput: (v) => cb.current.onChange?.(v),
      onChange: (v) => cb.current.onCommit?.(v),
    })
    handle.current = h
    return () => { h?.destroy(); handle.current = null }
    // mount once per range; data changes go through update() below
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [p.min, p.max, p.scale])
  React.useEffect(() => { handle.current?.update(opts) }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { const h = handle.current; if (h && h.value !== p.value) h.set(p.value) }, [p.value])
}

function RangeShell({ p, children }: { p: RangeProps; children: React.ReactNode }) {
  const auto = React.useId()
  const id = p.id ?? auto
  const fmt = (v: number) => (p.format ? p.format(v) : formatValue(v, p))
  return (
    <div className={cn("ui-control", p.className)}>
      <div className="ui-control__head">
        <label className="ui-control__name" htmlFor={id}>{p.label}</label>
        {p.adornment}
        {/* controls.js prints the value here; tapping it opens numeric entry */}
        <button type="button" className="ui-control__value" aria-label={`Type a value for ${p.label}`} />
      </div>
      {children}
      {p.showRange !== false && (
        <div className="ui-control__range" aria-hidden="true">
          <span>{fmt(p.min)}</span><span className="ui-control__max">{fmt(p.max)} max</span>
        </div>
      )}
    </div>
  )
}

/** A detented fader: horizontal, vertical (a channel strip) or a bipolar ribbon (balance, ITD). */
export function Fader({ orientation = "horizontal", variant = "default", ...p }: RangeProps & {
  orientation?: "horizontal" | "vertical"
  variant?: "default" | "ribbon"
}) {
  const el = React.useRef<HTMLDivElement>(null)
  const auto = React.useId()
  const id = p.id ?? auto
  useRangeControl(p, el)
  return (
    <RangeShell p={{ ...p, id }}>
      <div
        ref={el}
        key={`${p.min}:${p.max}:${p.scale}`}
        className={cn("ui-fader", variant === "ribbon" && "ui-fader--ribbon", orientation === "vertical" && "ui-fader--vertical")}
        aria-disabled={p.disabled || undefined}
      >
        <input id={id} type="range" min={p.min} max={p.max} step={p.step || "any"} defaultValue={p.value} disabled={p.disabled} />
      </div>
    </RangeShell>
  )
}

/** A knob. Drag up to raise it; move the finger sideways, away from the knob, for fine steps. */
export function Knob({ size = "md", ...p }: RangeProps & { size?: "sm" | "md" | "lg" }) {
  const el = React.useRef<HTMLDivElement>(null)
  const auto = React.useId()
  const id = p.id ?? auto
  useRangeControl(p, el)
  return (
    <RangeShell p={{ ...p, id, showRange: p.showRange ?? false }}>
      <div
        ref={el}
        key={`${p.min}:${p.max}:${p.scale}`}
        className={cn("ui-knob", size === "sm" && "ui-knob--sm", size === "lg" && "ui-knob--lg")}
        aria-disabled={p.disabled || undefined}
      >
        <input id={id} type="range" min={p.min} max={p.max} step={p.step || "any"} defaultValue={p.value} disabled={p.disabled} />
      </div>
    </RangeShell>
  )
}

/* ---------- Chips ---------- */

/** A value resolved from what a person owns (their calibration). The resolved number is always shown. */
export function LinkedValue({ formula, resolved, onUnlink, className }: {
  /** e.g. "my centre + 160 µs" */
  formula: React.ReactNode
  /** e.g. "+120 µs" */
  resolved?: React.ReactNode
  onUnlink?: () => void
  className?: string
}) {
  return (
    <span className={cn("ui-tag--linked", className)}>
      <svg viewBox="0 0 10 10" aria-hidden="true"><path d="M4 6a2 2 0 0 0 3 0l2-2a2 2 0 0 0-3-3L5 2M6 4a2 2 0 0 0-3 0L1 6a2 2 0 0 0 3 3l1-1" /></svg>
      {formula}
      {resolved != null && <span className="ui-tag__resolved">= {resolved}</span>}
      {onUnlink && <button type="button" className="ui-tag__unlink" onClick={onUnlink} aria-label="Unlink and keep the number">×</button>}
    </span>
  )
}

/** What moves between two neighbouring states. */
export function Delta({ name, from, to, direction, className }: {
  name: React.ReactNode; from: React.ReactNode; to: React.ReactNode; direction?: "up" | "down"; className?: string
}) {
  return (
    <span className={cn("ui-delta", className)} data-direction={direction}>
      {name} {from}→<span className="ui-delta__to">{to}</span>
    </span>
  )
}

export type SyncState = "saved" | "saving" | "offline" | "conflict"
const SYNC_WORD: Record<SyncState, string> = { saved: "saved", saving: "saving…", offline: "offline", conflict: "conflict" }

/** Save state: a word and a glyph always, colour only on top. Clickable when given onClick. */
export function SyncPill({ state, children, onClick, className }: {
  state: SyncState; children?: React.ReactNode; onClick?: () => void; className?: string
}) {
  const body = children ?? SYNC_WORD[state]
  return onClick
    ? <button type="button" className={cn("ui-sync", className)} data-state={state} onClick={onClick}>{body}</button>
    : <span className={cn("ui-sync", className)} data-state={state} role="status">{body}</span>
}

/* ---------- Readouts ---------- */

/** Values travelling from one state to the next, with how far through the glide they are. */
export function Glide({ rows, className }: {
  rows: { name: React.ReactNode; span: React.ReactNode; now: React.ReactNode; progress?: number; held?: boolean }[]
  className?: string
}) {
  return (
    <div className={cn("ui-glide", className)}>
      {rows.map((r, i) => (
        <div className="ui-glide__row" key={i} data-held={r.held || undefined}>
          <span className="ui-glide__name">{r.name}</span>
          <span className="ui-glide__span">{r.span}</span>
          <span className="ui-glide__bar" style={{ "--progress": String(r.progress ?? 0) } as React.CSSProperties}
            role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round((r.progress ?? 0) * 100)} />
          <span className="ui-glide__now">{r.now}</span>
        </div>
      ))}
    </div>
  )
}

/** A left/right level meter. Levels and peaks are 0…1 of the meter's own scale. */
export function Meter({ left, right, peakLeft, peakRight, height = 40, label = "Output level", className }: {
  left: number; right: number; peakLeft?: number; peakRight?: number; height?: number; label?: string; className?: string
}) {
  const ch = (level: number, peak?: number) => ({ "--level": String(level), "--peak": String(peak ?? level) }) as React.CSSProperties
  return (
    <div className={cn("ui-meter-wrap", className)} role="img" aria-label={`${label}: left ${Math.round(left * 100)}%, right ${Math.round(right * 100)}%`}>
      <div className="ui-meter" style={{ "--meter-h": `${height}px` } as React.CSSProperties}>
        <span className="ui-meter__ch" style={ch(left, peakLeft)} />
        <span className="ui-meter__ch" style={ch(right, peakRight)} />
      </div>
      <div className="ui-meter__label" aria-hidden="true">L R</div>
    </div>
  )
}

/* ---------- Mixer ---------- */

/** One channel strip. Put a vertical <Fader> (and anything else) in its children. */
export function ChannelStrip({ name, value, muted, soloed, onMute, onSolo, focus, follows, children, className }: {
  name: React.ReactNode
  value?: React.ReactNode
  muted?: boolean
  soloed?: boolean
  onMute?: (on: boolean) => void
  onSolo?: (on: boolean) => void
  /** Draw it as the strip in focus. */
  focus?: boolean
  /** It follows another strip (e.g. a mirrored ear) and is shown dimmed. */
  follows?: boolean
  children?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn("ui-strip", className)} data-focus={focus || undefined} data-follows={follows || undefined}>
      <div className="ui-strip__name">{name}</div>
      {children}
      {value != null && <div className="ui-strip__value">{value}</div>}
      {(onMute || onSolo) && (
        <div className="ui-strip__ms">
          {onMute && <button type="button" className="ui-strip__mute" aria-pressed={!!muted} onClick={() => onMute(!muted)}>M</button>}
          {onSolo && <button type="button" className="ui-strip__solo" aria-pressed={!!soloed} onClick={() => onSolo(!soloed)}>S</button>}
        </div>
      )}
    </div>
  )
}

export function ChannelStrips({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("ui-strips", className)}>{children}</div>
}

/* ---------- Hazard + hold to confirm ---------- */

/** A hatched surface for something off by default that should feel harder to switch on. */
export function Hazard({ children, className, ...rest }: React.ComponentProps<"div">) {
  return <div className={cn("ui-hazard", className)} {...rest}>{children}</div>
}

/** Switches ON only after a held press (default 700 ms); OFF with a tap. */
export function HoldButton({ on, onChange, ms, children, className, label }: {
  on: boolean; onChange: (on: boolean) => void; ms?: number; children: React.ReactNode; className?: string; label?: string
}) {
  const el = React.useRef<HTMLButtonElement>(null)
  const cb = useLatest(onChange)
  const h = React.useRef<HoldHandle | null>(null)
  React.useEffect(() => {
    h.current = initHold(el.current, { ms, onChange: (v) => cb.current(v) })
    return () => { h.current?.destroy(); h.current = null }
  }, [ms]) // eslint-disable-line react-hooks/exhaustive-deps
  React.useEffect(() => { h.current?.set(on) }, [on])
  return (
    <button ref={el} type="button" className={cn("ui-hold", className)} aria-pressed={on} aria-label={label}
      title={on ? "Tap to switch off" : "Press and hold to switch on"}>
      <span>{children}</span>
    </button>
  )
}

/* ---------- SVG views ---------- */

function useMounted<H extends { update(o: object): void; destroy(): void }, O extends object>(
  mount: (host: HTMLElement, o: O) => H | null, options: O,
) {
  const host = React.useRef<HTMLDivElement>(null)
  const view = React.useRef<H | null>(null)
  const latest = useLatest(options)
  // Callbacks are forwarded through a ref, so a parent re-render never re-mounts the view.
  const proxied = (o: O) => Object.fromEntries(Object.entries(o).map(([k, v]) =>
    [k, typeof v === "function" ? (...a: unknown[]) => ((latest.current as Record<string, unknown>)[k] as (...x: unknown[]) => unknown)?.(...a) : v])) as O
  React.useEffect(() => {
    if (!host.current) return
    const v = mount(host.current, proxied(options))
    view.current = v
    return () => { v?.destroy(); view.current = null }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  const key = dataKey(options)
  React.useEffect(() => { view.current?.update(proxied(latest.current)) }, [key]) // eslint-disable-line react-hooks/exhaustive-deps
  return host
}

/** Scenes on a timeline: blocks for holds, wedges for transitions, curves, a playhead, endings. */
export function SceneTimeline({ className, ...options }: TimelineOptions & { className?: string }) {
  const host = useMounted<TimelineHandle, TimelineOptions>(mountTimeline, options)
  return <div ref={host} className={className} />
}

/** One parameter across the scenes, with draggable points, notches and a linked curve. */
export function AutomationLane({ className, ...options }: LaneOptions & { className?: string }) {
  const host = useMounted<LaneHandle, LaneOptions>(mountLane, options)
  return <div ref={host} className={className} />
}

/** A top-down head in a room: drag the source; its motion path is drawn when it moves. */
export function Panner({ className, ...options }: PannerOptions & { className?: string }) {
  const host = useMounted<PannerHandle, PannerOptions>(mountPanner, options)
  return <div ref={host} className={className} />
}

/* ---------- Phone chrome ---------- */

/** A bottom tab bar. The current item carries aria-current="page". */
export function TabBar({ items, className, label = "Sections" }: {
  items: { label: string; icon?: React.ReactNode; href?: string; onClick?: () => void; current?: boolean }[]
  className?: string
  label?: string
}) {
  return (
    <nav className={cn("ui-tabbar", className)} aria-label={label}>
      {items.map((it) => {
        const body = <>{it.icon}{it.label}</>
        const cur = it.current ? "page" : undefined
        return it.href
          ? <a key={it.label} className="ui-tabbar__item" href={it.href} aria-current={cur}>{body}</a>
          : <button key={it.label} type="button" className="ui-tabbar__item" onClick={it.onClick} aria-current={cur}>{body}</button>
      })}
    </nav>
  )
}

/** Night playback: very low luminance, one large target, nothing that needs reading. */
export function NightView({ time, sub, progress = 0, playing, onToggle, hint, className }: {
  time: string; sub?: string; progress?: number; playing: boolean; onToggle: () => void; hint?: string; className?: string
}) {
  return (
    <div className={cn("ui-night", className)}>
      <div style={{ textAlign: "center" }}>
        <div className="ui-night__time">{time}</div>
        {sub && <div className="ui-night__sub">{sub}</div>}
      </div>
      <div className="ui-night__progress" style={{ "--progress": String(progress) } as React.CSSProperties}
        role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)} aria-label="Session progress" />
      <button type="button" className="ui-night__play" onClick={onToggle} aria-label={playing ? "Pause" : "Play"}>
        {playing
          ? <svg viewBox="0 0 44 50" aria-hidden="true"><rect x="4" y="2" width="12" height="46" rx="3" /><rect x="28" y="2" width="12" height="46" rx="3" /></svg>
          : <svg viewBox="0 0 44 50" aria-hidden="true"><path d="M8 3l32 22-32 22z" /></svg>}
      </button>
      {hint && <div className="ui-night__hint">{hint}</div>}
    </div>
  )
}
