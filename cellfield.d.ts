/** Types for cellfield.js (a zero-build ES module; see the file header). */
export type CellFieldOptions = {
  /** Speck count multiplier. Default 1. */
  density?: number
  /** Opacity multiplier. Default 1. */
  intensity?: number
  /** CSS selector or element the hero cell is drawn behind; omit for none. */
  hero?: string | Element | null
  /** Pass false to draw a single still frame. Reduced motion always does. */
  motion?: boolean
  /** Layout seed. Default 29. */
  seed?: number
}
export type CellFieldHandle = { update(next: CellFieldOptions): void; destroy(): void }
/** Mount a field inside `host`; returns null when WebGL is unavailable. */
export function mountCellField(host: HTMLElement, opts?: CellFieldOptions): CellFieldHandle | null
