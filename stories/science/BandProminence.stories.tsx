import type { Meta, StoryObj } from "@storybook/react-vite"
import * as React from "react"
import eesm from "virtual:dataset/ds005185-eesm19"
import eesmSource from "../datasets/ds005185-eesm19/SOURCE.json"
import { Pause, Play } from "lucide-react"
import { Button } from "@/components/ui/button"
import { BandProminence } from "@/science/signals/BandProminence"
import type { BandProminenceHandle } from "../../bandprominence.js"

const meta: Meta = {
  title: "Science/Band prominence",
  parameters: {
    docs: {
      description: {
        component: [
          "How strongly each frequency band stands out in ONE channel, drawn live as samples arrive. Each band is",
          "band-passed (4th-order Butterworth), its amplitude tracked, and its level compared with an adaptive",
          "threshold that remembers the last few seconds. The joined black marks are the thresholds now; the",
          "coloured lines behind them are where each threshold has been over the last 30 s.",
          "",
          "Two measures: `share` (default) is relative band power, each band's share of the total, so a tone or",
          "a fundamental with harmonics shows up in the bands it falls in. `baseline` compares each band with its",
          "own long-run mean, which is what a burst detector wants. It is a readout, not a model of the brain.",
          "",
          "Feed it from anything that produces samples: `view.push(chunk)`, the `samples` prop, or",
          "`view.listenTo(panel)` to follow a live `<signal-panel>` (its `signal-samples` events).",
          "Zero-build pages use `bandprominence.js` directly; see its header.",
        ].join("\n"),
      },
    },
  },
}
export default meta

function Source({ note }: { note: string }) {
  return (
    <p className="text-xs text-muted-foreground max-w-prose">
      <span className="font-mono">Data · {eesmSource.licence} · {eesmSource.accession}.</span> {eesmSource.attribution}{" "}
      Channel {eesm.excerpt.channel}, {eesm.excerpt.filter}. {note}
    </p>
  )
}

/** Push a recording in real time, chunk by chunk, looping, the way a live source would. */
function usePlayback(uv: number[], rate: number) {
  const view = React.useRef<BandProminenceHandle | null>(null)
  const [playing, setPlaying] = React.useState(true)
  const at = React.useRef(0)
  React.useEffect(() => {
    if (!playing) return
    const chunk = Math.round(rate / 10)
    const id = setInterval(() => {
      if (!view.current) return
      const end = at.current + chunk
      const part = uv.slice(at.current, Math.min(end, uv.length))
      view.current.push(part, { gap: at.current === 0 && part.length ? 1 : 0 })
      at.current = end >= uv.length ? 0 : end
    }, 100)
    return () => clearInterval(id)
  }, [playing, uv, rate])
  return { onReady: (v: BandProminenceHandle) => { view.current = v }, playing, setPlaying, at }
}

function Recorded({ which, measure, note }: { which: "wake" | "assr"; measure?: "share" | "baseline"; note: string }) {
  const ex = eesm.excerpt[which]
  const { onReady, playing, setPlaying } = usePlayback(ex.uv, ex.rate_hz)
  return (
    <div className="grid gap-3">
      <BandProminence rate={ex.rate_hz} measure={measure} source={`EESM19 ${eesm.excerpt.channel} · ${which === "wake" ? "scored wake" : "40 Hz AM noise playing"} · playback, looped`} onReady={onReady} />
      <div><Button variant="outline" size="sm" onClick={() => setPlaying(!playing)}>{playing ? <Pause /> : <Play />}{playing ? "Pause" : "Play"}</Button></div>
      <Source note={note} />
    </div>
  )
}

export const Wake: StoryObj = {
  name: "Recorded EEG, wake",
  render: () => <Recorded which="wake" note="110 s of the session's own scored wake, played back in real time and looped; no stimulus." />,
}

export const SteadyState: StoryObj = {
  name: "Recorded EEG, during a 40 Hz stimulus",
  render: () => (
    <Recorded which="assr"
      note="110 s of the run in which 40 Hz amplitude-modulated noise was played (the dataset's own task). The 40 Hz response is real (see Spectra) but small next to the 1/f background, so gamma's share stays small: share is relative power, not signal-to-noise." />
  ),
}

export const Baseline: StoryObj = {
  name: "Recorded EEG, each band against its own history",
  render: () => (
    <Recorded which="wake" measure="baseline"
      note="measure = 'baseline': a band's amplitude over its own 30 s mean, threshold 1.5 × its recent mean. For the first 30 s the baseline is the mean so far." />
  ),
}

type Tone = { f0: number; harmonics: number; rolloff: number; noise: number; wobble: number }

/** A fundamental and its harmonics, each harmonic's amplitude slowly modulated, plus white noise. Synthetic. */
function harmonicSource({ f0, harmonics, rolloff, noise, wobble }: Tone, rate: number) {
  let n = 0, seed = 7
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296 - 0.5 }
  return (count: number) => {
    const out = new Float32Array(count)
    for (let i = 0; i < count; i++, n++) {
      const t = n / rate
      let v = noise * rnd() * 3.46 // uniform with unit variance × noise
      for (let k = 1; k <= harmonics; k++) {
        if (k * f0 >= rate / 2) break
        const am = 1 + wobble * Math.sin(2 * Math.PI * (0.05 + 0.031 * k) * t + k)
        v += (10 / Math.pow(k, rolloff)) * am * Math.sin(2 * Math.PI * k * f0 * t)
      }
      out[i] = v
    }
    return out
  }
}

function Harmonics(args: Tone) {
  const rate = 250
  const view = React.useRef<BandProminenceHandle | null>(null)
  React.useEffect(() => {
    const next = harmonicSource(args, rate)
    view.current?.reset()
    const id = setInterval(() => view.current?.push(next(rate / 10)), 100)
    return () => clearInterval(id)
  }, [args.f0, args.harmonics, args.rolloff, args.noise, args.wobble]) // eslint-disable-line react-hooks/exhaustive-deps
  const lines = Array.from({ length: args.harmonics }, (_, k) => (k + 1) * args.f0).filter((f) => f < rate / 2)
  return (
    <div className="grid gap-3">
      <BandProminence rate={rate} unit="a.u." source={`synthetic · ${args.f0} Hz fundamental + ${args.harmonics - 1} harmonics · ${rate} Hz`}
        onReady={(v) => { view.current = v }} />
      <p className="text-xs text-muted-foreground font-mono">components at {lines.map((f) => `${+f.toFixed(2)} Hz`).join(", ")}</p>
    </div>
  )
}

export const FundamentalWithHarmonics: StoryObj<Tone> = {
  name: "A fundamental with harmonics (synthetic)",
  args: { f0: 5, harmonics: 8, rolloff: 1, noise: 1, wobble: 0.6 },
  argTypes: {
    f0: { control: { type: "range", min: 1, max: 20, step: 0.5 }, description: "fundamental, Hz" },
    harmonics: { control: { type: "range", min: 1, max: 12, step: 1 }, description: "components, the fundamental included" },
    rolloff: { control: { type: "range", min: 0, max: 2, step: 0.25 }, description: "amplitude of harmonic k = 10 / k^rolloff" },
    noise: { control: { type: "range", min: 0, max: 10, step: 0.5 }, description: "white noise, standard deviation" },
    wobble: { control: { type: "range", min: 0, max: 1, step: 0.1 }, description: "slow amplitude modulation depth per harmonic" },
  },
  render: (args) => <Harmonics {...args} />,
}
