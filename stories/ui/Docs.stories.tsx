import type { Meta, StoryObj } from "@storybook/react-vite"
import * as React from "react"
import { Brand } from "@/components/publication"
import { Cta } from "@/components/landing"
import { CellField } from "@/components/cellfield"
import {
  ApiEntry, Callout, Chip, Chips, CodeWindow, DatasetCard, DocsPageHead, DocsSection, DocsShell, DocsThemeToggle,
  Example, ExampleFailed, HowTo, PkgCard, PkgCards, StatRow, type PlotSpec,
} from "@/components/docs"
import { linearFit, type Pair } from "@/science/stats/regression"

// The docs layer documenting polarize-ui ITSELF: its own public functions, run on SYNTHETIC
// data (a seeded line plus noise). Nothing here comes from a private repository or a recording.
const meta: Meta = { title: "General UI/Docs", parameters: { layout: "fullscreen" } }
export default meta

function seeded(seed: number) {
  let s = seed >>> 0
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32)
}
const rand = seeded(7)
const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(2 * Math.PI * rand())
const points: Pair[] = Array.from({ length: 40 }, (_, i) => { const x = i / 4; return [x, 0.8 * x + 1.5 + gauss() * 0.9] })
const fit = linearFit(points)

const exampleCode = `import { linearFit } from "@polarizetech/polarize-ui/react"

// 40 synthetic points: y = 0.8x + 1.5 plus unit-ish Gaussian noise (seeded)
const fit = linearFit(points)          // 95% intervals by default
fit.slope, fit.slopeCI, fit.r2, fit.p`

const inputPlot: PlotSpec = {
  type: "line", title: "Input: 40 synthetic points (seed 7)", xlabel: "x", ylabel: "y",
  series: [{ name: "y", x: points.map((p) => p[0]), y: points.map((p) => p[1]) }],
}
const outputPlots: PlotSpec[] = [
  {
    type: "line", title: "Points and the fitted line, over the measured range only", xlabel: "x", ylabel: "y",
    series: [
      { name: "points", x: points.map((p) => p[0]), y: points.map((p) => p[1]) },
      { name: "fit", x: [fit.xRange[0], fit.xRange[1]], y: [fit.intercept + fit.slope * fit.xRange[0], fit.intercept + fit.slope * fit.xRange[1]] },
    ],
  },
  {
    type: "table", title: "linearFit(points)", columns: ["field", "value"],
    rows: [
      ["slope", fit.slope.toFixed(4)], ["95% CI", `${fit.slopeCI[0].toFixed(3)} – ${fit.slopeCI[1].toFixed(3)}`],
      ["intercept", fit.intercept.toFixed(4)], ["r²", fit.r2.toFixed(4)], ["p", fit.p.toExponential(2)], ["n", String(fit.n)],
    ],
    caption: "Synthetic: the true slope is 0.8, so the interval should contain it.",
  },
  {
    type: "verdicts", title: "Checks a story can report (the word is always shown)",
    items: [
      { key: "true slope in 95% CI", verdict: fit.slopeCI[0] <= 0.8 && 0.8 <= fit.slopeCI[1] ? "pass" : "fail", reason: "0.8 against the printed interval" },
      { key: "slope ≠ 0", verdict: fit.p < 0.05 ? "pass" : "fail", meta: `p = ${fit.p.toExponential(2)}`, reason: "two-sided t test, df = n − 2" },
      { key: "extrapolation", verdict: "skipped", reason: "the line is drawn over the measured x range only" },
    ],
  },
]

