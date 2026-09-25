import type { Meta, StoryObj } from "@storybook/react-vite"
import { Pause, Play, Repeat, SkipBack } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Eyebrow } from "@/components/typography"
import { Heatmap } from "@/science/signals/Heatmap"
import { Waveform } from "@/science/signals/Waveform"
import { amTone, spectrogram } from "../data"

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
