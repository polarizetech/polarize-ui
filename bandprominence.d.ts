/** Types for bandprominence.js (a zero-build ES module; see the file header). */
export type ProminenceBand = {
  key: string
  name: string
  /** Lower and upper edge in Hz. */
  lo: number
  hi: number
  /** Seconds the threshold remembers. Default 4. */
  memory?: number
}
export type ProminenceMeasure = "share" | "baseline"
export type BandProminenceOptions = {
  /** Sample rate in Hz. Required before samples can be read; push(…, { rate }) also sets it. */
  rate?: number
  /** Default: delta 1–4, theta 4–8, alpha 8–13, beta 13–30, gamma 30–45 Hz. */
  bands?: ProminenceBand[]
  /** 'share' (default): relative band power. 'baseline': amplitude ÷ the band's own long-run mean. */
  measure?: ProminenceMeasure
  /** Seconds of the long-run mean in 'baseline' mode. Default 30. */
  baseline?: number
  /** Threshold = margin × recent mean level, in 'baseline' mode. Default 1.5. */
  margin?: number
  /** Seconds of threshold history drawn. Default 30. */
  span?: number
  /** Top of the level axis. Default 1 ('share') or 3 ('baseline'). */
  ymax?: number | null
  /** Canvas height in CSS pixels. Default 300. */
  height?: number
  /** Unit of the pushed samples. Default 'µV'. */
  unit?: string
  /** Shown in the status line, e.g. the channel. */
  source?: string
  /** Accessible name for the canvas. */
  label?: string
}
export type BandReading = {
  key: string
  name: string
  lo: number
  hi: number
  memory: number
  /** False when the band's upper edge is at or above 45 % of the sample rate. */
  usable: boolean
  /** In the samples' unit; null when not usable. */
  amplitude: number | null
  level: number | null
  threshold: number | null
  prominent: boolean
  lead: boolean
}
export type BandProminenceCore = {
  push(values: ArrayLike<number>): void
  /** Samples were lost: restart the filters, keep the averages. */
  gap(): void
  readonly seconds: number
  readonly rate: number
  readonly lead: number
  readonly measure: ProminenceMeasure
  bins(index: number): (number | null)[]
  state(): BandReading[]
}
export type BandProminenceHandle = {
  /** Append samples. meta.rate changes the rate (and starts over); meta.gap > 0 restarts the filters. */
  push(values: ArrayLike<number>, meta?: { rate?: number; gap?: number }): void
  /** Follow an element that emits `signal-samples` (and `signal-connected`), e.g. <signal-panel>. Returns stopListening. */
  listenTo(target: EventTarget): () => void
  stopListening(): void
  state(): BandReading[]
  update(next: BandProminenceOptions): void
  reset(): void
  destroy(): void
}
export const DEFAULT_BANDS: ProminenceBand[]
/** The band arithmetic without a canvas. Throws without a rate. */
export function createBandProminence(opts: BandProminenceOptions & { rate: number }): BandProminenceCore
/** Mount a view inside `host`; returns null when a 2-D canvas is unavailable. */
export function mountBandProminence(host: HTMLElement, opts?: BandProminenceOptions): BandProminenceHandle | null
