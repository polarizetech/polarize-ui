import type { Meta, StoryObj } from "@storybook/react-vite"
import * as React from "react"
import { Comodulogram } from "@/science/signals/Comodulogram"
import { computeComodulogram } from "@/science/stats/pac"
import { LineChart } from "@/science/charts/LineChart"
import { Readout } from "@/science/evidence/value"
import { Tier } from "@/science/evidence/tier"
import { Slider } from "@/components/ui/slider"
import { Eyebrow } from "@/components/typography"
import { sharpSignal } from "../data"
import { contrastResponse, population, type NormParams } from "../models/normalization"
import { simulate, type JeffressParams } from "../models/jeffress"

const meta: Meta = {
  title: "Science/Mechanisms",
  parameters: {
    docs: {
      description: {
        component:
          "Mechanisms you can watch: each is a published model or a synthetic signal with its ground truth written down, the controls are the model's own parameters, and a number is printed beside every picture so the picture can be checked. Every output here is MODELLED.",
      },
    },
  },
}
export default meta

function Control({ label, value, min, max, step, onCommit, format = (v: number) => String(v) }: {
  label: string; value: number; min: number; max: number; step: number
  onCommit: (v: number) => void; format?: (v: number) => string
}) {
  const [v, setV] = React.useState(value)
  return (
    <label className="grid gap-1.5">
      <span className="flex justify-between font-mono text-[length:var(--text-xs)] text-muted-foreground">
        <span>{label}</span><span className="tabular-nums">{format(v)}</span>
      </span>
      <Slider min={min} max={max} step={step} value={[v]} onValueChange={([x]) => setV(x)} onValueCommit={([x]) => onCommit(x)} aria-label={label} />
    </label>
  )
}

// ── 1. False coupling from a sharp waveform ─────────────────────────────────────────
const FS = 500
const phaseFreqs = [4, 5, 6, 7, 8, 9, 10]
const ampFreqs = Array.from({ length: 16 }, (_, i) => 25 + i * 5)

function FalseCouplingLab() {
  const [sharpness, setSharpness] = React.useState(0)
  const [coupled, setCoupled] = React.useState(false)
  const signal = React.useMemo(() => sharpSignal({ sharpness, coupled, fs: FS, secs: 30 }), [sharpness, coupled])
  const result = React.useMemo(
    () => computeComodulogram({ signal, fs: FS, phaseFreqs, ampFreqs, nSurrogates: 100 }),
    [signal],
  )
  const resolvable = result.resolvable.flat().filter(Boolean).length
  const significant = result.significant.flat().filter(Boolean).length
  const maxMI = Math.max(...result.mi.flat().filter((_, i) => result.resolvable.flat()[i]))
  const trace = Array.from(signal.slice(0, FS)).map((v, i) => [i / FS, v] as [number, number])
  const spurious = !coupled && significant > 0

  return (
    <div className="grid gap-6">
      <p className="m-0 max-w-3xl text-sm text-muted-foreground">
        A slow 6 Hz rhythm plus an independent 60 Hz rhythm and noise. With no coupling built in, turn the slow wave
        from a sine into a sawtooth: its sharp edges are made of harmonics locked to its own phase, the comodulogram
        reads them as phase–amplitude coupling, and the time-shift surrogates do not catch it, because shifting the
        signal moves the harmonics with it. This is the best-known false positive of the method (Kramer, Tort &
        Kopell 2008; Aru et al. 2015). Look at the raw waveform before believing a comodulogram.
      </p>
      <div className="grid max-w-2xl gap-4 md:grid-cols-[1fr_auto] md:items-end">
        <Control label="slow-wave sharpness (0 sine → 1 sawtooth)" value={sharpness} min={0} max={1} step={0.1}
          onCommit={setSharpness} format={(v) => v.toFixed(1)} />
        <label className="flex items-center gap-2 font-mono text-[length:var(--text-xs)] text-muted-foreground">
          <input type="checkbox" checked={coupled} onChange={(e) => setCoupled(e.target.checked)} />
          real coupling built in
        </label>
      </div>
      <Readout items={[
        { label: "ground truth", value: coupled ? "coupled" : "no coupling", source: "how the signal was built" },
        { label: "significant cells", value: `${significant} / ${resolvable}`, source: `family-wise α ${result.alpha}, ${result.nSurrogates} time-shift surrogates` },
        { label: "largest MI", value: maxMI.toExponential(2), source: "Tort modulation index, resolvable cells" },
        { label: "verdict", value: spurious ? "false positive" : significant ? "detected" : "nothing detected", source: "comodulogram against ground truth" },
      ]} />
      <div>
        <Eyebrow>The first second of the signal <Tier id="MODELLED" /></Eyebrow>
        <LineChart title="Raw synthetic signal, first second" series={[{ label: "signal", points: trace }]}
          x={{ label: "time (s)" }} y={{ label: "amplitude (a.u.)" }} height={180} />
      </div>
      <Comodulogram result={result} colorDomain={[0, 0.03]} scaleNote="shared"
        title="Comodulogram of the synthetic signal" />
    </div>
  )
}

