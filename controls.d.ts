/** Types for controls.js (a zero-build ES module; see the file header). */

export type Scale = "linear" | "log"
export type Range = { min?: number; max?: number; scale?: Scale }

export function clamp(v: number, lo: number, hi: number): number
/** Position of `value` along a control, 0…1. A log scale needs min > 0. */
export function toFrac(value: number, range?: Range): number
/** The value at position `frac` (0…1). */
export function fromFrac(frac: number, range?: Range): number
/** Round to `step` from `min`, then clamp. */
export function quantize(value: number, opts?: { min?: number; max?: number; step?: number }): number
/** Pull `value` onto the nearest detent within `tolerance` (a fraction of the travel). index is -1 when none caught it. */
export function snap(value: number, detents?: number[], opts?: Range & { tolerance?: number }): { value: number; index: number }
/** Drag gain for fine adjust: 1 within 24 px of the control's axis, then falling, never below 0.05. */
export function fineGain(offAxisPx: number): number
/** A value with its unit, always. `digits` defaults by magnitude. */
export function formatValue(value: number | null | undefined, opts?: { unit?: string; digits?: number; signed?: boolean }): string
/** Read a typed number (comma decimal and typographic minus accepted). NaN when empty. */
export function parseEntry(text: string): number

/** A held state. `transition` is the glide INTO it, in seconds, and comes before the hold. */
export type Scene = { label?: string; hold: number; transition: number }
export type SceneLayout = { total: number; items: { index: number; rampStart: number; holdStart: number; end: number }[] }
export function layoutScenes(scenes: Scene[]): SceneLayout
/** The value at time `t` (seconds), given one value per scene. Glides are linear, or geometric on a log scale. */
export function valueAt(scenes: Scene[], values: number[], t: number, opts?: { scale?: Scale }): {
  value: number; index: number; phase: "ramp" | "hold" | "end"; progress: number
}

export type MotionPath = "static" | "rock" | "orbit" | "lawnmower"
export type PathOptions = { azimuth?: number; distance?: number; width?: number; rows?: number }
/** Where a moving source is at `phase` (0…1 of one period). Azimuth in degrees, 0 = ahead, + = right, wrapped to ±180. */
export function pathPoint(kind: MotionPath, phase: number, opts?: PathOptions): { azimuth: number; distance: number }
export function pathSamples(kind: MotionPath, opts?: PathOptions, n?: number): { azimuth: number; distance: number }[]

/** Detail of the bubbling `ui-detent` event: the hook a native shell uses for haptics. */
export type DetentDetail = { value: number; index: number; kind: "detent" | "mark" | "notch" | "azimuth" | "confirm" }

export type ControlOptions = {
  value?: number
  scale?: Scale
  /** Values a drag snaps to; PageUp / PageDown jump between them. */
  detents?: number[]
  /** The person's own value (a calibrated centre): drawn in the human ink, and also a detent. */
  mark?: number | null
  markLabel?: string
  unit?: string
  digits?: number
  signed?: boolean
  /** Where a bipolar fill starts. Defaults to 0 when the range spans it, else min. */
  zero?: number
  /** Minor tick count across the travel. */
  ticks?: number
  format?: (value: number) => string
  onInput?: (value: number) => void
  onChange?: (value: number) => void
}
export type ControlHandle = {
  readonly value: number
  set(value: number): void
  update(next: ControlOptions): void
  destroy(): void
}
/** Enhance one .ui-fader or .ui-knob (or a .ui-control holding one). Null without a range input. */
export function initControl(root: Element | null, opts?: ControlOptions): ControlHandle | null

export type HoldHandle = { readonly value: boolean; set(on: boolean): void; destroy(): void }
/** A button that switches ON only after a held press, and OFF with a tap. State is aria-pressed. */
export function initHold(btn: HTMLElement | null, opts?: { ms?: number; onChange?: (on: boolean) => void }): HoldHandle | null

/** How a scene ended, as a marker log records it. Always drawn with its word. */
export type SceneEnding = "met" | "timeout" | "no_data" | "open_loop"
export type TimelineCurve = { label: string; values: number[]; domain?: [number, number]; scale?: Scale; series?: 1 | 2 | 3 | 4 }
export type TimelineOptions = {
  scenes?: Scene[]
  selected?: number
  /** Playhead, in seconds; null hides it. */
  time?: number | null
  /** Value curves drawn across the scenes, one value per scene each. Named in a key below the lane. */
  curves?: TimelineCurve[]
  /** A level drawn as an area along the bottom. */
  bed?: { label?: string; values: number[]; domain?: [number, number]; scale?: Scale } | null
  /** One per scene, drawn as a chip under it. */
  endings?: (SceneEnding | null)[] | null
  height?: number
  /** No block narrower than this (px). When it bites, the lane says it is not to scale. */
  minBlock?: number
  /** Draw handles on the selected scene: its left edge sets the transition, its right edge the hold. */
  editable?: boolean
  seekable?: boolean
  limits?: { transition: [number, number]; hold: [number, number] }
  steps?: { transition: number; hold: number }
  label?: string
  onSelect?: (index: number) => void
  /** After an edit; the timeline has already applied it. */
  onChange?: (e: { index: number; field: "hold" | "transition"; value: number; scenes: Scene[] }) => void
  onSeek?: (seconds: number) => void
}
export type TimelineHandle = { update(next: TimelineOptions): void; setTime(seconds: number | null): void; destroy(): void }
export function mountTimeline(host: HTMLElement, options?: TimelineOptions): TimelineHandle | null

export type LaneOptions = {
  scenes?: Scene[]
  /** One per scene. */
  values?: number[]
  domain?: [number, number]
  scale?: Scale
  unit?: string
  series?: 1 | 2 | 3 | 4
  /** Values a dragged point snaps to, drawn as dashed lines. */
  notches?: number[]
  /** Another parameter roped to this one, drawn dashed in the machine ink. */
  linked?: { label?: string; values: number[] } | null
  /** Hand-drawn points ({ t seconds, v value }), drawn in the human ink. */
  drawn?: { t: number; v: number }[] | null
  /** The person's own value, as a line; also a detent. */
  mark?: number | null
  time?: number | null
  height?: number
  editable?: boolean
  step?: number
  label?: string
  /** After an edit; the lane has already applied it. */
  onChange?: (e: { index: number; value: number; values: number[] }) => void
}
export type LaneHandle = { update(next: LaneOptions): void; setTime(seconds: number | null): void; destroy(): void }
export function mountLane(host: HTMLElement, options?: LaneOptions): LaneHandle | null

export type PannerOptions = {
  /** Degrees, 0 = ahead, + = right. */
  azimuth?: number
  distance?: number
  distanceRange?: [number, number]
  rings?: number[]
  path?: MotionPath
  width?: number
  rows?: number
  /** Where the moving source is now, 0…1 of one period; null hides the dot. */
  phase?: number | null
  disabled?: boolean
  label?: string
  onChange?: (e: { azimuth: number; distance: number }) => void
}
export type PannerHandle = { update(next: PannerOptions): void; setPhase(phase: number | null): void; destroy(): void }
export function mountPanner(host: HTMLElement, options?: PannerOptions): PannerHandle | null

/** Enhance every [data-ui-control] and [data-ui-hold] under `root`. Runs once on load by itself. */
export function init(root?: ParentNode): (ControlHandle | HoldHandle)[]
