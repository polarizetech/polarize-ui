import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta = { title: "Components" };
export default meta;

export const Buttons: StoryObj = {
  render: () => (
    <div className="ui-row">
      <button className="ui-btn ui-btn--primary">Record</button>
      <button className="ui-btn">Connect</button>
      <button className="ui-btn ui-btn--ghost">Cancel</button>
      <button className="ui-btn" aria-pressed="true">Toggle on</button>
    </div>
  ),
};

export const Card: StoryObj = {
  render: () => (
    <section className="ui-card" style={{ maxWidth: 480 }}>
      <h2>Stimulus</h2>
      <div className="ui-row">
        <label className="ui-field">Carrier (Hz)<input type="range" min={120} max={1000} defaultValue={500} /></label>
        <button className="ui-btn ui-btn--primary">Play</button>
      </div>
    </section>
  ),
};

export const Readout: StoryObj = {
  name: "Measured figures (readout)",
  render: () => (
    <dl className="ui-readout">
      <div><dt>Sample rate</dt><dd>250.0 Hz<small>measured from timestamps</small></dd></div>
      <div><dt>Mains pickup</dt><dd>+32.2 dB<small>60 Hz, p = 2e-26</small></dd></div>
      <div><dt>Contact</dt><dd>good<small>eeg-bridge quality check</small></dd></div>
    </dl>
  ),
};

export const MeasuredVsPredicted: StoryObj = {
  name: "Measured vs predicted values",
  render: () => (
    <p>
      Modulation: predicted <span className="ui-predicted">4.00 Hz</span>, measured{" "}
      <span className="ui-measured">4.03 Hz</span>. The two never share styling.
    </p>
  ),
};

export const Table: StoryObj = {
  render: () => (
    <table className="ui-table">
      <thead><tr><th>Channel</th><th>RMS (µV)</th><th>Verdict</th></tr></thead>
      <tbody>
        <tr><td>Oz</td><td className="ui-mono">5.3</td><td><ui-tier tier="MEASURED" /></td></tr>
        <tr><td>Cz</td><td className="ui-mono">7.9</td><td><ui-tier tier="PREDICTED" /></td></tr>
      </tbody>
    </table>
  ),
};
