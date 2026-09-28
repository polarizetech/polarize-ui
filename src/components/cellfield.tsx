// The cell field in React: the same engine as <ui-cellfield> (cellfield.js), mounted on
// this component's element. Put it first inside a `.ui-cellfield-host`.
import * as React from "react"
import { mountCellField, type CellFieldHandle } from "../../cellfield.js"
import { cn } from "../lib/utils"

export function CellField({ hero, density = 1, intensity = 1, motion = true, className }: {
  /** CSS selector of the element the hero cell sits behind. */
  hero?: string
  density?: number
  intensity?: number
  motion?: boolean
  className?: string
}) {
  const ref = React.useRef<HTMLDivElement>(null)
  const field = React.useRef<CellFieldHandle | null>(null)
  React.useEffect(() => {
    if (!ref.current) return
    field.current = mountCellField(ref.current, { hero, density, intensity, motion })
    return () => { field.current?.destroy(); field.current = null }
    // Mount once; option changes go through update() below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const first = React.useRef(true)
  React.useEffect(() => {
    if (first.current) { first.current = false; return }
    field.current?.update({ hero, density, intensity, motion })
  }, [hero, density, intensity, motion])
  return <div ref={ref} className={cn("ui-cellfield", className)} aria-hidden="true" />
}
