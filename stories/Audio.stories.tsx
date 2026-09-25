import type { Meta, StoryObj } from "@storybook/react-vite";

const meta: Meta = { title: "Audio primitives" };
export default meta;

// A synthetic 40 Hz AM tone envelope, drawn as an SVG path. Illustration only.
function wavePath(w: number, h: number, n = 400) {
  const pts: string[] = [];
  for (let i = 0; i < n; i++) {
    const x = (i / (n - 1)) * w;
    const env = 0.55 + 0.45 * Math.sin(i * 0.25);
    const y = h / 2 - (env * Math.sin(i * 1.7) * h) / 2.4;
    pts.push(`${i ? "L" : "M"}${x.toFixed(1)},${y.toFixed(1)}`);
  }
  return pts.join(" ");
}

export const Waveform: StoryObj = {
  render: () => (
    <div className="ui-waveform" style={{ position: "relative", height: 96, maxWidth: 640 }}>
      <svg viewBox="0 0 640 96" width="100%" height="96" preserveAspectRatio="none">
        <path d={wavePath(640, 96)} fill="none" stroke="currentColor" strokeWidth={1} />
      </svg>
      <div className="ui-waveform__playhead" style={{ left: "35%" }} />
      <div className="ui-region-marker" style={{ left: "55%", width: "12%" }} />
    </div>
  ),
};

export const Transport: StoryObj = {
  render: () => (
    <div className="ui-transport">
      <button className="ui-transport__play" aria-label="Play">▶</button>
      <button className="ui-transport__btn" aria-label="Repeat">⟲</button>
      <span className="ui-transport__time">00:12 / 05:00</span>
      <span className="ui-live-dot" aria-label="recording" />
    </div>
  ),
};

export const InkTags: StoryObj = {
  name: "Audio-ink tags (polarize theme)",
  render: () => (
    <div className="ui-row">
      <span className="ui-tag ui-tag--clay">signal</span>
      <span className="ui-tag ui-tag--ochre">annotation</span>
      <span className="ui-tag ui-tag--lichen">machine</span>
    </div>
  ),
};
