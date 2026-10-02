/** Types for tissue-field.js (a zero-build ES module that registers <tissue-field>; see the file header). */
export type TissueTier = 'A' | 'MEASURED' | 'PHYSICS' | 'B' | 'PREDICTED' | 'MODELLED' | 'C' | 'EXPLORATORY' | 'SPEC' | 'ADDED' | 'TASTE' | 'REFUTED'

/** A `tissue-field/1` document. Typed arrays or plain arrays are both accepted. */
export interface TissueFieldDocument {
  format: 'tissue-field/1'
  meta: {
    title: string
    tier: TissueTier
    /** What produced these numbers. Required. */
    source: string
    /** `schematic`, `anatomical`, or `registered:<space>`. Required. */
    layout: string
    units: string
    domain: [number, number]
    /** Each note renders collapsed beside the tier badge. */
    notes?: string[]
    [k: string]: unknown
  }
  groups: { name: string }[]
  cells: { n: number; pos: ArrayLike<number>; kind: ArrayLike<number>; group: ArrayLike<number>; map?: unknown }
  synapses?: { n: number; pre: ArrayLike<number>; post: ArrayLike<number>; weight: ArrayLike<number>; delay_ms: ArrayLike<number>; kind?: ArrayLike<number> }
  frames: { n: number; dt_ms: number; activation: ArrayLike<number>; source?: ArrayLike<number> }
  /** Drawn as pulses. Omit when no per-spike record exists: nothing is invented. */
  transmissions?: { n?: number; t_ms: ArrayLike<number>; syn: ArrayLike<number> }
  context?: { meshes?: unknown[] } | unknown[]
}

export class FieldError extends Error {}
export function validateField(raw: unknown): unknown
export function groupMeans(field: unknown, frame: number): number[]

export class TissueField extends HTMLElement {
  /** Setting validates; throws FieldError and shows its reason on a bad document. */
  set field(raw: TissueFieldDocument)
  get field(): unknown
  readonly info: { t_ms: number; frame: number; playing: boolean; [k: string]: unknown } | null
  play(): void
  pause(): void
  seek(ms: number): void
  seekFrame(k: number): void
}
declare global { interface HTMLElementTagNameMap { 'tissue-field': TissueField } }
