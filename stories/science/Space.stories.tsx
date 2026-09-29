import type { Meta, StoryObj } from "@storybook/react-vite"
import * as React from "react"
import { Surface3D, Trajectory3D, Waterfall3D } from "@/science/space/views"
import { Heatmap } from "@/science/signals/Heatmap"
import { LineChart } from "@/science/charts/LineChart"
import { Slider } from "@/components/ui/slider"
import { Eyebrow } from "@/components/typography"
import cmo from "../datasets/usgs-cmo-hour/data.json"
import cmoSource from "../datasets/usgs-cmo-hour/SOURCE.json"
import abr from "../datasets/ds005340-abr/data.json"
import abrSource from "../datasets/ds005340-abr/SOURCE.json"

const meta: Meta = {
  title: "Science/3-D views",
  parameters: {
    docs: {
      description: {
        component:
          "Three standard 3-D views — a spectrogram landscape, a hodogram and an event-aligned stack — drawn on a " +
          "dependency-free canvas. All data here are real public recordings; each story names its source and licence.",
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
