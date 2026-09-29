import type { Meta, StoryObj } from "@storybook/react-vite"
import { LineChart } from "@/science/charts/LineChart"
import { NullDistribution } from "@/science/stats/NullDistribution"
import { Eyebrow } from "@/components/typography"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import eesm from "virtual:dataset/ds005185-eesm19"
import eesmSource from "../datasets/ds005185-eesm19/SOURCE.json"

const meta: Meta = {
  title: "Science/Spectra",
  parameters: {
    docs: {
      description: {
        component:
          "Reading a spectrum honestly: a peak is judged against its own neighbourhood or against the fitted 1/f background, never against zero. Real public EEG (OpenNeuro ds005185, CC0).",
      },
    },
  },
}
export default meta

function Source() {
  return (
    <p className="mt-3 max-w-3xl text-[length:var(--text-xs)] text-muted-foreground">
      <span className="font-mono">Data · {eesmSource.licence} · {eesmSource.accession}.</span> {eesmSource.attribution}
    </p>
  )
}

const ss = eesm.steady_state
const fmtP = (p: number) => (p < 1e-4 ? p.toExponential(1) : p.toFixed(3))
const nTests = Object.keys(ss.tests).length
const tests = Object.entries(ss.tests) as [string, { hz: number; F: number; p: number; snr_db: number }][]

export const SteadyStateResponse: StoryObj = {
  name: "Steady-state response (40 Hz, real EEG)",
  render: () => (
    <div className="grid gap-6">
      <LineChart
        title="Power near 40 Hz while 40 Hz amplitude-modulated noise played"
        series={[{ label: `F3, ${ss.segment_s[0]}–${ss.segment_s[1]} s, one FFT (${ss.resolution_hz} Hz bins)`, points: ss.freq_hz.map((f, i) => [f, ss.power_db[i]] as [number, number]) }]}
        x={{ label: "frequency (Hz)" }} y={{ label: "power (dB, arbitrary reference)" }}
        thresholds={[
          { value: 40, axis: "x", label: "40 Hz: the rate that was played", tier: "predicted" },
        ]}
        height={280}
      />
      <div>
        <Eyebrow>Each frequency against its own neighbourhood</Eyebrow>
        <Table>
          <TableHeader>
            <TableRow><TableHead>frequency</TableHead><TableHead>SNR (dB)</TableHead><TableHead>F(2, 80)</TableHead><TableHead>p</TableHead><TableHead>p × {nTests} (Bonferroni)</TableHead></TableRow>
          </TableHeader>
          <TableBody>
            {tests.map(([name, t]) => (
              <TableRow key={name}>
                <TableCell>{name}</TableCell>
                <TableCell className="font-mono tabular-nums">{t.snr_db.toFixed(1)}</TableCell>
                <TableCell className="font-mono tabular-nums">{t.F.toFixed(2)}</TableCell>
                <TableCell className="font-mono tabular-nums">{fmtP(t.p)}</TableCell>
                <TableCell className="font-mono tabular-nums">{fmtP(Math.min(1, t.p * nTests))}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="mt-2 max-w-3xl text-[length:var(--text-xs)] text-muted-foreground">
          {ss.test}. Four frequencies were tested, so each p is also shown multiplied by four: only the stimulus rate survives.
          A response at the rate that was played is evidence the signal reached the brainstem and cortex; it is not a measure of
          anything the listener perceived.
        </p>
      </div>
      <div>
        <Eyebrow>The 40 Hz bin against 300 other bins in the same band</Eyebrow>
        <NullDistribution nullValues={ss.null_snr_db} observed={ss.tests["40 Hz (stimulus rate)"].snr_db}
          statistic="SNR against neighbouring bins (dB)" alternative="greater"
          nullLabel="300 random frequencies, 20–60 Hz, at least 1 Hz from 37/40/43/50 Hz" height={220} />
      </div>
      <Source />
    </div>
  ),
}

type Fit = (typeof eesm.aperiodic)["assr"]

function FitPanel({ fit, label }: { fit: Fit; label: string }) {
  const pts = (ys: number[]) => fit.freq_hz.map((f, i) => [f, ys[i]] as [number, number])
  const flat = fit.log_power.map((v, i) => v - fit.aperiodic_log_power[i])
  return (
    <div className="grid gap-3">
      <Eyebrow>{label}</Eyebrow>
      <LineChart
        title={`${label}: spectrum and its fitted aperiodic background`}
        series={[
          { label: "spectrum (Welch), measured", points: pts(fit.log_power), color: "var(--tier-measured)" },
          { label: `aperiodic fit, exponent ${fit.exponent} (model)`, points: pts(fit.aperiodic_log_power), dash: true, color: "var(--tier-predicted)" },
        ]}
        x={{ type: "log", label: "frequency (Hz)" }} y={{ label: "log₁₀ power (µV²/Hz)" }} height={220}
      />
      <LineChart
        title={`${label}: spectrum minus the aperiodic fit`}
        series={[{ label: "above the 1/f background", points: pts(flat) }]}
        x={{ type: "log", label: "frequency (Hz)" }} y={{ label: "log₁₀ power above fit" }}
        thresholds={[{ value: 0, label: "the background", tier: "predicted" }]} height={180}
      />
      <Table>
        <TableHeader><TableRow><TableHead>peak the fit reports</TableHead><TableHead>height (log₁₀ above fit)</TableHead><TableHead>width (Hz)</TableHead></TableRow></TableHeader>
        <TableBody>
          {fit.peaks.map((p) => (
            <TableRow key={p.cf_hz}>
              <TableCell className="font-mono tabular-nums">{p.cf_hz} Hz</TableCell>
              <TableCell className="font-mono tabular-nums">{p.height_log10}</TableCell>
              <TableCell className="font-mono tabular-nums">{p.bw_hz}{p.bw_hz <= 1 ? " (at the width floor)" : ""}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      <p className="m-0 font-mono text-[length:var(--text-xs)] text-muted-foreground">
        {fit.settings} · fit R² {fit.r_squared} · 0.5 Hz resolution, so a 1 Hz width is two bins · the
        'fixed' background has no knee, so a bend in the 1/f can be reported as broad peaks instead — another
        background model would move them
      </p>
    </div>
  )
}

export const AperiodicFit: StoryObj = {
  name: "Peaks above the 1/f background (real EEG)",
  render: () => (
    <div className="grid gap-8">
      <p className="m-0 max-w-3xl text-sm text-muted-foreground">
        Neural power spectra fall roughly as 1/f, so a bump is only a rhythm if it rises above that background.
        The fit reports every bump it can model — including the 50 Hz mains line in the first recording. A fitted
        peak says where the spectrum departs from 1/f; which peaks are physiology is a separate judgement.
      </p>
      <FitPanel fit={eesm.aperiodic.assr} label="During 40 Hz stimulation (ASSR run, 130–240 s)" />
      <FitPanel fit={eesm.aperiodic.wake} label="Resting in bed, scored wake (110 s)" />
      <Source />
    </div>
  ),
}
