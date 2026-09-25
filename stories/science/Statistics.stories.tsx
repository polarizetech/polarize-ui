import type { Meta, StoryObj } from "@storybook/react-vite"
import { NullDistribution } from "@/science/stats/NullDistribution"
import { nullDraws } from "../data"

const meta: Meta = {
  title: "Science/Statistics",
  parameters: {
    docs: {
      description: {
        component:
          "An observed statistic against its null (surrogates, permutations). p is the permutation p with the +1 correction, printed with its count; z is shown beside it because a p-value is not an effect size. All data synthetic.",
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
