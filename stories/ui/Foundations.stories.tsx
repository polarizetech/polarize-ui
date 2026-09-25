import type { Meta, StoryObj } from "@storybook/react-vite"
import tokens from "../../tokens.json"
import { Display, Eyebrow, Standfirst } from "@/components/typography"

const meta: Meta = { title: "General UI/Foundations" }
export default meta

const Swatch = ({ color, label }: { color: string; label: string }) => (
  <div className="grid w-28 gap-1">
    <div className="h-12 rounded-md border" style={{ background: color }} />
    <span className="font-mono text-[11px] uppercase tracking-[.2em] text-muted-foreground">{label}</span>
  </div>
)

export const Colour: StoryObj = {
  render: () => (
    <div className="space-y-8">
      <section>
        <Display level={2}>Epistemic tiers</Display>
        <Standfirst>Evidence quality. Never used for a chart series.</Standfirst>
        <div className="mt-4 flex flex-wrap gap-4">
          {Object.keys(tokens.epistemic.families).map((k) => <Swatch key={k} color={`var(--tier-${k})`} label={k} />)}
        </div>
      </section>
      <section>
        <Display level={2}>Chart series</Display>
        <Standfirst>Fixed order, never cycled. Only the first {tokens.series.all_pairs_cap} clear the all-pairs colour-blindness check.</Standfirst>
        <div className="mt-4 flex flex-wrap gap-4">
          {[1, 2, 3, 4, 5].map((n) => <Swatch key={n} color={`var(--chart-${n})`} label={`chart ${n}`} />)}
        </div>
      </section>
      <section>
        <Display level={2}>Surfaces</Display>
        <div className="mt-4 flex flex-wrap gap-4">
          {["background", "card", "muted", "primary", "border", "destructive"].map((k) => <Swatch key={k} color={`var(--${k})`} label={k} />)}
        </div>
      </section>
    </div>
  ),
}

export const Typography: StoryObj = {
  render: () => (
    <div className="max-w-2xl space-y-3">
      <Eyebrow accent>DIY bench · n-of-1 · not yet run</Eyebrow>
      <Display>Display one</Display>
      <Standfirst>The standfirst: one sentence saying what this page is for.</Standfirst>
      <p>Running text is Inter, never bold and never tracked. Hierarchy comes from size, face, colour and case. <strong>Strong</strong> is marked by full-strength ink.</p>
      <Display level={2}>Display two</Display>
      <Eyebrow>An uppercase mono kicker</Eyebrow>
      <Display level={3}>Display three</Display>
      <p className="font-mono tabular-nums">0.0123 Hz · 250.0 Hz · +32.2 dB</p>
    </div>
  ),
}