function Page({ dark, setDark }: { dark: boolean; setDark: (d: boolean) => void }) {
  return (
    <DocsShell
      brand={<Brand word="polarize-ui" href="#" />}
      nav={[
        { title: "Introduction", items: [{ label: "Overview", href: "#" }, { label: "Datasets", href: "#datasets" }] },
        { title: "Science", items: [
          { label: "Statistics", href: "#", current: true, meta: "3" },
          { label: "Signals", href: "#", meta: "4" },
          { label: "Evidence", href: "#", meta: "4" },
        ] },
      ]}
      toc={[
        { label: "Overview", href: "#overview" }, { label: "Examples", href: "#examples" },
        { label: "Fit a line to noisy data", href: "#ex-linearfit", sub: true },
        { label: "API reference", href: "#api" }, { label: "Datasets", href: "#datasets" },
      ]}
      actions={<DocsThemeToggle dark={dark} onToggle={() => setDark(!dark)} />}
    >
      <DocsPageHead eyebrow="Statistics" title="linearFit" lead="Least-squares line with its intervals printed, fitted only over the measured range." />
      <Chips>
        <Chip label="since"><code>0.5.8</code></Chip>
        <Chip label="import"><code>@polarizetech/polarize-ui/react</code></Chip>
        <Chip label="depends on"><code>nothing</code></Chip>
      </Chips>
      <CodeWindow name="Install" lang="bash" code={`npm install github:polarizetech/polarize-ui#v0.5.12`} />
      <div style={{ height: 22 }} />
      <Callout tone="warn" label="Claim boundary">
        <p>A fitted slope describes these points. It says nothing about a range the data did not cover, so the line is never drawn past it.</p>
      </Callout>
      <DocsSection id="overview" title="Overview">
        <div className="ui-docsite__prose">
          <p>An example is one <strong>real call</strong> on one dataset. The code shown is the code that ran, and the output was computed from it. A broken example stays on the page, labelled.</p>
        </div>
      </DocsSection>
      <DocsSection id="examples" title="Examples" lead="The code is the example itself; the output was computed from it.">
        <Example
          id="ex-linearfit" title="Fit a line to noisy data"
          summary="Forty synthetic points around y = 0.8x + 1.5. The interval should contain the true slope."
          meta={<><Chip dot href="#datasets" licence="CC0">Synthetic, seed 7</Chip><Chip href="#api-linearfit"><code>linearFit</code></Chip></>}
          code={exampleCode} codeName="examples/linear-fit.ts" codeLang="ts"
          tabs={[{ id: "output", label: "Output", plots: outputPlots }, { id: "input", label: "Input", plots: [inputPlot] }]}
          facts={[["slope", fit.slope.toFixed(3)], ["95% CI", `${fit.slopeCI[0].toFixed(2)}–${fit.slopeCI[1].toFixed(2)}`], ["r²", fit.r2.toFixed(3)], ["n", String(fit.n)]]}
          foot="Computed in the browser from the seeded points. Synthetic data carries no MEASURED badge; an example on real data passes a Tier as badge."
        />
        <ExampleFailed title="An example that raised" error="ValueError: level must be in (0, 1)" trace={"linearFit(points, 1.2)\n  → linearFit: level must be in (0, 1)"} />
      </DocsSection>
      <DocsSection id="api" title="API reference">
        <ApiEntry id="api-linearfit" name="linearFit" signature="linearFit(points: Pair[], level = 0.95): LinearFit"
          summary={<p>Least-squares fit with slope standard error, a two-sided t test and intervals at <code>level</code>.</p>}
          source="https://github.com/polarizetech/polarize-ui/blob/main/src/science/stats/regression.ts" />
        <ApiEntry kind="type" name="LinearFit" signature={"type LinearFit\n    n: number\n    slope: number\n    slopeCI: [number, number]\n    r2: number\n    p: number"} />
      </DocsSection>
      <DocsSection id="datasets" title="Datasets">
        <DatasetCard title="MIT-BIH Arrhythmia Database" licence="ODC-By 1.0" provider="PhysioNet" providerHref="https://physionet.org/content/mitdb/1.0.0/"
          version="1.0.0" modality="ECG, 2 leads, 360 Hz" doi="10.13026/C2F305"
          why="How a real, licensed dataset is presented: licence, version and citation next to the data."
          cite="Moody GB, Mark RG. The impact of the MIT-BIH Arrhythmia Database. IEEE Eng Med Biol 20(3):45–50 (2001)." />
      </DocsSection>
    </DocsShell>
  )
}

export const ReferencePage: StoryObj = {
  render: () => {
    const [dark, setDark] = React.useState(document.documentElement.classList.contains("dark"))
    React.useEffect(() => { document.documentElement.classList.toggle("dark", dark) }, [dark])
    return <Page dark={dark} setDark={setDark} />
  },
}

export const HomePage: StoryObj = {
  render: () => (
    <DocsShell brand={<Brand word="polarize-ui" href="#" />} wide
      nav={[{ title: "Introduction", items: [{ label: "Overview", href: "#", current: true }] },
            { title: "Packages", items: [{ label: "science", href: "#", meta: "0.5" }, { label: "landing", href: "#", meta: "0.5" }] }]}>
      <section className="ui-docsite__hero ui-cellfield-host" id="docs-hero">
        <CellField hero="#docs-hero" density={0.6} intensity={0.8} />
        <div>
          <p className="ui-docsite__kicker">polarize-ui · docs layer</p>
          <h1 className="ui-display ui-display--1 ui-docsite__hero-title">One core, and layers that each add one job.</h1>
          <p className="ui-docsite__hero-lead">A reference generated from the code, with every example run on public or synthetic data.</p>
          <div className="ui-docsite__hero-actions"><Cta href="#" solid>Read the core</Cta><Cta href="#" icon>Write an extension</Cta></div>
        </div>
        <CodeWindow name="python" copy={false} code={`from mylib.extensions import discover\n\nfor ext in discover():\n    print(ext["name"], ext["version"], ext["status"])`}
          output={"plotting      0.3.1   ok\nio-readers    0.2.0   ok\nremote-thing  —       not installed"}
          note="Captured when the site was built (an example of the pattern; names are placeholders)." />
      </section>
      <StatRow items={[[3, "packages"], [21, "modules"], [148, "public functions"], ["9/9", "examples passing"]]} />
      <DocsSection title="Packages" lead="Each is versioned on its own.">
        <PkgCards>
          <PkgCard href="#" version="0.3.1" title="plotting" desc="Draws what the core measures." footStart="2 examples" footEnd="in repo" />
          <PkgCard href="#" version="0.2.0" title="io-readers" desc="Reads files into plain arrays." footStart="1 example" footEnd="in repo" />
          <PkgCard href="#" version="0.1.0" title="remote-thing" desc="Catalogued here, lives in another repository." footStart="0 examples" footEnd="↗ other-repo" />
        </PkgCards>
      </DocsSection>
      <DocsSection title="How this site is made">
        <HowTo items={[["1 · Catalogue", "A list of packages; a new entry is a new page."], ["2 · Code", "Signatures and docstrings read from source."],
                       ["3 · Examples", "Real calls, run at build time."], ["4 · Data", "Licence and citation travel with each dataset."]]} />
      </DocsSection>
    </DocsShell>
  ),
}
