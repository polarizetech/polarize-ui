// Orbit-camera maths, kept out of the renderer so it can be tested without a GL context.
export const clamp = (x, lo, hi) => (x < lo ? lo : x > hi ? hi : x)

export function makeOrbit({ theta = 0.9, phi = 1.15, dist = 3, target = [0, 0, 0] } = {}) {
  return { theta, phi, dist, target: [...target] }
}

/** Camera position for the orbit state. phi is measured from +y (0 = straight above). */
export function orbitPosition(o) {
  const s = Math.sin(o.phi)
  return [o.target[0] + o.dist * s * Math.sin(o.theta), o.target[1] + o.dist * Math.cos(o.phi), o.target[2] + o.dist * s * Math.cos(o.theta)]
}

export function drag(o, dx, dy, { speed = 0.008 } = {}) {
  o.theta -= dx * speed
  o.phi = clamp(o.phi - dy * speed, 0.05, Math.PI - 0.05)
}

export function zoom(o, deltaY, { min = 0.4, max = 40 } = {}) {
  o.dist = clamp(o.dist * Math.exp(deltaY * 0.0012), min, max)
}
