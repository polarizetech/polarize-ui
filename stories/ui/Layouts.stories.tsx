import type { Meta, StoryObj } from "@storybook/react-vite"
import { Play } from "lucide-react"
import { Navbar, NavbarLink } from "@/components/navbar"
import { ColorStrip, Disclosure, EventCard, Events, Key, Kpi, Kpis, PCell, Panel, Panels } from "@/components/dashboard"
import {
  Article, AuthorNote, Badges, Brand, Cite, Claims, Footer, Pager, Parts, PostList, Prose,
  References, Shell, SidebarMeta, SidebarSection, Source, Summary, type PostSummary,
} from "@/components/publication"

// Every record below is a PLACEHOLDER for layout only. In a real site these come from the
// citation ledger and the claims register, never typed by hand.
const posts: PostSummary[] = [
  {
    href: "#", date: "25 Sep 2026", title: "What a $70 amplifier can and cannot hear",
    description: "An example description, one or two sentences long, sitting under the title at a readable measure.",
    badges: <Badges tier="B" items={[{ label: "Audio-evoked potentials" }]} />,
  },
  {
    href: "#", date: "12 Sep 2026", title: "A spiking network built to lose",
    description: "Placeholder text for a second row without a thumbnail.",
    badges: <Badges tier="C" items={[{ label: "Method" }]} />,
  },
  {
    href: "#", date: "30 Aug 2026", title: "A closed door is not a closed question",
    badges: <Badges tier="SPEC" items={[{ label: "Method" }]} />,
  },
]

const sidebar = (
  <>
    <AuthorNote
      tagline="Reading and writing the body electric"
      name="Author Name"
      place="City, Region"
      note="A short author note. Deliberately quiet: small, muted, below the fold of attention."
      contactHref="#"
    />
    <SidebarSection heading="Topics" items={[
      { label: "Audio-evoked potentials", href: "#", count: 6, current: true },
      { label: "Biosignal translation", href: "#", count: 4 },
      { label: "Method", href: "#", count: 3 },
    ]} />
    <SidebarMeta feed="#" github="#" />
  </>
)

const meta: Meta = { title: "General UI/Layouts", parameters: { layout: "fullscreen" } }
export default meta

export const SiteShell: StoryObj = {
  name: "Site shell + post list",
  render: () => (
    <>
      <Shell brand={<Brand word="Polarize" />} sidebar={sidebar}>
        <p className="ui-label ui-main__heading">Latest</p>
        <PostList posts={posts} />
        <Pager next="#" page={1} total={3} />
      </Shell>
      <Footer brand={<Brand word="Polarize" />} tagline="Reading and writing the body electric">
        Placeholder fine print for the footer.
      </Footer>
    </>
  ),
}

export const SingleColumn: StoryObj = {
  name: "Single column (no sidebar, centred)",
  render: () => (
    <>
      <Shell variant="single" brand={<Brand word="Polarize" />}>
        <p className="ui-label ui-main__heading">Latest</p>
        <PostList posts={posts} />
      </Shell>
      <Footer brand={<Brand word="Polarize" />} tagline="Reading and writing the body electric">
        Placeholder fine print for the footer.
      </Footer>
    </>
  ),
}

export const ArticlePage: StoryObj = {
  name: "Article",
  parameters: { layout: "padded" },
  render: () => (
    <Article
      label="Audio-evoked potentials · 25 Sep 2026"
      title="What a $70 amplifier can and cannot hear"
      standfirst="One sentence saying what the article is for."
      meta={<Badges tier="B" items={[{ label: "Audio-evoked potentials", href: "#" }]} />}
    >
      <Summary>
        <p>An example summary: the finding in two sentences, before any of the argument.</p>
      </Summary>
      <Prose>
        <h2>A section heading</h2>
        <p>
          Running prose in the article measure. A citation marker sits in the text<Cite n={1} href="#ref-example2024" />
          and the source card below sits at the point the source is used.
        </p>
      </Prose>
      <Source record={{
        title: "An example source title, as the ledger records it",
        meta: "Example & Author · 2024 · Example Journal",
        href: "#",
        note: "Why this source is used here, in one sentence.",
        fullTextRead: true,
      }} />
      <Source record={null} />
      <Prose>
        <p>A parts grid, for hardware:</p>
      </Prose>
      <Parts items={[
        { name: "Example board", role: "Amplifier", meta: "$70", href: "#" },
        { name: "Example cable", role: "Electrode lead", meta: "$12", href: "#" },
        { name: "Example electrodes", role: "Ag/AgCl, single use", meta: "$18", href: "#" },
      ]} />
      <Claims items={[
        { id: "EX-0001", tier: "B", statement: "An example claim statement, copied from the claims register." },
        { id: "EX-0002", tier: "SPEC", statement: "A speculative claim, flagged as such." },
        { id: "EX-0003", tier: "C", statement: null },
      ]} />
      <References
        items={[{
          key: "example2024", authors: "Example, A., & Author, B.", year: "2024",
          title: "An example reference title", journal: "Example Journal", doi: "10.0000/example",
          fullTextRead: true, why: "What this reference is used for in the article.",
        }]}
        note={<>Every field above is machine-copied from the ledger; the key is <code>example2024</code>.</>}
      />
    </Article>
  ),
}

