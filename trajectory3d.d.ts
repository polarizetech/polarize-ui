/** Types for trajectory3d.js (a zero-build ES module; see the file header). */
export type TrajectoryPath = {
  /** [x, y, z] per sample, evenly spaced over `duration`. */
  points: [number, number, number][]
  label?: string
}
export type Trajectory3DOptions = {
  /** One is drawn at a time (see `show`). Each is scaled to fill the view on its own. */
  paths?: TrajectoryPath[]
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
  resetView(): void
  destroy(): void
}
/** Mount a view inside `host`; returns null when a 2-D canvas is unavailable. */
export function mountTrajectory3D(host: HTMLElement, opts?: Trajectory3DOptions): Trajectory3DHandle | null
