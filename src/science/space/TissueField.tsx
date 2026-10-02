// <tissue-field> in React: mounts the zero-build element and hands it a tissue-field/1 document.
// Needs the optional peer dependency `three` (the element imports it). Nothing plays sound and
// nothing starts by itself: pass `playing` to start the transport.
import * as React from "react"
import "../../../tissue-field/tissue-field.js"
import type { TissueField as TissueFieldElement, TissueFieldDocument } from "../../../tissue-field/tissue-field"
import { cn } from "../../lib/utils"

export type TissueFieldProps = {
  field: TissueFieldDocument
  /** Start (true) or pause (false) the transport. Default false. */
  playing?: boolean
  onFrame?: (detail: { frame: number; t_ms: number; groups: { name: string; mean: number }[] }) => void
  onPick?: (detail: { cell: number; group: number; kind: number; value: number; units: string } | null) => void
  className?: string
}

export function TissueField({ field, playing = false, onFrame, onPick, className }: TissueFieldProps) {
  const ref = React.useRef<TissueFieldElement | null>(null)
  React.useEffect(() => {
    if (ref.current) ref.current.field = field
  }, [field])
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    if (playing) el.play()
    else el.pause()
  }, [playing, field])
  React.useEffect(() => {
    const el = ref.current
    if (!el) return
    const f = (e: Event) => onFrame?.((e as CustomEvent).detail)
    const p = (e: Event) => onPick?.((e as CustomEvent).detail)
    el.addEventListener("tissue-frame", f)
    el.addEventListener("tissue-pick", p)
    return () => { el.removeEventListener("tissue-frame", f); el.removeEventListener("tissue-pick", p) }
  }, [onFrame, onPick])
  // `ref` on a custom element: React 19 forwards it as a plain property reference.
  return React.createElement("tissue-field", { ref, class: cn(className) })
}
