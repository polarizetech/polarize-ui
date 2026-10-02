// Colour ramps for the gradient, read from the polarize-ui theme the host page loaded.
//
// polarize-ui defines --seq-1 ... --seq-13 (one hue, magnitude) and --div-1 ... --div-13 (blue below
// zero, grey at zero, red above) and flips them for dark themes, so the field follows the theme with
// no colour of its own. Same contract as polarize-ui's own src/science/signals/ramp.ts: this reads
// them at draw time. If the tokens are missing the component says so and uses a FALLBACK ramp, so
// colour is never silently invented. (The fallback is a copy of polarize-ui's light values: drift risk
// recorded in CLAUDE.md.)

export const STOPS = 13

const FALLBACK = {
  seq: ['#cde2fb', '#b7d3f6', '#9ec5f4', '#86b6ef', '#6da7ec', '#5598e7', '#3987e5', '#2a78d6', '#256abf', '#1c5cab', '#184f95', '#104281', '#0d366b'],
  div: ['#0d366b', '#184f95', '#256abf', '#3987e5', '#6da7ec', '#9ec5f4', '#f0efec', '#ffa69f', '#ff6f69', '#fa082c', '#c90020', '#9a0016', '#6e000d'],
}

const hexToRgb = (h) => [1, 3, 5].map((j) => parseInt(h.slice(j, j + 2), 16))

/** @returns {{stops:number[][], usedFallback:boolean}} */
export function readRamp(from, kind = 'seq') {
  if (from && typeof getComputedStyle === 'function') {
    const cs = getComputedStyle(from)
    const out = []
    for (let i = 1; i <= STOPS; i++) {
      const hex = cs.getPropertyValue(`--${kind}-${i}`).trim()
      if (!/^#[0-9a-f]{6}$/i.test(hex)) { out.length = 0; break }
      out.push(hexToRgb(hex))
    }
    if (out.length === STOPS) return { stops: out, usedFallback: false }
  }
  return { stops: FALLBACK[kind].map(hexToRgb), usedFallback: true }
}

export function colorAt(stops, t) {
  const x = Math.min(1, Math.max(0, t)) * (stops.length - 1)
  const i = Math.min(stops.length - 2, Math.floor(x)), f = x - i
  return [0, 1, 2].map((k) => Math.round(stops[i][k] + (stops[i + 1][k] - stops[i][k]) * f))
}

/** A 256 x 1 RGBA strip of the ramp, ready for a texture. */
export function rampBytes(stops, width = 256) {
  const out = new Uint8Array(width * 4)
  for (let i = 0; i < width; i++) {
    const [r, g, b] = colorAt(stops, i / (width - 1))
    out.set([r, g, b, 255], 4 * i)
  }
  return out
}

/** Read a CSS custom property colour (#rrggbb) as 0..1 floats; null if absent. */
export function tokenRgb(from, name) {
  if (!from || typeof getComputedStyle !== 'function') return null
  const hex = getComputedStyle(from).getPropertyValue(name).trim()
  return /^#[0-9a-f]{6}$/i.test(hex) ? hexToRgb(hex).map((v) => v / 255) : null
}
