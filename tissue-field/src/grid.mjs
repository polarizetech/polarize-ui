// The voxel grid behind the gradient: cells (points) become a continuous field.
//
// Each cell is spread over nearby voxels with a normalised Gaussian (separable, so cheap), and the
// field at a voxel is the DENSITY-WEIGHTED MEAN of the activation of the cells around it:
//
//     field(v) = sum_i w_i(v) * a_i / sum_i w_i(v)
//
// Mean, not sum, on purpose: a sum would make a dense region look more active than a sparse one
// carrying the same per-cell activation, and the picture would then say something the data do not.
// With a mean the field is in the same units as a single cell's activation, wherever it is drawn.
//
// Zero-build, no DOM, node-testable.

const clamp01 = (x) => (x < 0 ? 0 : x > 1 ? 1 : x)

/** Voxel grid around the cells. Padded by the kernel radius so no cell's kernel is clipped. */
export function makeGrid(pos, n, { target = 64, sigmaVox = 1.6, maxDim = 128 } = {}) {
  if (!(n >= 1)) throw new Error('makeGrid: no cells')
  const min = [Infinity, Infinity, Infinity], max = [-Infinity, -Infinity, -Infinity]
  for (let i = 0; i < n; i++) for (let k = 0; k < 3; k++) {
    const v = pos[3 * i + k]
    if (v < min[k]) min[k] = v
    if (v > max[k]) max[k] = v
  }
  const radius = Math.ceil(3 * sigmaVox)
  const extent = [0, 1, 2].map((k) => Math.max(max[k] - min[k], 1e-6))
  const longest = Math.max(...extent)
  const pad = radius + 2   // a kernel of width 2*radius+1 can start up to radius+1 voxels before its cell
  const voxel = longest / Math.max(4, target - 2 * pad)
  const dims = extent.map((e) => Math.min(maxDim, Math.ceil(e / voxel) + 2 * pad))
  const origin = min.map((m) => m - pad * voxel)
  return { dims, origin, voxel, sigmaVox, radius, size: dims.map((d) => d * voxel), count: dims[0] * dims[1] * dims[2] }
}

export class Splatter {
  constructor(grid, pos, n) {
    this.grid = grid
    this.n = n
    const { dims, origin, voxel, sigmaVox, radius } = grid
    const W = 2 * radius + 1
    this.W = W
    this.base = new Int32Array(3 * n)
    this.w = [new Float32Array(n * W), new Float32Array(n * W), new Float32Array(n * W)]
    this.density = new Float32Array(grid.count)
    for (let i = 0; i < n; i++) {
      for (let k = 0; k < 3; k++) {
        const u = (pos[3 * i + k] - origin[k]) / voxel - 0.5
        const b = Math.floor(u) - radius + 1
        this.base[3 * i + k] = b
        let s = 0
        for (let j = 0; j < W; j++) {
          const d = (b + j - u) / sigmaVox
          const wj = Math.exp(-0.5 * d * d)
          this.w[k][i * W + j] = wj
          s += wj
        }
        for (let j = 0; j < W; j++) this.w[k][i * W + j] /= s
        if (b < 0 || b + W > dims[k]) throw new Error('Splatter: a cell kernel falls outside the grid')
      }
      this._add(i, 1, this.density)
    }
    this.maxDensity = this.density.reduce((m, v) => (v > m ? v : m), 0)
    this.actAcc = new Float32Array(grid.count)
    this.srcAcc = new Float32Array(grid.count)
  }

  _add(i, a, out) {
    const { dims } = this.grid, W = this.W, nx = dims[0], ny = dims[1]
    const bx = this.base[3 * i], by = this.base[3 * i + 1], bz = this.base[3 * i + 2]
    const wx = this.w[0], wy = this.w[1], wz = this.w[2]
    for (let kz = 0; kz < W; kz++) {
      const az = a * wz[i * W + kz], zi = (bz + kz) * ny
      for (let ky = 0; ky < W; ky++) {
        const ayz = az * wy[i * W + ky], row = (zi + by + ky) * nx + bx
        for (let kx = 0; kx < W; kx++) out[row + kx] += ayz * wx[i * W + kx]
      }
    }
  }

  /**
   * Splat one frame. `act` holds activation in the field's own units; `domain` is [lo, hi] and
   * clamping to it happens HERE, at draw time (the validator counted what lay outside).
   * `src` (optional) holds each cell's stimulus-driven share in [0, 1].
   */
  frame(act, domain, src = null, eps = 1e-4) {
    const [lo, hi] = domain, span = hi - lo
    this.actAcc.fill(0)
    if (src) this.srcAcc.fill(0)
    for (let i = 0; i < this.n; i++) {
      const a = clamp01((act[i] - lo) / span)
      if (a <= eps) continue
      this._add(i, a, this.actAcc)
      if (src) this._add(i, a * src[i], this.srcAcc)
    }
  }

  /** Write the frame into RGBA bytes: R activation mean, G tissue density, B stimulus-driven share. */
  pack(out, hasSource) {
    const V = this.grid.count, dens = this.density, md = this.maxDensity || 1
    for (let v = 0; v < V; v++) {
      const d = dens[v], a = this.actAcc[v]
      out[4 * v] = d > 1e-6 ? Math.round(255 * clamp01(a / d)) : 0
      out[4 * v + 1] = Math.round(255 * clamp01(d / md))
      out[4 * v + 2] = hasSource && a > 1e-9 ? Math.round(255 * clamp01(this.srcAcc[v] / a)) : 0
      out[4 * v + 3] = 255
    }
    return out
  }

  /** Cell position in grid-normalised coordinates (0..1 per axis), for overlays and picking. */
  normalised(pos, i) {
    const { origin, size } = this.grid
    return [0, 1, 2].map((k) => (pos[3 * i + k] - origin[k]) / size[k])
  }
}
