import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import { Lift, Orbit, OrbitBars, OrbitGraph, SpatialPane, SpatialSpace } from "@/spatial/Spatial"
import { LineChart } from "@/science/charts/LineChart"
import { Knob, Toggle } from "@/components/controls"
import { Button } from "@/components/ui/button"
import { Tier } from "@/science/evidence/tier"

/* Every value here is synthetic: textbook sine waves and made-up category values. */

const meta: Meta = {
  title: "Spatial (VR)/Components",
  parameters: {
    layout: "padded",
    docs: {
      description: {
        component:
          "Polarize UI in 3-D, for headsets and Cardboard: panes on an arc around you, a dock and menu that trail the " +
          "head, components that lift toward the eye, and graphs that are objects you can turn, flip and pull out, even " +
          "when the data is 1-D or 2-D. Drawn with CSS 3-D transforms; a pointer stands in for head tracking. Depths, " +
          "lags and spacings are TASTE. Tier badges sit on frames that never rotate.",
      },
    },
  },
}
export default meta

const wave = (f: number, phase = 0, n = 160) =>
  Array.from({ length: n }, (_, i) => { const t = i / (n - 1); return [t, Math.sin(2 * Math.PI * f * t + phase)] as [number, number] })

function Chart({ width = 480, height = 240 }: { width?: number; height?: number }) {
  return (
    <LineChart width={width} height={height}
      series={[{ label: "synthetic 3 Hz", points: wave(3) }, { label: "synthetic 5 Hz", points: wave(5, 1), dash: true }]}
      x={{ label: "time (s)", domain: [0, 1] }} y={{ label: "amplitude (a.u.)", domain: [-1.2, 1.2] }} />
  )
}

function ControlsBody() {
  const [gain, setGain] = React.useState(-6)
  const [on, setOn] = React.useState(true)
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "var(--space-5)", flexWrap: "wrap" }}>
      <Lift><Knob label="Gain" value={gain} min={-24} max={6} step={0.5} unit="dB" digits={1} signed onChange={setGain} /></Lift>
      <Lift><Toggle on={on} onChange={setOn}>Listen</Toggle></Lift>
      <Lift><Button>Start</Button></Lift>
    </div>
  )
}

const PANES = [
  { id: "session", title: "Session", tier: "EXPLORATORY" as const, body: <ControlsBody /> },
  { id: "evidence", title: "Evidence", tier: "SPEC" as const, body: (
    <div style={{ display: "grid", gap: "var(--space-2)" }}>
      <span><Tier id="MEASURED" /> read off an instrument</span>
      <span><Tier id="PREDICTED" /> <i>output of a model</i></span>
      <span><Tier id="TASTE" /> invented to look right</span>
    </div>
  ) },
  { id: "signal", title: "Signal", tier: "SPEC" as const, body: <OrbitGraph width={440} height={220}><Chart width={440} height={220} /></OrbitGraph> },
  { id: "spectrum", title: "Spectrum", tier: "SPEC" as const, body: <OrbitBars width={440} height={160} values={[2, 5, 9, 6, 3, 1.5]} labels={["1", "2", "3", "4", "5", "6"]} valueLabel="power (a.u.) by band" /> },
]

export const Space: StoryObj = {
  name: "Space: panes, dock, swipe",
  render: () => <SpatialSpace panes={PANES} />,
}

export const LineGraph: StoryObj = {
  name: "Orbit graph: a 2-D series as a slab",
  render: () => <OrbitGraph title="Two synthetic waves" tier="SPEC"><Chart /></OrbitGraph>,
}

export const Bars: StoryObj = {
  name: "Orbit graph: categories as boxes",
  render: () => <OrbitBars title="Synthetic band power" tier="SPEC" values={[2, 5, 9, 6, 3, 1.5]} labels={["1", "2", "3", "4", "5", "6"]} valueLabel="power (a.u.) by band" />,
}

export const OneD: StoryObj = {
  name: "Orbit graph: a 1-D value as a rod",
  render: () => (
    <Orbit title="One synthetic value on its axis" tier="SPEC" height={220}>
      <div style={{ position: "relative", width: 420, height: 40, transformStyle: "preserve-3d" }}>
        {[0, 90].map((a) => (
          <div key={a} style={{ position: "absolute", inset: "14px 0", background: "var(--border-strong)", transform: `rotateX(${a}deg)` }} />
        ))}
        <div style={{ position: "absolute", left: `${0.62 * 100}%`, top: 4, width: 32, height: 32, marginLeft: -16, borderRadius: "var(--radius-pill)", background: "var(--accent)", transform: "translateZ(8px)" }} />
        <span style={{ position: "absolute", left: 0, top: 44, fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--muted-foreground)" }}>0</span>
        <span style={{ position: "absolute", right: 0, top: 44, fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--muted-foreground)" }}>1</span>
        <span style={{ position: "absolute", left: "62%", top: -24, marginLeft: -16, fontFamily: "var(--font-mono)", fontSize: "var(--text-xs)", color: "var(--foreground)", transform: "translateZ(8px)" }}>0.62</span>
      </div>
    </Orbit>
  ),
}

export const Depth: StoryObj = {
  name: "Components in depth: gaze lifts, pinch presses",
  render: () => (
    <div style={{ perspective: 800, padding: "var(--space-6)" }}>
      <div style={{ transformStyle: "preserve-3d", transform: "rotateX(28deg) rotateZ(-8deg)" }}>
        <SpatialPane title="Point at a control" tier="TASTE"><ControlsBody /></SpatialPane>
      </div>
    </div>
  ),
}
