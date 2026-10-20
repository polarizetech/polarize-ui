import * as React from "react"
import type { Meta, StoryObj } from "@storybook/react-vite"
import {
  AutomationLane, ChannelStrip, ChannelStrips, Delta, Fader, Glide, Hazard, HoldButton, Knob, LinkedValue,
  Meter, NightView, Panner, SceneTimeline, SyncPill, TabBar, valueAt, type MotionPath, type Scene,
} from "@/components/controls"
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet"
import { Button } from "@/components/ui/button"

/* Every value here is synthetic. */

const meta: Meta = {
  title: "General UI/Controls",
  globals: { theme: "polarize" },
  parameters: {
    docs: {
      description: {
        component:
          "Hardware-style controls for audio and instrument interfaces. Faders and knobs are native range inputs underneath; " +
          "the timeline, lane and panner are SVG views that the caller moves through time. Every crossed detent fires a " +
          "bubbling `ui-detent` DOM event, the hook for haptics in a native shell.",
      },
    },
  },
}
export default meta

const SCENES: Scene[] = [
  { label: "Settle", hold: 360, transition: 0 },
  { label: "Descend", hold: 480, transition: 90 },
  { label: "Hold", hold: 420, transition: 120 },
  { label: "Lift", hold: 240, transition: 60 },
  { label: "Return", hold: 180, transition: 30 },
]
const RATE = [9.7, 6.5, 6.5, 40, 40]
const OFFSET = [-40, 120, 0, 0, 0]
const LEVEL = [0.3, 0.4, 0.4, 0.2, 0.2]
const CARRIER = [500, 500, 600, 600, 500]

const Panel = ({ children, width = 380 }: { children: React.ReactNode; width?: number }) => (
  <div style={{ maxWidth: width, display: "flex", flexDirection: "column", gap: 16 }}>{children}</div>
)

/** Watch the ui-detent events a story fires, so the haptic hook is visible. */
function useDetents() {
  const [last, setLast] = React.useState<string>("none yet")
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const el = ref.current
    const on = (e: Event) => { const d = (e as CustomEvent).detail; setLast(`${d.kind} at ${d.value}`) }
    el?.addEventListener("ui-detent", on)
    return () => el?.removeEventListener("ui-detent", on)
  }, [])
  return { ref, last }
}

export const Faders: StoryObj = {
  render: () => {
    const [hold, setHold] = React.useState(8)
    const [rate, setRate] = React.useState(9.41)
    const [level, setLevel] = React.useState(0.8)
    const d = useDetents()
    return (
      <div ref={d.ref}>
        <Panel>
          <Fader label="Hold" value={hold} min={0} max={120} step={0.5} unit="min" digits={1} detents={[30, 60, 90]} ticks={8} onChange={setHold} />
          <Fader label="Rate" value={rate} min={0.04} max={200} scale="log" unit="Hz" detents={[0.5, 4, 8, 12, 30, 40]} onChange={setRate}
            adornment={<LinkedValue formula="mine × 0.97" resolved="9.41 Hz" onUnlink={() => {}} />} />
          <Fader label="Level" value={level} min={0} max={1.5} step={0.01} detents={[1]} onChange={setLevel} />
          <p className="ui-control__note">Last detent: {d.last}. Drag away from a track for fine steps; tap a value to type one.</p>
        </Panel>
      </div>
    )
  },
}

export const Ribbon: StoryObj = {
  name: "Bipolar ribbon",
  render: () => {
    const [itd, setItd] = React.useState(120)
    const [ild, setIld] = React.useState(3)
    return (
      <Panel>
        <Fader variant="ribbon" label="Interaural time" value={itd} min={-660} max={660} step={1} unit="µs" digits={0} signed
          detents={[0]} mark={-40} markLabel="mine −40" ticks={6} onChange={setItd}
          adornment={<LinkedValue formula="my centre + 160 µs" />} />
        <div style={{ display: "flex", gap: 16, alignItems: "center" }}>
          <Knob label="Balance" value={ild} min={-30} max={30} step={0.5} unit="dB" digits={1} signed detents={[0]} ticks={12} onChange={setIld} />
          <Knob label="Detune" value={12} min={-1200} max={1200} step={1} unit="¢" digits={0} signed detents={[-1200, -1100, -1000, -900, -800, -700, -600, -500, -400, -300, -200, -100, 0, 100, 200, 300, 400, 500, 600, 700, 800, 900, 1000, 1100, 1200]} size="lg" />
        </div>
      </Panel>
    )
  },
}

