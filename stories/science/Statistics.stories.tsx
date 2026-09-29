import type { Meta, StoryObj } from "@storybook/react-vite"
import { NullDistribution } from "@/science/stats/NullDistribution"
import { nullDraws } from "../data"
import eesm from "../datasets/ds005185-eesm19/data.json"
import eesmSource from "../datasets/ds005185-eesm19/SOURCE.json"
import { Eyebrow } from "@/components/typography"

const meta: Meta = {
  title: "Science/Statistics",
  parameters: {
    docs: {
      description: {
        component:
          "An observed statistic against its null (surrogates, permutations). p is the permutation p with the +1 correction, printed with its count; z is shown beside it because a p-value is not an effect size. Synthetic data, except the stories marked real.",
      },
    },
  },
}
export default meta

const null999 = nullDraws(999)

export const BeatsNull: StoryObj = {
  name: "Observed beats its null",
  render: () => (
    <NullDistribution nullValues={null999} observed={0.30} statistic="inter-trial phase coherence"
      nullLabel="phase-randomised surrogates" />
  ),
}

export const InsideNull: StoryObj = {
  name: "Observed inside its null",
  render: () => (
    <NullDistribution nullValues={null999} observed={0.23} statistic="inter-trial phase coherence"
      nullLabel="phase-randomised surrogates" />
  ),
}

export const AtFloor: StoryObj = {
  name: "p at its floor (too few surrogates)",
  render: () => (
    <NullDistribution nullValues={nullDraws(99)} observed={0.45} statistic="inter-trial phase coherence"
      nullLabel="phase-randomised surrogates" />
  ),
}

export const TwoSided: StoryObj = {
  name: "Two-sided test",
  render: () => (
    <NullDistribution nullValues={nullDraws(999, 0, 1, 9)} observed={-2.4} statistic="Δ power, condition A − B (z)"
      alternative="two-sided" nullLabel="label permutations" />
  ),
}

// ── Real data: which null a result beats matters ────────────────────────────────────

function Ladder({ run, label }: { run: (typeof eesm.surrogates)["data"]; label: string }) {
  return (
    <div className="grid gap-4">
      <Eyebrow>{label}</Eyebrow>
      {Object.entries(run.nulls).map(([name, n]) => (
        <NullDistribution key={name} nullValues={n.null} observed={run.observed} alternative="two-sided"
          statistic="time-reversal asymmetry" nullLabel={`${name}, ${n.null.length} surrogates`} height={170} />
      ))}
    </div>
  )
}

export const SurrogateLadder: StoryObj = {
  name: "Three linear nulls, one statistic (real EEG)",
  render: () => (
    <div className="grid gap-6">
      <p className="m-0 max-w-3xl text-sm text-muted-foreground">
        Is this EEG more than a linear process with its spectrum? The answer depends on the null. Phase-randomised
        surrogates keep the spectrum but make the amplitudes Gaussian, so they can be beaten by a record that is merely
        non-Gaussian. Amplitude-adjusted surrogates (AAFT, IAAFT) keep both. Here the data beats the first at the floor of its p-value and only
        reaches the edge of the other two (p 0.05 and 0.07; z falls from 3.2 to 1.8–2.0): most of what
        the first null "detected" is a non-Gaussian amplitude distribution, not nonlinear dynamics. The right
        column runs the same test on a phase-randomised copy of the data, which is linear by construction and must
        not reject.
      </p>
      <div className="grid gap-8 xl:grid-cols-2">
        <Ladder run={eesm.surrogates.data} label="The data" />
        <Ladder run={eesm.surrogates.linear_control} label="Control: a linear copy of the data" />
      </div>
      <p className="m-0 font-mono text-[length:var(--text-xs)] text-muted-foreground">
        {eesm.surrogates.segment} · {eesm.surrogates.statistic} (Schreiber & Schmitz 2000)
      </p>
      <p className="max-w-3xl text-[length:var(--text-xs)] text-muted-foreground">
        <span className="font-mono">Data · {eesmSource.licence} · {eesmSource.accession}.</span> {eesmSource.attribution}
      </p>
    </div>
  ),
}