export const FalseCoupling: StoryObj = {
  name: "False coupling from a sharp waveform",
  render: () => <FalseCouplingLab />,
}

// ── 2. Two stimuli sharing one population ───────────────────────────────────────────
const DEFAULTS: NormParams = { contrastA: 0.6, contrastB: 0.3, posA: 0.35, posB: 0.65, tuningWidth: 0.08, exponent: 2, sigma: 0.15 }

function NormalizationLab() {
  const [p, setP] = React.useState(DEFAULTS)
  const set = (k: keyof NormParams) => (v: number) => setP((q) => ({ ...q, [k]: v }))
  const pop = React.useMemo(() => population(p), [p])
  const alone = React.useMemo(() => population({ ...p, contrastB: 0 }), [p])
  const crfWith = React.useMemo(() => contrastResponse(p), [p])
  const crfAlone = React.useMemo(() => contrastResponse({ ...p, contrastB: 0 }), [p])
  const suppression = alone.totalA > 0 ? 1 - pop.totalA / alone.totalA : 0
  const pct = (v: number) => `${Math.round(v * 100)} %`

  return (
    <div className="grid gap-6">
      <p className="m-0 max-w-3xl text-sm text-muted-foreground">
        Eighty units tuned along one axis see two stimuli, A and B. Each unit's response is its drive divided by the
        pooled drive of the whole population (divisive normalization; Heeger 1992, Carandini & Heeger 2012). Raise B and
        the units that respond to A respond less, although nothing connects them directly: they share a denominator.
        This is a textbook model with chosen parameters, not a fit to any recording.
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        <Control label="contrast A" value={p.contrastA} min={0} max={1} step={0.05} onCommit={set("contrastA")} format={pct} />
        <Control label="contrast B" value={p.contrastB} min={0} max={1} step={0.05} onCommit={set("contrastB")} format={pct} />
        <Control label="separation of A and B" value={p.posB - p.posA} min={0.05} max={0.6} step={0.05}
          onCommit={(d) => setP((q) => ({ ...q, posA: 0.5 - d / 2, posB: 0.5 + d / 2 }))} format={(v) => v.toFixed(2)} />
        <Control label="tuning width (SD)" value={p.tuningWidth} min={0.02} max={0.2} step={0.01} onCommit={set("tuningWidth")} format={(v) => v.toFixed(2)} />
        <Control label="exponent n" value={p.exponent} min={1} max={4} step={0.25} onCommit={set("exponent")} format={(v) => v.toFixed(2)} />
        <Control label="semi-saturation σ (contrast)" value={p.sigma} min={0.02} max={0.5} step={0.01} onCommit={set("sigma")} format={(v) => v.toFixed(2)} />
      </div>
      <Readout items={[
        { label: "units nearer A", value: pop.totalA.toFixed(2), source: "summed response, model units" },
        { label: "units nearer B", value: pop.totalB.toFixed(2), source: "summed response, model units" },
        { label: "A suppressed by B", value: pct(suppression), source: "vs the same A with B at 0" },
      ]} />
      <div>
        <Eyebrow>Across the population <Tier id="MODELLED" /></Eyebrow>
        <LineChart title="Normalized response of each unit, with and without B"
          series={[
            { label: `with B at ${pct(p.contrastB)}`, points: pop.pref.map((x, i) => [x, pop.resp[i]] as [number, number]), color: "var(--chart-1)" },
            { label: "B absent", points: alone.pref.map((x, i) => [x, alone.resp[i]] as [number, number]), dash: true, color: "var(--chart-2)" },
          ]}
          x={{ label: "unit's preferred value (a.u.)", domain: [0, 1] }} y={{ label: "model units" }} height={240} />
      </div>
      <div>
        <Eyebrow>Contrast response of the units nearer A <Tier id="MODELLED" /></Eyebrow>
        <LineChart title="Summed response of the units nearer A as A's contrast rises"
          series={[
            { label: `with B at ${pct(p.contrastB)}`, points: crfWith, color: "var(--chart-1)" },
            { label: "B absent", points: crfAlone, dash: true, color: "var(--chart-2)" },
          ]}
          x={{ label: "contrast of A", domain: [0, 1] }} y={{ label: "summed response (model units)" }} height={220} />
      </div>
    </div>
  )
}

