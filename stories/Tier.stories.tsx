import type { Meta, StoryObj } from "@storybook/react-vite";
import tokens from "../tokens.json";

type TierDef = { id: string; label: string; family: string; meaning: string };
const TIERS = tokens.epistemic.tiers as TierDef[];

const meta: Meta<{ tier: string }> = {
  title: "Epistemic/Tier badge",
  argTypes: { tier: { control: "select", options: TIERS.map((t) => t.id) } },
  args: { tier: "MEASURED" },
  parameters: {
    docs: {
      description: {
        component:
          "`<ui-tier>` — always colour + word + glyph. There is deliberately no compact or icon-only form: PREDICTED must never be able to look like MEASURED.",
      },
    },
  },
};
export default meta;

export const Single: StoryObj<{ tier: string }> = {
  render: ({ tier }) => <ui-tier tier={tier} />,
};

export const AllTiers: StoryObj = {
  render: () => (
    <table className="ui-table">
      <thead>
        <tr><th>Badge</th><th>Family</th><th>Meaning</th></tr>
      </thead>
      <tbody>
        {TIERS.map((t) => (
          <tr key={t.id}>
            <td><ui-tier tier={t.id} /></td>
            <td className="ui-mono">{t.family}</td>
            <td>{t.meaning}</td>
          </tr>
        ))}
      </tbody>
    </table>
  ),
};

export const WithNote: StoryObj = {
  name: "Badge + documentation drawer",
  render: () => (
    <div>
      Tine mistune <ui-tier tier="MODELLED" />
      <ui-note title="Tine mistune" section="Realism layers" tier="MODELLED">
        <p>Real tines are never identical; 0.0009 gives about 0.23 Hz of beating on a 256 Hz fork. The number was chosen by ear.</p>
      </ui-note>
    </div>
  ),
};
