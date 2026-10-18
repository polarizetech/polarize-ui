import type { Meta, StoryObj } from "@storybook/react-vite"
import * as React from "react"
import { Surface3D, Trajectory3D, Waterfall3D } from "@/science/space/views"
import { Heatmap } from "@/science/signals/Heatmap"
import { LineChart } from "@/science/charts/LineChart"
import { Slider } from "@/components/ui/slider"
import { Button } from "@/components/ui/button"
import { mountTrajectory3D, type Trajectory3DHandle } from "../../trajectory3d.js"
import { mountNetwork3D, type Network3DHandle, type Network3DNode, type Network3DEdge } from "../../network3d.js"
import { Eyebrow } from "@/components/typography"
import { Tier } from "@/science/evidence/tier"
import cmo from "virtual:dataset/usgs-cmo-hour"
import cmoSource from "../datasets/usgs-cmo-hour/SOURCE.json"
import abr from "virtual:dataset/ds005340-abr"
import abrSource from "../datasets/ds005340-abr/SOURCE.json"

const meta: Meta = {
  title: "Science/3-D views",
  parameters: {
    docs: {
      description: {
        component:
          "Three standard 3-D views — a spectrogram landscape, a hodogram and an event-aligned stack — drawn on a " +
          "dependency-free canvas. The data are real public recordings, and each story names its source and licence. The one " +
          "exception is the path with a time marker, which is a synthetic textbook system and says so.",
      },
    },
  },
}
export default meta

function Source({ s }: { s: { attribution: string; licence: string; accession: string } }) {
  return (
    <p className="mt-3 max-w-3xl text-[length:var(--text-xs)] text-muted-foreground">
      <span className="font-mono">Data · {s.licence} · {s.accession}.</span> {s.attribution}
    </p>
  )
}

const minute = (s: number) => `${(s / 60).toFixed(1)} min`
const mHz = (f: number) => (f * 1e3).toFixed(0)
const spec = cmo.spectrogram
const tSpan: [number, number] = [spec.t_centre_s[0], spec.t_centre_s[spec.t_centre_s.length - 1]]
const fSpan: [number, number] = [spec.freq_hz[0], spec.freq_hz[spec.freq_hz.length - 1]]

export const SpectrogramLandscape: StoryObj = {
  name: "Spectrogram landscape (magnetometer)",
  render: () => (
    <div className="grid gap-6">
      <Surface3D
        title="Geomagnetic field power over one hour, College, Alaska"
        values={spec.db}
        x={{ domain: tSpan, label: "time (window centre)", format: minute }}
        y={{ domain: fSpan, label: "frequency (mHz)", format: mHz }}
        valueLabel="power (dB re 1 nT²/Hz)"
        notes={[`sum of X, Y, Z · ${spec.window_s} s Hann windows every ${spec.step_s} s · linear trend removed per window`]}
      />
      <div>
        <Eyebrow>The same grid in 2-D — read values here</Eyebrow>
        <Heatmap values={spec.db} x={{ domain: tSpan, label: "time (window centre)", format: minute }}
          y={{ domain: fSpan, label: "frequency (mHz)", format: mHz }} colorLabel="power (dB re 1 nT²/Hz)" height={240} />
      </div>
      <Source s={cmoSource} />
    </div>
  ),
}

function HodogramStory() {
  const v = cmo.vector
  const per = v.every_s
  const total = v.x.length
  const span = Math.round(900 / per) // 15 minutes
  const [start, setStart] = React.useState(Math.round(1200 / per))
  const sl = (a: number[]) => a.slice(start, start + span)
  const t = sl(v.x).map((_, i) => (start + i) * per)
  return (
    <div className="grid gap-3">
      <div className="flex max-w-xl items-center gap-3">
        <span className="whitespace-nowrap font-mono text-[length:var(--text-xs)] text-muted-foreground tabular-nums">
          window {minute(start * per)}–{minute((start + span) * per)}
        </span>
        <Slider min={0} max={total - span} step={1} value={[start]} onValueChange={([s]) => setStart(s)} aria-label="Window start" />
      </div>
      <Trajectory3D
        title="Pc5-band magnetic field vector, 15 minutes"
        x={sl(v.y)} y={sl(v.x)} z={sl(v.z).map((d) => -d)} t={t}
        axisLabels={["east (Y)", "north (X)", "up (−Z)"]} unit="nT" timeLabel="time into the hour" timeFormat={minute}
        reference={{ direction: [cmo.b0_nT[1], cmo.b0_nT[0], -cmo.b0_nT[2]], label: "mean field B₀" }}
        notes={[
          `band-passed ${(v.band_hz[0] * 1e3).toFixed(2)}–${(v.band_hz[1] * 1e3).toFixed(2)} mHz (150–600 s periods), zero phase · one point per ${per} s`,
          "axes east, north, up: a right-handed frame, so turning senses are drawn as they are (north, east, up would mirror them)",
          "a trajectory is not a polarisation measurement: that needs a degree of polarisation with its noise floor",
        ]}
      />
      <Source s={cmoSource} />
    </div>
  )
}

