import * as React from "react"
import { cn } from "@/lib/utils"

/**
 * MEASURED and PREDICTED never share styling: measured is the measured hue, upright;
 * predicted is the predicted hue, italic. Two channels, so neither depends on colour alone.
 */
export function Value({ kind, className, children }: { kind: "measured" | "predicted"; className?: string; children: React.ReactNode }) {
  return (
    <span
      data-kind={kind}
      className={cn("font-mono tabular-nums", kind === "predicted" && "italic", className)}
      style={{ color: `var(--tier-${kind})` }}
    >
      {children}
    </span>
  )
}

export type ReadoutItem = { label: string; value: React.ReactNode; source: string }

/** Measured figures in tabular mono, each with where the number came from. */
export function Readout({ items, className }: { items: ReadoutItem[]; className?: string }) {
  return (
    <dl className={cn("grid grid-cols-[repeat(auto-fit,minmax(10rem,1fr))] gap-4", className)}>
      {items.map((it) => (
        <div key={it.label} className="border-t pt-2">
          <dt className="font-mono text-[11px] uppercase tracking-[.2em] text-muted-foreground">{it.label}</dt>
          <dd className="mt-1 font-mono text-lg tabular-nums">
            {it.value}
            <small className="block font-sans text-xs text-muted-foreground">{it.source}</small>
          </dd>
        </div>
      ))}
    </dl>
  )
}
