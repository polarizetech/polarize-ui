import type { Meta, StoryObj } from "@storybook/react-vite"
import * as React from "react"
import { Comodulogram } from "@/science/signals/Comodulogram"
import { computeComodulogram } from "@/science/stats/pac"
import { Pause, Play, Repeat, SkipBack } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Eyebrow } from "@/components/typography"
import { Heatmap } from "@/science/signals/Heatmap"
import { Waveform } from "@/science/signals/Waveform"
import { amTone, pacSignal, spectrogram } from "../data"

const meta: Meta = {
  title: "Science/Signals",
  parameters: { docs: { description: { component: "Time-series and time–frequency views. All data synthetic." } } },
}
export default meta

const eyesClosed = spectrogram()
const eyesOpen = spectrogram({ alpha: 0.15, seed: 12 })

export const Spectrogram: StoryObj = {
  name: "Spectrogram (time–frequency)",
  render: () => (
    <Heatmap
      title="Spectrogram, eyes closed 20–40 s"
      values={eyesClosed.grid}
      x={{ domain: eyesClosed.x, label: "time (s)" }}
      y={{ domain: eyesClosed.y, label: "frequency (Hz)" }}
      colorLabel="power (dB)"
    />
  ),
}

export const SharedScale: StoryObj = {
  name: "Two conditions on a shared colour scale",
  render: () => {
    const all = [...eyesClosed.grid.flat(), ...eyesOpen.grid.flat()]
    const domain: [number, number] = [Math.min(...all), Math.max(...all)]
    return (
      <div className="grid gap-6">
        <div>
          <Eyebrow>Eyes closed</Eyebrow>
          <Heatmap values={eyesClosed.grid} x={{ domain: eyesClosed.x, label: "time (s)" }} y={{ domain: eyesClosed.y, label: "frequency (Hz)" }}
            colorLabel="power (dB)" colorDomain={domain} scaleNote="shared" height={220} />
        </div>
        <div>
          <Eyebrow>Eyes open</Eyebrow>
          <Heatmap values={eyesOpen.grid} x={{ domain: eyesOpen.x, label: "time (s)" }} y={{ domain: eyesOpen.y, label: "frequency (Hz)" }}
            colorLabel="power (dB)" colorDomain={domain} scaleNote="shared" height={220} />
        </div>
      </div>
    )
  },
}

export const Clipped: StoryObj = {
  name: "A fixed colour range that clips (and says so)",
  render: () => (
    <Heatmap values={eyesClosed.grid} x={{ domain: eyesClosed.x, label: "time (s)" }} y={{ domain: eyesClosed.y, label: "frequency (Hz)" }}
      colorLabel="power (dB)" colorDomain={[5, 15]} scaleNote="shared" />
  ),
}

export const WaveformTransport: StoryObj = {
  name: "Waveform + transport",
  render: () => (
    <div className="max-w-2xl space-y-2">
      <Waveform samples={amTone()} progress={0.38} regions={[{ start: 0.55, end: 0.68, label: "blink", kind: "attention" }]} />
      <div className="flex items-center gap-1">
        <Button size="icon" aria-label="Play"><Play /></Button>
        <Button size="icon" variant="ghost" aria-label="Pause"><Pause /></Button>
        <Button size="icon" variant="ghost" aria-label="Back"><SkipBack /></Button>
        <Button size="icon" variant="ghost" aria-label="Repeat"><Repeat /></Button>
        <span className="ml-2 font-mono text-xs tabular-nums text-muted-foreground">00:12 / 05:00</span>
      </div>
    </div>
  ),
}

const phaseFreqs = Array.from({ length: 13 }, (_, i) => 2 + i)
const ampFreqs = Array.from({ length: 19 }, (_, i) => 30 + 5 * i)

export const ComodulogramCoupled: StoryObj = {
  name: "Comodulogram: 6 Hz phase modulating 60 Hz amplitude",
  render: () => {
    const result = React.useMemo(
      () => computeComodulogram({ signal: pacSignal(), fs: 500, phaseFreqs, ampFreqs, nSurrogates: 100 }),
      [],
    )
    return <Comodulogram result={result} title="Comodulogram, synthetic coupled recording" />
  },
}

export const ComodulogramNoise: StoryObj = {
  name: "Comodulogram: no coupling (nothing outlined)",
  render: () => {
    const result = React.useMemo(
      () => computeComodulogram({ signal: pacSignal({ coupled: false, seed: 3 }), fs: 500, phaseFreqs, ampFreqs, nSurrogates: 100 }),
      [],
    )
    return <Comodulogram result={result} />
  },
}

export const ComodulogramNarrowBand: StoryObj = {
  name: "Comodulogram: a narrow amplitude band (unresolvable cells hatched)",
  render: () => {
    const result = React.useMemo(
      () => computeComodulogram({ signal: pacSignal(), fs: 500, phaseFreqs, ampFreqs, ampBandwidth: 12, nSurrogates: 100 }),
      [],
    )
    return <Comodulogram result={result} />
  },
}

export const ComodulogramShared: StoryObj = {
  name: "Comodulogram: coupled vs noise on one colour scale",
  render: () => {
    const [coupled, noise] = React.useMemo(() => [
      computeComodulogram({ signal: pacSignal(), fs: 500, phaseFreqs, ampFreqs, nSurrogates: 100 }),
      computeComodulogram({ signal: pacSignal({ coupled: false, seed: 3 }), fs: 500, phaseFreqs, ampFreqs, nSurrogates: 100 }),
    ], [])
    // One colour range across both panels. Autoscaled separately, noise at MI 0.001 looks
    // as vivid as coupling at 0.02.
    const all = [coupled, noise].flatMap((c) => c.mi.flatMap((row, a) => row.filter((_, p) => c.resolvable[a][p])))
    const domain: [number, number] = [0, Math.max(...all)]
    return (
      <div className="grid gap-6">
        <div><Eyebrow>Coupled</Eyebrow><Comodulogram result={coupled} colorDomain={domain} scaleNote="shared" height={260} /></div>
        <div><Eyebrow>No coupling</Eyebrow><Comodulogram result={noise} colorDomain={domain} scaleNote="shared" height={260} /></div>
      </div>
    )
  },
}

const diffGrid = eyesClosed.grid.map((row, r) => row.map((v, c) => v - eyesOpen.grid[r][c]))
const diffMax = Math.max(...diffGrid.flat().map(Math.abs))

export const Difference: StoryObj = {
  name: "A signed difference on the diverging scale",
  render: () => (
    <Heatmap
      title="Eyes closed minus eyes open"
      values={diffGrid}
      scale="diverging"
      colorDomain={[-diffMax, diffMax]}
      x={{ domain: eyesClosed.x, label: "time (s)" }}
      y={{ domain: eyesClosed.y, label: "frequency (Hz)" }}
      colorLabel="difference (dB)"
    />
  ),
}