export const Timeline: StoryObj = {
  name: "Scene timeline",
  render: () => {
    const [scenes, setScenes] = React.useState(SCENES)
    const [selected, setSelected] = React.useState(1)
    const [time, setTime] = React.useState(724)
    const total = scenes.reduce((a, s) => a + s.hold + s.transition, 0)
    return (
      <Panel width={720}>
        <SceneTimeline scenes={scenes} selected={selected} editable seekable time={time} height={150}
          curves={[{ label: "rate", values: RATE, scale: "log", series: 2 }, { label: "carrier", values: CARRIER, series: 1 }, { label: "offset", values: OFFSET, series: 3 }]}
          bed={{ label: "bed level", values: LEVEL, domain: [0, 0.6] }}
          onSelect={setSelected} onSeek={setTime} onChange={(e) => setScenes(e.scenes)} />
        <div className="ui-deltas">
          <span className="ui-control__name">Δ {selected} → {selected + 1}</span>
          {selected > 0 && <>
            <Delta name="rate" from={`${RATE[selected - 1]}`} to={`${RATE[selected]} Hz`} direction={RATE[selected] > RATE[selected - 1] ? "up" : "down"} />
            <Delta name="offset" from={`${OFFSET[selected - 1]}`} to={`${OFFSET[selected]} µs`} />
          </>}
        </div>
        <p className="ui-control__note">Tap a scene to select it; drag its left handle for the transition, its right for the hold. Total {Math.round(total / 60)} min.</p>
      </Panel>
    )
  },
}

export const Endings: StoryObj = {
  name: "Timeline · how each scene ended",
  render: () => (
    <Panel width={720}>
      <SceneTimeline scenes={SCENES} curves={[{ label: "rate", values: RATE, scale: "log", series: 2 }]}
        endings={["met", "timeout", "met", "no_data", "open_loop"]} height={130} />
    </Panel>
  ),
}

export const Lanes: StoryObj = {
  name: "Automation lanes",
  render: () => {
    const [rate, setRate] = React.useState(RATE)
    const [offset, setOffset] = React.useState(OFFSET)
    return (
      <Panel width={720}>
        <div>
          <div className="ui-lane__head"><span className="ui-control__name">rate</span><span className="ui-delta">Hz · log</span></div>
          <AutomationLane scenes={SCENES} values={rate} domain={[0.5, 45]} scale="log" unit="Hz" notches={[8, 40]} editable time={724}
            drawn={[{ t: 470, v: 7.5 }, { t: 520, v: 7.2 }, { t: 580, v: 7.4 }, { t: 640, v: 7 }]}
            onChange={(e) => setRate(e.values)} height={72} label="Rate" />
        </div>
        <div>
          <div className="ui-lane__head"><span className="ui-control__name">offset</span><span className="ui-delta">µs · linked to level, ratio 1 : −0.6</span></div>
          <AutomationLane scenes={SCENES} values={offset} domain={[-200, 200]} unit="µs" series={3} mark={-40} editable step={1}
            linked={{ label: "level", values: offset.map((v) => -0.6 * v) }} onChange={(e) => setOffset(e.values)} label="Offset" />
        </div>
      </Panel>
    )
  },
}

export const PannerStory: StoryObj = {
  name: "Polar panner",
  render: () => {
    const [pos, setPos] = React.useState({ azimuth: 60, distance: 1.6 })
    const [path, setPath] = React.useState<MotionPath>("orbit")
    const [on, setOn] = React.useState(true)
    const phase = 0.3
    return (
      <Panel width={300}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <span className="ui-control__name">Position</span>
          <span className="ui-pill">approximate</span>
          <Button size="sm" variant={on ? "default" : "outline"} aria-pressed={on} onClick={() => setOn(!on)} style={{ marginLeft: "auto" }}>spatial</Button>
        </div>
        <Panner {...pos} path={path} phase={phase} disabled={!on} onChange={setPos} label="Source position" />
        <div className="ui-seg" style={{ "--segments": 4 } as React.CSSProperties}>
          {(["static", "rock", "orbit", "lawnmower"] as const).map((p) => (
            <button key={p} type="button" className="ui-seg__btn" aria-pressed={path === p} onClick={() => setPath(p)}>{p}</button>
          ))}
        </div>
        <p className="ui-control__note">Arrow keys move it: left/right azimuth, up/down distance. Azimuth snaps to ahead, behind and the sides.</p>
      </Panel>
    )
  },
}

export const NowPanel: StoryObj = {
  name: "Glide readout + meters",
  render: () => {
    const t = 405
    const r = valueAt(SCENES, RATE, t)
    const o = valueAt(SCENES, OFFSET, t)
    return (
      <Panel width={420}>
        <span className="ui-control__name">now · gliding into scene 2 · {Math.round(r.progress * 100)} %</span>
        <Glide rows={[
          { name: "rate", span: "9.7 → 6.5 Hz", now: `${r.value.toFixed(1)} Hz`, progress: r.progress },
          { name: "offset", span: "−40 → +120 µs", now: `${o.value > 0 ? "+" : ""}${Math.round(o.value)} µs`, progress: o.progress },
          { name: "carrier", span: "500 Hz · held", now: "500 Hz", held: true },
        ]} />
        <Meter left={0.62} right={0.68} peakLeft={0.7} peakRight={0.74} />
      </Panel>
    )
  },
}

