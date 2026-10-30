// The DASHBOARD frames: a KPI strip, stacked panels on one gutter, a category strip with legend,
// event cards, a disclosure and a p-value cell. They carry the frame, type and legend; marks inside a
// panel or strip are drawn by the caller (canvas or SVG). Same classes as design.css.
import * as React from "react"
import { cn } from "../lib/utils"

export function Kpis({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-kpis", className)} {...p} />
}

export function Kpi({ label, value, note, className, ...p }: Omit<React.HTMLAttributes<HTMLDivElement>, "children"> & {
  label: React.ReactNode; value: React.ReactNode; note?: React.ReactNode
}) {
  return (
    <div className={cn("ui-kpi", className)} {...p}>
      <span className="ui-kpi__label">{label}</span>
      <div className="ui-kpi__value">{value}</div>
      {note != null && <p className="ui-kpi__note">{note}</p>}
    </div>
  )
}

/** A stack of panels that share one left gutter (`--panel-gutter`, 56px), so axes line up. */
export function Panels({ keys, children, className, ...p }: React.HTMLAttributes<HTMLDivElement> & { keys?: React.ReactNode }) {
  return <div className={cn("ui-panels", className)} {...p}>{children}{keys != null && <div className="ui-panels__keys">{keys}</div>}</div>
}

export function Panel({ title, sub, children, className, ...p }: Omit<React.HTMLAttributes<HTMLDivElement>, "title"> & {
  title: React.ReactNode; sub?: React.ReactNode
}) {
  return (
    <div className={cn("ui-panel", className)} {...p}>
      <div className="ui-panel__head"><h3 className="ui-panel__title">{title}</h3>{sub != null && <span className="ui-panel__sub">{sub}</span>}</div>
      {children}
    </div>
  )
}

/** A legend entry for a panel stack: a solid line, a dashed line, or a filled swatch. */
export function Key({ kind, className, ...p }: React.HTMLAttributes<HTMLSpanElement> & { kind?: "dash" | "fill" }) {
  return <span className={cn("ui-key", className)} data-kind={kind} {...p} />
}

export type StripLegendItem = { label: string; swatch: string; note?: string }

/** A category strip: legend, a well for the marks, and a line saying what the cursor is on. */
export function ColorStrip({ legend, now, children, className }: {
  legend: StripLegendItem[]; now?: React.ReactNode; children: React.ReactNode; className?: string
}) {
  return (
    <div className={cn("ui-strip", className)}>
      <div className="ui-strip__legend">
        {legend.map((l) => (
          <span key={l.label}><i style={{ "--swatch": l.swatch } as React.CSSProperties} />{l.label}{l.note && <> <em>{l.note}</em></>}</span>
        ))}
      </div>
      {children}
      {now != null && <p className="ui-strip__now">{now}</p>}
    </div>
  )
}

export function Events({ className, ...p }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-events", className)} {...p} />
}

/** One event: a title, an optional tier badge, an optional trace, and label/value rows. */
export function EventCard({ title, badge, trace, rows, current, hit, onClick, className }: {
  title: React.ReactNode; badge?: React.ReactNode; trace?: React.ReactNode
  rows: [React.ReactNode, React.ReactNode][]; current?: boolean; hit?: boolean; onClick?: () => void; className?: string
}) {
  const body = (
    <>
      <div className="ui-event__head"><span className="ui-event__title">{title}</span>{badge}</div>
      {trace}
      <dl>{rows.map(([k, v], i) => <React.Fragment key={i}><dt>{k}</dt><dd>{v}</dd></React.Fragment>)}</dl>
    </>
  )
  const props = { className: cn("ui-event", className), "aria-current": current ? ("true" as const) : undefined, "data-hit": hit ? "" : undefined }
  return onClick ? <button type="button" onClick={onClick} {...props}>{body}</button> : <div {...props}>{body}</div>
}

/** A collapsed explanation. The label stays; the prose is behind it. */
export function Disclosure({ label, children, className }: { label: React.ReactNode; children: React.ReactNode; className?: string }) {
  return <details className={cn("ui-disclosure", className)}><summary>{label}</summary>{children}</details>
}

/** A p-value table cell. `reject` outlines it; the number is always shown. */
export function PCell({ p, alpha = 0.05 }: { p: number; alpha?: number }) {
  return <td className="ui-pcell" data-reject={p <= alpha ? "" : undefined}>{p < 0.001 ? "< 0.001" : p.toFixed(3)}</td>
}
