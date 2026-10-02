import type { Meta, StoryObj } from "@storybook/react-vite"
import * as React from "react"
import { TissueField } from "@/science/space/TissueField"
import { makeDemoField } from "../models/tissue-demo/relay.mjs"

const meta: Meta = {
  title: "Science/Tissue field",
  parameters: {
    docs: {
      description: {
        component:
          "A tissue's activity drawn as a gradient spreading through a 3-D volume, with the cells, synapses and pulses " +
          "optionally drawn over it. It draws only what it is given: a `tissue-field/1` document that names its tier, source, " +
          "layout, units and domain, or it refuses. The data here are SYNTHETIC (a five-stage relay chain written to exercise " +
          "the renderer) and make no claim about any tissue.",
      },
    },
  },
}
export default meta

export const SyntheticRelay: StoryObj = {
  render: () => {
    const [preset, setPreset] = React.useState<"driven" | "loop">("driven")
    const field = React.useMemo(() => makeDemoField({ preset }), [preset])
    const [playing, setPlaying] = React.useState(false)
    return (
      <div className="max-w-5xl">
        <div className="mb-3 flex gap-3 text-[length:var(--text-sm)]">
          <button className="ui-btn" onClick={() => setPreset(preset === "driven" ? "loop" : "driven")}>Preset: {preset}</button>
          <button className="ui-btn" onClick={() => setPlaying(!playing)}>{playing ? "Pause" : "Play"}</button>
        </div>
        <TissueField field={field} playing={playing} />
      </div>
    )
  },
}