export const Mixer: StoryObj = {
  render: () => {
    const [m, setM] = React.useState({ a: false, b: false, bed: false })
    const [s, setS] = React.useState({ a: true, b: false, bed: false })
    return (
      <ChannelStrips>
        <ChannelStrip name="L · tone 1" focus muted={m.a} soloed={s.a} onMute={(v) => setM({ ...m, a: v })} onSolo={(v) => setS({ ...s, a: v })}>
          <Fader label="Tone 1 level" orientation="vertical" value={0.8} min={0} max={1.5} step={0.01} detents={[1]} showRange={false} />
        </ChannelStrip>
        <ChannelStrip name="L · tone 2" muted={m.b} soloed={s.b} onMute={(v) => setM({ ...m, b: v })} onSolo={(v) => setS({ ...s, b: v })}>
          <Fader label="Tone 2 level" orientation="vertical" value={0.35} min={0} max={1.5} step={0.01} detents={[1]} showRange={false} />
        </ChannelStrip>
        <ChannelStrip name="R · mirror" follows>
          <Fader label="Right level" orientation="vertical" value={0.8} min={0} max={1.5} step={0.01} showRange={false} disabled />
        </ChannelStrip>
        <ChannelStrip name="bed" muted={m.bed} soloed={s.bed} onMute={(v) => setM({ ...m, bed: v })} onSolo={(v) => setS({ ...s, bed: v })}>
          <Fader label="Bed level" orientation="vertical" value={0.4} min={0} max={0.6} step={0.01} showRange={false} />
        </ChannelStrip>
      </ChannelStrips>
    )
  },
}

export const Chips: StoryObj = {
  name: "Chips: sync, linked, delta",
  render: () => (
    <Panel width={520}>
      <div className="ui-deltas"><SyncPill state="saved" /><SyncPill state="saving" /><SyncPill state="offline">offline · 2 queued</SyncPill><SyncPill state="conflict" onClick={() => {}}>conflict ›</SyncPill></div>
      <div className="ui-deltas"><LinkedValue formula="mine × 0.97" resolved="9.41 Hz" onUnlink={() => {}} /><LinkedValue formula="my centre + 160 µs" resolved="+120 µs" /></div>
      <div className="ui-deltas"><Delta name="rate" from="9.7" to="6.5 Hz" direction="down" /><Delta name="offset" from="−40" to="+120 µs" direction="up" /><Delta name="bed" from=".30" to=".40" /></div>
    </Panel>
  ),
}

export const Experimental: StoryObj = {
  name: "Hazard + hold to confirm",
  render: () => {
    const [on, setOn] = React.useState(false)
    return (
      <Panel>
        <Hazard style={{ display: "flex", alignItems: "center", gap: 12, padding: 12 }}>
          <span style={{ flex: 1 }}>Nonlinear drive <span className="ui-delta">≤ 20 s</span></span>
          <HoldButton on={on} onChange={setOn}>{on ? "on" : "hold to arm"}</HoldButton>
        </Hazard>
        <p className="ui-control__note">Switching on needs a held press; switching off is a tap.</p>
      </Panel>
    )
  },
}

export const PhoneChrome: StoryObj = {
  name: "Bottom sheet + tab bar",
  render: () => (
    <div style={{ width: 390, border: "1px solid var(--border)", borderRadius: 24, overflow: "hidden" }}>
      <div style={{ padding: 16, minHeight: 200 }}>
        <Sheet>
          <SheetTrigger asChild><Button>Open the tone sheet</Button></SheetTrigger>
          <SheetContent side="bottom">
            <SheetHeader><SheetTitle>Tone 1 · left</SheetTitle></SheetHeader>
            <div style={{ padding: 16 }}><Fader label="Frequency" value={500} min={20} max={8000} scale="log" unit="Hz" digits={1} /></div>
          </SheetContent>
        </Sheet>
      </div>
      <TabBar items={[{ label: "Compose", current: true }, { label: "Space" }, { label: "Mix" }, { label: "Play" }]} />
    </div>
  ),
}

export const Night: StoryObj = {
  name: "Night view",
  render: () => {
    const [playing, setPlaying] = React.useState(true)
    return <NightView time="12:04" sub="−29:56 · scene 2 of 5" progress={0.29} playing={playing} onToggle={() => setPlaying(!playing)} hint="tap to pause" />
  },
}

export const OtherThemes: StoryObj = {
  name: "Fallback · instrument theme",
  globals: { theme: "light" },
  parameters: {
    docs: { description: { story: "Outside Polarize there are no audio inks: signal falls back to the brand colour, the human ink to plain ink. The dashed border still marks a linked value." } },
  },
  render: () => (
    <Panel width={720}>
      <Fader variant="ribbon" label="Interaural time" value={120} min={-660} max={660} step={1} unit="µs" digits={0} signed detents={[0]} mark={-40} markLabel="mine −40"
        adornment={<LinkedValue formula="my centre + 160 µs" />} />
      <div className="ui-deltas"><SyncPill state="saved" /><SyncPill state="saving" /><SyncPill state="offline" /><SyncPill state="conflict" /></div>
      <SceneTimeline scenes={SCENES} selected={1} editable time={724} curves={[{ label: "rate", values: RATE, scale: "log", series: 2 }]}
        endings={["met", "timeout", "met", "no_data", "open_loop"]} height={130} />
    </Panel>
  ),
}
