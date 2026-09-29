/** Types for docs.js (a zero-build ES module; see the file header and DOCS-SITES.md). */
export type PlotMarker = { x: number; label?: string }
export type PlotSpec =
  | { type: "line"; title?: string; caption?: string; xlabel?: string; ylabel?: string; xunit?: string; yunit?: string
      series: { name: string; x: number[]; y: (number | null)[] }[]; markers?: PlotMarker[]; stack?: boolean }
  | { type: "stems"; title?: string; caption?: string; xmax?: number
      groups: { name: string; lines: { x: number; y: number }[]; invert?: boolean; flags?: string[]; note?: string }[] }
  | { type: "bars"; title?: string; caption?: string; items: { label: string; value: number }[] }
  | { type: "table"; title?: string; caption?: string; columns: string[]; rows: string[][] }
  | { type: "verdicts"; title?: string; caption?: string
      items: { key: string; verdict: string; reason?: string; meta?: string; tone?: "yes" | "no" | "none" }[] }
/** Draw one spec into `host`; returns the .ui-plot figure it created. */
export function renderPlot(spec: PlotSpec, host: HTMLElement): HTMLElement
/** Python source to highlighted HTML (spans with .ui-tok--* classes). Escapes its input. */
export function highlight(code: string): string
/** Redraw every [data-ui-plots] element (after a theme change). */
export function redrawAll(): void
/** True when the page is showing a dark theme. */
export function isDark(): boolean
/** Wire every data-ui-* hook on the page. Runs on import unless window.__uiDocsNoAutoInit is set. */
export function init(): void
