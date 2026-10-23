/** Types for trajectory3d.js (a zero-build ES module; see the file header). */
export type TrajectoryPath = {
  /** [x, y, z] per sample, evenly spaced over `duration`. */
  points: [number, number, number][]
  label?: string
}
export type TrajectoryCamera = {yaw: number; pitch: number; zoom: number}
export type TrajectoryAnnotation = {id?: string; meta?: unknown; label?: string; color?: string; opacity?: number}
export type Trajectory3DOptions = {
  /** One is drawn at a time (see `show`). Each is scaled to fill the view on its own. */
  paths?: TrajectoryPath[]
  /** Optional fixed data-unit box shared across paths. Otherwise per-path autoscaling. */
  bounds?: { min: [number, number, number]; max: [number, number, number] }
  /** Annotations in original data coordinates, normalized with the selected path. */
  segments?: (TrajectoryAnnotation & { from: [number, number, number]; to: [number, number, number]; arrow?: boolean })[]
  markers?: (TrajectoryAnnotation & { point: [number, number, number]; visible?: boolean })[]
  faces?: (TrajectoryAnnotation & { points: [number, number, number][] })[]
  showPath?: boolean
  onSelect?: (annotation: TrajectoryAnnotation) => void
  onCameraChange?: (camera: TrajectoryCamera) => void
  /** Grid at y=0 in normalized display coordinates, not data units. */
  grid?: boolean
  /** Direction-only arrows in the normalized display frame. */
  referenceVectors?: { vector: [number, number, number]; label?: string }[]
  referenceNote?: string
  /** Seconds the points span. Default 1. */
  duration?: number
  /** Axis labels. Default ['1', '2', '3']. */
  axes?: [string, string, string]
  /** Seconds before the marker that are drawn heavier. Default 1. */
  trail?: number
  /** Canvas height in CSS pixels; the width is the host's. Default 360. */
  height?: number
  /** Accessible name for the canvas. */
  label?: string
}
export type Trajectory3DHandle = {
  update(next: Trajectory3DOptions): void
  /** Move the marker to `seconds` (clamped to the path). */
  setTime(seconds: number): void
  /** Draw `paths[index]`. */
  show(index: number): void
  getCamera(): TrajectoryCamera
  setCamera(camera: Partial<TrajectoryCamera>): void
  resetView(): void
  destroy(): void
}
/** Mount a view inside `host`; returns null when a 2-D canvas is unavailable. */
export function mountTrajectory3D(host: HTMLElement, opts?: Trajectory3DOptions): Trajectory3DHandle | null

export type OscillatorBankOptions = {
  /** [time][oscillator][real, imaginary], uniformly spaced in time. */
  samples: [number, number][][]
  duration?: number
  labels?: string[]
}
/** Fixed common radial scale; linearly interpolated complex samples, not simulated pendulums. */
export function mountOscillatorBank(host: HTMLElement, opts: OscillatorBankOptions): {
  setTime(seconds: number): void
  update(next: Partial<OscillatorBankOptions>): void
  destroy(): void
}
