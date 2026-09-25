import type { Meta, StoryObj } from "@storybook/react-vite"
import { LineChart, sharedDomain, type Series } from "@/science/charts/LineChart"
import { BarChart } from "@/science/charts/BarChart"
import { Eyebrow } from "@/components/typography"
import { detectionCurve, longTrace, spectrum } from "../data"

const meta: Meta = { title: "Science/Charts", parameters: { docs: { description: { component: "All data synthetic." } } } }
export default meta

export const DetectionCurve: StoryObj = {
  name: "Line + threshold on the same axes",
  render: () => (
    <LineChart
      title="Recovery against injected amplitude"
      series={[
        { label: "planted heart", points: detectionCurve(0.153), curve: "monotone" },
        { label: "machine control", points: detectionCurve(0.153).map(([k]) => [k, 0.02]), dash: true },
      ]}
      x={{ label: "injected amplitude (× host RMS)" }}
      y={{ label: "fraction recovered", domain: [0, 1] }}
      thresholds={[
        { value: 0.95, label: "95% recovery", tier: "measured" },
        { value: 0.153, axis: "x", label: "k95 = 0.153", tier: "predicted" },
      ]}
    />
  ),
}

export const Spectrum: StoryObj = {
  name: "Spectrum on a log axis",
  render: () => (
    <LineChart
      title="Power spectrum"
      series={[{ label: "Oz", points: spectrum() }]}
      x={{ label: "frequency (Hz)" }}
      y={{ type: "log", label: "power (µV²/Hz)", format: (v: number) => v.toExponential(0) }}
      thresholds={[{ value: 40, axis: "x", label: "front-end corner 40 Hz", tier: "refuted" }]}
    />
  ),
}

export const Decimation: StoryObj = {
  name: "Decimation is printed",
  render: () => (
    <LineChart
      title="12 000 samples thinned for display"
      series={[{ label: "trace", points: longTrace() }]}
      x={{ label: "time (s)" }}
      y={{ label: "amplitude (µV)" }}
      maxPoints={800}
    />
  ),
}

const raw: Series[] = [{ label: "rich", points: longTrace(1500, 2) }]
const residual: Series[] = [{ label: "residual", points: longTrace(1500, 2).map(([t, v]) => [t, v * 0.12]), color: "var(--chart-4)" }]

export const SharedVsIndependent: StoryObj = {
  name: "Shared vs independent scale",
  render: () => {
    const dom = sharedDomain(raw, residual)
    return (
      <div className="grid gap-6">
        <div>
          <Eyebrow>Shared — the residual looks as small as it is</Eyebrow>
          <LineChart series={raw} y={{ domain: dom, label: "µV" }} x={{ label: "time (s)" }} scaleNote="shared" height={180} />
          <LineChart series={residual} y={{ domain: dom, label: "µV" }} x={{ label: "time (s)" }} scaleNote="shared" height={180} />
        </div>
        <div>
          <Eyebrow>Independent — the same residual autoscaled looks like the signal</Eyebrow>
          <LineChart series={residual} y={{ label: "µV" }} x={{ label: "time (s)" }} scaleNote="independent" height={180} />
        </div>
      </div>
    )
  },
}

export const Bars: StoryObj = {
  name: "Bars with a threshold",
  render: () => (
    <BarChart
      title="Surrogates beaten, per subject"
      data={[
        { category: "sub-01", value: 0.91, tier: "measured" },
        { category: "sub-02", value: 0.62, tier: "measured" },
        { category: "sub-03", value: 0.97, tier: "measured" },
        { category: "sub-04", value: 0.4, tier: "exploring" },
        { category: "sub-05", value: 0.88, tier: "measured" },
      ]}
      y={{ label: "fraction", domain: [0, 1] }}
      xLabel="subject"
      threshold={{ value: 0.95, label: "95% bar" }}
      valueFormat={(v: number) => v.toFixed(2)}
    />
  ),
}
