export type Pt = [number, number]

/**
 * Largest-triangle-three-buckets: keeps the visual extrema a naive stride throws away.
 * Ported unchanged from the monorepo's zero-build tools/chart.
 */
export function decimate(pts: Pt[], target: number): Pt[] {
  if (pts.length <= target || target < 3) return pts
  const out: Pt[] = [pts[0]]
  const every = (pts.length - 2) / (target - 2)
  let a = 0
  for (let i = 0; i < target - 2; i++) {
    const lo = Math.floor((i + 1) * every) + 1
    const hi = Math.min(Math.floor((i + 2) * every) + 1, pts.length)
    let ax = 0, ay = 0
    for (let j = lo; j < hi; j++) { ax += pts[j][0]; ay += pts[j][1] }
    ax /= (hi - lo) || 1; ay /= (hi - lo) || 1
    const rlo = Math.floor(i * every) + 1, rhi = Math.floor((i + 1) * every) + 1
    let best = -1, bestI = rlo
    for (let j = rlo; j < rhi; j++) {
      const t = Math.abs((pts[a][0] - ax) * (pts[j][1] - pts[a][1]) - (pts[a][0] - pts[j][0]) * (ay - pts[a][1]))
      if (t > best) { best = t; bestI = j }
    }
    out.push(pts[bestI]); a = bestI
  }
  out.push(pts[pts.length - 1])
  return out
}
