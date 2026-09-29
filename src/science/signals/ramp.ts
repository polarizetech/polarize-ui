import * as React from "react"

/**
 * The sequential magnitude ramp (--seq-1 … --seq-13), read from the theme at draw time so a
 * canvas can use it. One hue, light to dark; --seq-1 is "near zero" in light and dark alike.
 * Shared by every view that paints magnitude into pixels rather than SVG.
 */
export const SEQ_STOPS = 13
export type RGB = [number, number, number]

export function readRamp(from: Element = document.documentElement): RGB[] {
  const cs = getComputedStyle(from)
  const out: RGB[] = []
  for (let i = 1; i <= SEQ_STOPS; i++) {
    const hex = cs.getPropertyValue(`--seq-${i}`).trim()
    if (!/^#[0-9a-f]{6}$/i.test(hex)) throw new Error(`--seq-${i} is not defined — load the polarize-ui theme`)
    out.push([1, 3, 5].map((j) => parseInt(hex.slice(j, j + 2), 16)) as RGB)
  }
  return out
}

export function colorAt(ramp: RGB[], t: number): RGB {
  const x = Math.min(1, Math.max(0, t)) * (ramp.length - 1)
  const i = Math.min(ramp.length - 2, Math.floor(x))
  const f = x - i
  return [0, 1, 2].map((k) => Math.round(ramp[i][k] + (ramp[i + 1][k] - ramp[i][k]) * f)) as RGB
}

export const rgb = ([r, g, b]: RGB) => `rgb(${r} ${g} ${b})`

/** Changes whenever the page switches between light and dark, so pixel views repaint. */
export function useThemeKey() {
  const [key, setKey] = React.useState(0)
  React.useEffect(() => {
    const bump = () => setKey((k) => k + 1)
    const mo = new MutationObserver(bump)
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] })
    const mq = window.matchMedia?.("(prefers-color-scheme: dark)")
    mq?.addEventListener?.("change", bump)
    return () => { mo.disconnect(); mq?.removeEventListener?.("change", bump) }
  }, [])
  return key
}