export const Hodogram: StoryObj = {
  name: "Hodogram (magnetometer, band-passed)",
  render: () => <HodogramStory />,
}

// The Lorenz system (Lorenz 1963), σ = 10, ρ = 28, β = 8/3, by fourth-order Runge–Kutta. Synthetic.
const LORENZ_S = 20
function lorenz(n: number, dt: number): [number, number, number][] {
  const f = ([x, y, z]: number[]) => [10 * (y - x), x * (28 - z) - y, x * y - (8 / 3) * z]
  const step = (p: number[], k: number[], h: number) => p.map((v, i) => v + k[i] * h)
  let p = [1, 1, 20]
  const out: [number, number, number][] = []
  for (let i = 0; i < n; i++) {
    out.push([p[1], p[2], p[0]]) // z drawn upward; (y, z, x) keeps the frame right-handed
    const k1 = f(p), k2 = f(step(p, k1, dt / 2)), k3 = f(step(p, k2, dt / 2)), k4 = f(step(p, k3, dt))
    p = p.map((v, j) => v + (dt / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]))
  }
  return out
}
const lorenzPath = lorenz(2000, LORENZ_S / 2000)

function TimeMarkerStory() {
  const host = React.useRef<HTMLDivElement>(null)
  const view = React.useRef<Trajectory3DHandle | null>(null)
  const [time, setTime] = React.useState(6)
  const [playing, setPlaying] = React.useState(false)
  React.useEffect(() => {
    if (!host.current) return
    view.current = mountTrajectory3D(host.current, {
      paths: [{ points: lorenzPath, label: "Lorenz" }], duration: LORENZ_S, axes: ["y", "z", "x"], trail: 1.5,
      label: "The Lorenz attractor as a path through three dimensions, with a marker at the current time",
    })
    return () => { view.current?.destroy(); view.current = null }
  }, [])
  React.useEffect(() => { view.current?.setTime(time) }, [time])
  React.useEffect(() => {
    if (!playing) return
    const id = setInterval(() => setTime((t) => (t + 0.05) % LORENZ_S), 50)
    return () => clearInterval(id)
  }, [playing])
  return (
    <div className="grid max-w-3xl gap-3">
      <div className="flex items-center gap-3">
        <Button size="sm" variant="outline" aria-pressed={playing} onClick={() => setPlaying((p) => !p)}>{playing ? "Pause" : "Play"}</Button>
        <Slider min={0} max={LORENZ_S} step={0.05} value={[time]} onValueChange={([t]) => setTime(t)} aria-label="Time" />
        <span className="whitespace-nowrap font-mono text-[length:var(--text-xs)] text-muted-foreground tabular-nums">{time.toFixed(1)} / {LORENZ_S} s</span>
        <Button size="sm" variant="ghost" onClick={() => view.current?.resetView()}>Reset view</Button>
      </div>
      <div ref={host} />
      <p className="text-[length:var(--text-xs)] text-muted-foreground">
        <span className="font-mono">Data · synthetic.</span> The Lorenz system (σ = 10, ρ = 28, β = 8/3), integrated in the
        story; nothing was recorded. The path is scaled to fill the view, one scale on all three axes, so there are no units
        or ticks. Drag to turn, pinch or Ctrl-scroll to zoom, arrow keys when focused. This is the zero-build module{" "}
        <span className="font-mono">trajectory3d.js</span>; for units, ticks and hover values use the hodogram above.
      </p>
    </div>
  )
}

export const PathWithTimeMarker: StoryObj = {
  name: "Path with a time marker (zero-build, synthetic)",
  render: () => <TimeMarkerStory />,
}

