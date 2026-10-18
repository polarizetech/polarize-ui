/** Types for network3d.js, a zero-build 3-D node-link canvas view. */
export type Network3DNode = {
  id?: string | number
  position: [number, number, number]
  /** Radius in CSS pixels before perspective scaling. */
  radius?: number
  /** Display intensity in [0, 1]. */
  intensity?: number
  /** Zero-based Polarize series-colour index. */
  series?: number
  /** Number of outline rings around the node. */
  rings?: number
}
export type Network3DEdge = {
  source: number
  target: number
  /** Display intensity in [0, 1]. */
  intensity?: number
  /** Base width in CSS pixels; defaults to the view's edgeWidth. */
  width?: number
  /** Zero-based Polarize series-colour index. */
  series?: number
  /** Optional travelling-marker position; values wrap into [0, 1). */
  marker?: number
}
export type Network3DOptions = {
  nodes?: Network3DNode[]
  edges?: Network3DEdge[]
  axes?: [string, string, string]
  height?: number
  label?: string
  /** Base edge width in CSS pixels. Default 1.25. */
  edgeWidth?: number
  showVolume?: boolean
  /** Let a plain wheel zoom instead of scrolling the page. Default false. */
  wheelZoom?: boolean
}
export type Network3DHandle = {
  update(next: Network3DOptions): void
  resetView(): void
  destroy(): void
}
export function mountNetwork3D(host: HTMLElement, options?: Network3DOptions): Network3DHandle | null
