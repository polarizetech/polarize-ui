import type { Meta, StoryObj } from "@storybook/react-vite";
import tokens from "../tokens.json";

const meta: Meta = { title: "Foundations/Colour" };
export default meta;

const Swatch = ({ hex, label }: { hex: string; label: string }) => (
  <div style={{ display: "grid", gap: "var(--space-1)", width: 104 }}>
    <div style={{ background: hex, height: 48, borderRadius: "var(--radius)", border: "1px solid var(--border)" }} />
    <span className="ui-label">{label}</span>
    <span className="ui-mono">{hex}</span>
  </div>
);

const Row = ({ children }: { children: React.ReactNode }) => (
  <div style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-4)", marginBottom: "var(--space-6)" }}>{children}</div>
);

export const EpistemicFamilies: StoryObj = {
  render: () => {
    const fam = tokens.epistemic.families as Record<string, { dark: string; light: string }>;
    return (
      <div className="ui-wrap">
        <h2 className="ui-display ui-display--2">Epistemic families</h2>
        <p>Evidence quality. Never used for chart series.</p>
        {(["light", "dark"] as const).map((mode) => (
          <Row key={mode}>
            {Object.entries(fam).map(([k, v]) => <Swatch key={k} hex={v[mode]} label={`${k} · ${mode}`} />)}
          </Row>
        ))}
      </div>
    );
  },
};

export const ChartSeries: StoryObj = {
  render: () => (
    <div className="ui-wrap">
      <h2 className="ui-display ui-display--2">Chart series</h2>
      <p>
        Fixed order, never cycled. Only the first {tokens.series.all_pairs_cap} slots clear the all-pairs
        colour-blindness check.
      </p>
      {(["light", "dark"] as const).map((mode) => (
        <Row key={mode}>
          {(tokens.series[mode] as string[]).map((hex, i) => <Swatch key={hex} hex={hex} label={`${mode} ${i + 1}`} />)}
        </Row>
      ))}
    </div>
  ),
};
