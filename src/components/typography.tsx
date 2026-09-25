import * as React from "react"
import { cn } from "../lib/utils"

const DISPLAY = {
  1: "text-[clamp(2.3rem,6vw,3.4rem)]",
  2: "text-3xl",
  3: "text-2xl",
} as const

/** Headings: Instrument Serif, regular case, never uppercased. */
export function Display({ level = 1, className, children }: { level?: 1 | 2 | 3; className?: string; children: React.ReactNode }) {
  const Tag = (`h${level}` as "h1" | "h2" | "h3")
  return <Tag className={cn("font-display leading-[1.05] tracking-[-.015em] normal-case", DISPLAY[level], className)}>{children}</Tag>
}

/** Uppercase is ALWAYS the mono face. */
export function Eyebrow({ accent = false, className, children }: { accent?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <p className={cn("font-mono text-[11px] uppercase tracking-[.2em]", accent ? "text-primary" : "text-muted-foreground", className)}>
      {children}
    </p>
  )
}

/** The subtitle: differs from running text by colour and measure, not size. */
export function Standfirst({ className, children }: { className?: string; children: React.ReactNode }) {
  return <p className={cn("max-w-prose text-base text-muted-foreground", className)}>{children}</p>
}
