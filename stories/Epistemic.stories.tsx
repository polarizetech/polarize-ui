import type { Meta, StoryObj } from "@storybook/react-vite"
import { Tier, TIERS, type TierId } from "@/components/tier"
import { Hint, Note } from "@/components/docs"
import { Value } from "@/components/value"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

const ids = Object.keys(TIERS) as TierId[]

const meta: Meta<{ id: TierId }> = {
  title: "Epistemic",
  component: Tier,
  args: { id: "MEASURED" },
  argTypes: { id: { control: "select", options: ids } },
}
export default meta

export const TierBadge: StoryObj<{ id: TierId }> = { name: "Tier badge", render: (a) => <Tier id={a.id} /> }

export const AllTiers: StoryObj = {
  name: "All tiers",
  render: () => (
    <Table>
      <TableHeader><TableRow><TableHead>Badge</TableHead><TableHead>Family</TableHead><TableHead>Meaning</TableHead></TableRow></TableHeader>
      <TableBody>
        {ids.map((id) => (
          <TableRow key={id}>
            <TableCell><Tier id={id} /></TableCell>
            <TableCell className="font-mono text-xs">{TIERS[id].family}</TableCell>
            <TableCell className="whitespace-normal">{TIERS[id].meaning}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  ),
}

export const DocumentationDrawer: StoryObj = {
  name: "Note → documentation drawer",
  render: () => (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        Tine mistune <Tier id="MODELLED" />
        <Note title="Tine mistune" section="Realism layers" tier="MODELLED">
          <p>Real tines are never identical; 0.0009 gives about 0.23 Hz of beating on a 256 Hz fork. The number was chosen by ear.</p>
        </Note>
      </div>
      <div className="flex items-center gap-2">
        Rotating fork modulation <Tier id="MEASURED" />
        <Note title="Rotating fork modulation" section="Readouts" tier="MEASURED">
          <p>The ledger predicted 4×spin; the render measured 2×spin at every rate tested, because the four lobes are unequal.</p>
        </Note>
      </div>
      <p className="text-sm text-muted-foreground">
        Hover for a one-line <Hint text="kr < 1 means the near field: four lobes, not two.">near field</Hint> hint.
      </p>
    </div>
  ),
}

export const MeasuredVsPredicted: StoryObj = {
  name: "Measured vs predicted values",
  render: () => (
    <p>
      Modulation: predicted <Value kind="predicted">4.00 Hz</Value>, measured <Value kind="measured">4.03 Hz</Value>.
      The two never share styling.
    </p>
  ),
}