export const SharedPopulation: StoryObj = {
  name: "Two stimuli sharing one population (normalization)",
  render: () => <NormalizationLab />,
}

// ── 3. Where a sound is, from when it arrives (Jeffress) ────────────────────────────
const DELAYS = Array.from({ length: 141 }, (_, i) => -700 + i * 10)
const HEAD_US = 660

function JeffressLab() {
  const [p, setP] = React.useState<JeffressParams>({ toneHz: 500, itdUs: 300, windowUs: 50, vectorStrength: 0.7, rateHz: 300, seconds: 2 })
  const set = (k: keyof JeffressParams) => (v: number) => setP((q) => ({ ...q, [k]: v }))
  const sim = React.useMemo(() => simulate(p, DELAYS), [p])
  const periodUs = 1e6 / p.toneHz
  const aliases = [-2, -1, 1, 2].map((k) => p.itdUs + k * periodUs).filter((d) => Math.abs(d) <= 700)
  const pts = (ys: number[]) => DELAYS.map((d, i) => [d, ys[i]] as [number, number])

  return (
    <div className="grid gap-6">
      <p className="m-0 max-w-3xl text-sm text-muted-foreground">
        Each ear's nerve fires locked to the phase of a tone. A row of coincidence detectors delays the left ear's
        spikes by a different amount each; the one whose delay cancels the interaural time difference fires most
        (Jeffress 1948). The response repeats every period of the tone, so above roughly 1 kHz a second peak falls
        inside the range a human head can produce, and the place alone becomes ambiguous. This is the textbook model:
        in birds a delay-line map like this is well supported; in mammals it is contested (Brand et al. 2002;
        McAlpine &amp; Grothe 2003).
      </p>
      <div className="grid gap-4 md:grid-cols-3">
        <Control label="interaural time difference (µs, + = left first)" value={p.itdUs} min={-HEAD_US} max={HEAD_US} step={20} onCommit={set("itdUs")} />
        <Control label="tone frequency (Hz)" value={p.toneHz} min={100} max={1500} step={50} onCommit={set("toneHz")} />
        <Control label="phase locking (vector strength)" value={p.vectorStrength} min={0} max={0.95} step={0.05} onCommit={set("vectorStrength")} format={(v) => v.toFixed(2)} />
        <Control label="coincidence window (µs)" value={p.windowUs} min={10} max={200} step={10} onCommit={set("windowUs")} />
        <Control label="spike rate per ear (spikes/s)" value={p.rateHz} min={50} max={600} step={50} onCommit={set("rateHz")} />
        <Control label="listening time (s)" value={p.seconds} min={0.5} max={5} step={0.5} onCommit={set("seconds")} format={(v) => v.toFixed(1)} />
      </div>
      <Readout items={[
        { label: "true ITD", value: `${p.itdUs} µs`, source: "how the input was built" },
        { label: "detector firing most", value: `${sim.best} µs`, source: "argmax of the simulated counts" },
        { label: "other peaks in range", value: aliases.length ? aliases.map((a) => `${Math.round(a)}`).join(", ") + " µs" : "none", source: `ITD ± whole periods (${Math.round(periodUs)} µs) within ±700 µs` },
        { label: "spikes (left / right)", value: `${sim.spikesLeft} / ${sim.spikesRight}`, source: `${p.rateHz}/s for ${p.seconds} s, Poisson` },
      ]} />
      <div>
        <Eyebrow>Coincidences at each detector <Tier id="MODELLED" /></Eyebrow>
        <LineChart title="Coincidence count across the row of detectors"
          series={[
            { label: "simulated count", points: pts(sim.counts), color: "var(--chart-1)" },
            { label: "expected count (closed form)", points: pts(sim.expected), dash: true, color: "var(--chart-2)" },
          ]}
          x={{ label: "detector's internal delay on the left input (µs)", domain: [-700, 700] }}
          y={{ label: "coincidences" }}
          thresholds={[{ value: p.itdUs, axis: "x", label: "true ITD", tier: "predicted" }]}
          height={260} />
        <p className="mt-2 max-w-3xl text-[length:var(--text-xs)] text-muted-foreground">
          The expected curve is R²·T·w·I₀(2κ·cos(πf·(ITD − d)))/I₀(κ)² for a von Mises phase-locking profile, so the
          simulation can be checked against it. ±{HEAD_US} µs is about the largest ITD a human head produces.
        </p>
      </div>
    </div>
  )
}

export const WhereFromWhen: StoryObj = {
  name: "Where a sound is, from when it arrives (Jeffress)",
  render: () => <JeffressLab />,
}
