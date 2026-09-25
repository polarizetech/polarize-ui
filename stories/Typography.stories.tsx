import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta = { title: "Foundations/Typography" };
export default meta;

export const Roles: StoryObj = {
  render: () => (
    <div className="ui-wrap">
      <p className="ui-label ui-label--accent">DIY bench · n-of-1 · not yet run</p>
      <h1 className="ui-display ui-display--1">Display one</h1>
      <p className="ui-standfirst">The standfirst: one sentence saying what this page is for.</p>
      <p>
        Running text is Inter, never bold and never tracked. Hierarchy comes from size, face, colour and
        case. <strong>Strong</strong> is marked by full-strength ink, not weight.
      </p>
      <h2 className="ui-display ui-display--2">Display two</h2>
      <p className="ui-label">An uppercase mono kicker</p>
      <h3 className="ui-display ui-display--3">Display three</h3>
      <p className="ui-mono">0.0123 Hz · 250.0 Hz · +32.2 dB</p>
    </div>
  ),
};