const networkNodes: Network3DNode[] = Array.from({ length: 18 }, (_, i) => {
  const ring = i < 6 ? 0.55 : 1
  const angle = i * 2.399963
  return {
    position: [Math.cos(angle) * ring, ((i % 5) - 2) * 0.22, Math.sin(angle) * ring],
    radius: i % 6 === 0 ? 6 : 4,
    series: i % 7 === 0 ? 1 : 0,
    rings: i % 7 === 0 ? 1 : 0,
    intensity: 0.25 + (i % 5) * 0.13,
  }
})
const networkEdges: Network3DEdge[] = networkNodes.flatMap((_, i) => [
  { source: i, target: (i + 1) % networkNodes.length, intensity: 0.35 },
  ...(i % 3 === 0 ? [{ source: i, target: (i + 7) % networkNodes.length, intensity: 0.7 }] : []),
])

function NodeLinkStory() {
  const host = React.useRef<HTMLDivElement>(null)
  const view = React.useRef<Network3DHandle | null>(null)
  const phase = React.useRef(0)
  React.useEffect(() => {
    if (!host.current) return
    view.current = mountNetwork3D(host.current, {
      nodes: networkNodes, edges: networkEdges, axes: ["x", "y", "z"], height: 420,
      label: "Synthetic spatial node-link network with moving flow markers",
    })
    const id = window.setInterval(() => {
      phase.current = (phase.current + 0.012) % 1
      view.current?.update({ edges: networkEdges.map((edge, i) => ({ ...edge, marker: phase.current + i / networkEdges.length })) })
    }, 50)
    return () => { window.clearInterval(id); view.current?.destroy(); view.current = null }
  }, [])
  return (
    <div className="grid max-w-3xl gap-3">
      <div className="flex items-center justify-between gap-3">
        <Eyebrow>Synthetic node-link example <Tier id="MODELLED" /></Eyebrow>
        <span className="font-mono text-[length:var(--text-xs)] text-muted-foreground">
          {networkNodes.length} nodes · {networkEdges.length} edges
        </span>
      </div>
      <div ref={host} />
      <p className="text-[length:var(--text-xs)] text-muted-foreground">
        <span className="font-mono">Data · synthetic.</span> Positions and connections are deterministic display data.
        Line strength and moving markers are caller-supplied encodings, not inferred flow. Nodes are centred and scaled
        together; axes have no units or ticks. Drag to turn, pinch or Ctrl-scroll to zoom, arrow keys when focused.
      </p>
    </div>
  )
}

export const SpatialNodeLinkNetwork: StoryObj = {
  name: "Spatial node-link network (zero-build, synthetic)",
  render: () => <NodeLinkStory />,
}

const pts = (vals: number[]) => abr.lags_ms.map((l, i) => [l, vals[i]] as [number, number])
const avg = (rows: number[][]) => abr.lags_ms.map((_, j) => rows.reduce((s, r) => s + r[j], 0) / rows.length)

export const EventAlignedStack: StoryObj = {
  name: "Event-aligned stack (brainstem responses to clicks)",
  render: () => (
    <div className="grid gap-6">
      <Waterfall3D
        title="Click-evoked brainstem response, one row per 10 s trial"
        rows={abr.rows_uv} lags={abr.lags_ms} lagLabel="time from click (ms)" rowLabel="trial" valueLabel="µV"
        markers={[{ at: 0, label: "click" }]}
        describeRow={(i) => `${abr.trial_type[i].replace("clicks_", "")} rate, ${abr.clicks_per_trial[i]} clicks averaged`}
        notes={[`channel ${abr.source.channel} (left earlobe, ref FCz) · left-ear clicks · ${abr.filter}`, "each row is itself an average of 1213–1820 clicks"]}
      />
      <div>
        <Eyebrow>The same trials as a 2-D image (an "ERP image") — read values here</Eyebrow>
        <Heatmap values={abr.rows_uv} scale="diverging" colorDomain={[-0.6, 0.6]}
          x={{ domain: [abr.lags_ms[0], abr.lags_ms[abr.lags_ms.length - 1]], label: "time from click (ms)" }}
          y={{ domain: [1, abr.rows_uv.length], label: "trial" }} colorLabel="µV" height={260}
          notes={["colour range fixed at ±0.6 µV so a few noisy trials do not wash out the rest"]} />
      </div>
      <div>
        <Eyebrow>The average against its control</Eyebrow>
        <LineChart
          title="Mean response and the same averaging at the wrong click times"
          series={[
            { label: `mean of ${abr.rows_uv.length} trials`, points: pts(avg(abr.rows_uv)) },
            { label: "control: next trial's click times", points: pts(avg(abr.control_rows_uv)), dash: true },
          ]}
          x={{ label: "time from click (ms)" }} y={{ label: "µV" }}
          thresholds={[{ value: 0, axis: "x", label: "click" }]}
          height={240}
        />
      </div>
      <Source s={abrSource} />
    </div>
  ),
}