export const NavbarAutohide: StoryObj = {
  name: "Navbar (hides on scroll down)",
  render: () => (
    <>
      <Navbar
        brand="Field notes"
        version="v1"
        items={<><NavbarLink href="#a" current>Colour</NavbarLink><NavbarLink href="#b">Structure</NavbarLink><NavbarLink href="#c">Tests</NavbarLink></>}
        wide={<span className="ui-label">8.9 / 64.0 s</span>}
        actions={<button type="button" className="ui-btn ui-btn--primary" aria-label="Play"><Play size={14} aria-hidden /></button>}
      />
      <div className="ui-wrap">
        <p className="ui-lede">Scroll down: the bar slides up out of view. Scroll up and it slides back. At the top it is always shown. Below 768px the links fold into a menu and the readout is hidden.</p>
        {Array.from({ length: 24 }, (_, i) => <p key={i}>Paragraph {i + 1}. Placeholder text so the page is long enough to scroll.</p>)}
      </div>
    </>
  ),
}

const wave = (f: number, a: number) => Array.from({ length: 120 }, (_, i) => 30 - a * Math.sin(i / f) * Math.exp(-((i - 60) ** 2) / 900))
const path = (z: number[]) => z.map((y, i) => `${i ? "L" : "M"}${(i / 119) * 200},${y.toFixed(1)}`).join("")

// Every number below is a PLACEHOLDER for layout only.
export const DashboardFrames: StoryObj = {
  name: "Dashboard frames (KPIs, panels, strip, events, p-table)",
  render: () => (
    <div className="ui-wrap" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      <Kpis>
        <Kpi label="Noise colour" value={<>brown<small>exponent 2.01</small></>} note="Window 5.0–9.0 s" />
        <Kpi label="Battery verdict" value={<>Structured<small>2 of 3 windows</small></>} note={<span className="ui-tier" data-family="exploring"><span className="ui-tier__glyph">●</span>EXPLORATORY</span>} />
        <Kpi label="Episodes" value={<><span className="ui-measured">3</span><small>recording</small> · <span className="ui-predicted">1</span><small>twin</small></>} note="No group has enough episodes to test" />
      </Kpis>
      <ColorStrip legend={[{ label: "violet", swatch: "var(--series-1, #3987e5)", note: "−2" }, { label: "white", swatch: "var(--surface-2)", note: "0" }, { label: "brown", swatch: "var(--series-2, #d95926)", note: "2" }]}
        now="Now (8.9 s): brown, exponent 2.01.">
        <svg className="ui-strip__well" viewBox="0 0 960 40" preserveAspectRatio="none" height="40" role="img" aria-label="Colour by window">
          {Array.from({ length: 48 }, (_, i) => <rect key={i} x={i * 20} width={19} height={40} fill="var(--series-2, #d95926)" />)}
        </svg>
      </ColorStrip>
      <Panels keys={<><Key>recording</Key><Key kind="dash">twin</Key><Key kind="fill">episode</Key></>}>
        <Panel title="Raw" sub="counts"><svg viewBox="0 0 200 60" preserveAspectRatio="none" height="90"><path d={path(wave(2, 24))} fill="none" stroke="currentColor" vectorEffect="non-scaling-stroke" /></svg></Panel>
        <Panel title="Departures z" sub="floor SDs"><svg viewBox="0 0 200 60" preserveAspectRatio="none" height="90"><path d={path(wave(1.2, 20))} fill="none" stroke="currentColor" vectorEffect="non-scaling-stroke" /></svg></Panel>
      </Panels>
      <Events>
        <EventCard title="burst" badge={<span className="ui-tier" data-family="exploring"><span className="ui-tier__glyph">●</span>EXPLORATORY</span>}
          trace={<svg className="ui-event__trace" viewBox="0 0 200 60" preserveAspectRatio="none"><line className="axis" x1="0" x2="200" y1="30" y2="30" /><path d={path(wave(3, 22))} /></svg>}
          rows={[["When", "9.9–14.5 s"], ["Length", "4.6 s"], ["Group", "1 vs 0 twin · too few to test"]]} hit />
        <EventCard title="swell" rows={[["When", "21.5–26.6 s"], ["Length", "5.1 s"]]} onClick={() => undefined} />
      </Events>
      <div className="ui-scroll-x">
        <table className="ui-table"><thead><tr><th>Statistic</th><th>Window 1</th><th>Window 2</th></tr></thead>
          <tbody><tr><td>excess kurtosis</td><PCell p={0.025} /><PCell p={0.4} /></tr><tr><td>irreversibility</td><PCell p={0.15} /><PCell p={0.04} /></tr></tbody></table>
      </div>
      <Disclosure label="How the tests work"><p>Each cell is a rank p-value among surrogates of the same window. Outlined cells are rejected at 0.05.</p></Disclosure>
    </div>
  ),
}
