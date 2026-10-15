import { useEffect, useRef } from "react"
import { mountBandProminence } from "../../../bandprominence.js"
import type { BandProminenceHandle, BandProminenceOptions } from "../../../bandprominence.js"

/**
 * How strongly each frequency band stands out in one channel, live. A React wrapper around
 * bandprominence.js (the arithmetic and drawing live there; see its header for what is computed).
 *
 * Feed it either way:
 *  - `samples`: each NEW array is appended (pass a fresh chunk, not the whole recording again);
 *  - `onReady(view)`: keep the handle and call `view.push(chunk)` or `view.listenTo(panel)`.
 */
export function BandProminence({
  samples, onReady, className, ...options
}: BandProminenceOptions & {
  samples?: ArrayLike<number>
  onReady?: (view: BandProminenceHandle) => void
  className?: string
}) {
  const host = useRef<HTMLDivElement>(null)
  const view = useRef<BandProminenceHandle | null>(null)
  const first = useRef(options)

  useEffect(() => {
    if (!host.current) return
    const v = mountBandProminence(host.current, first.current)
    view.current = v
    if (v && onReady) onReady(v)
    return () => { v?.destroy(); view.current = null }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const key = JSON.stringify(options)
  useEffect(() => { view.current?.update(options) }, [key]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (samples && samples.length) view.current?.push(samples) }, [samples])

  return <div ref={host} className={className} />
}
