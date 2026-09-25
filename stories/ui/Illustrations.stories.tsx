import type { Meta, StoryObj } from "@storybook/react-vite"
import { Specimen } from "@/components/specimen"
import { SPECIMENS, SPECIMEN_LABELS, type SpecimenKey } from "@/specimens"

const meta: Meta = { title: "General UI/Illustrations" }
export default meta

const keys = Object.keys(SPECIMENS) as SpecimenKey[]

/** Every specimen at tile size and at 64px, the size each one must still read at. */
export const All: StoryObj = {
  render: () => (
    <div className="grid grid-cols-[repeat(auto-fill,minmax(160px,1fr))] gap-px overflow-hidden rounded-lg border bg-border">
      {keys.map((key) => (
        <figure key={key} className="m-0 grid gap-2 bg-card p-4 text-center">
          <Specimen name={key} />
          <div className="flex items-end justify-center gap-3">
            <Specimen name={key} className="size-16" />
            <Specimen name={key} className="size-8" />
          </div>
          <figcaption className="text-sm">
            {SPECIMEN_LABELS[key]} <span className="ui-label">{key}</span>
          </figcaption>
        </figure>
      ))}
    </div>
  ),
}
