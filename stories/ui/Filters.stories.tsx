import type { Meta, StoryObj } from "@storybook/react-vite"
import * as React from "react"
import {
  BucketHistogram, CheckToggle, Facet, FilterChips, FilterPanel, FilterSearch, FilterSection,
  ResultsEmpty, ResultsHead, Segmented, TierToggles, useFilter, type FilterItem,
} from "@/components/filter"
import { Badges, Footer, Brand, PostList, Shell, SidebarMeta, type PostSummary } from "@/components/publication"
import { Button } from "@/components/ui/button"

const meta: Meta = {
  title: "General UI/Filters",
  parameters: {
    docs: {
      description: {
        component:
          "Controls for narrowing a set of results, and the panel that groups them. Each one is a real button with aria-pressed, prints the count it would leave, and can be used alone. Every record here is a placeholder.",
      },
    },
  },
}
export default meta

const box = (children: React.ReactNode) => <div className="max-w-[22rem]">{children}</div>

export const FacetList: StoryObj = {
  name: "Facet (pick one, with counts)",
  render: () => {
    const [v, setV] = React.useState("all")
    return box(
      <Facet label="Topics" value={v} onChange={setV} total={16} options={[
        { key: "all", label: "All posts", count: 16 },
        { key: "aep", label: "Audio-evoked potentials", count: 4 },
        { key: "method", label: "Method", count: 7 },
        { key: "translation", label: "Biosignal translation", count: 1 },
        { key: "empty", label: "A topic with nothing in it", count: 0 },
      ]} />,
    )
  },
}

export const TierToggleRow: StoryObj = {
  name: "Tier toggles (pick any)",
  render: () => {
    const [v, setV] = React.useState<string[]>(["A"])
    return box(<TierToggles value={v} onChange={setV} tiers={[{ id: "A", count: 7 }, { id: "B", count: 0 }, { id: "C", count: 8 }, { id: "SPEC", count: 1 }]} />)
  },
}

export const Check: StoryObj = {
  name: "Check toggle (one yes/no)",
  render: () => {
    const [on, setOn] = React.useState(false)
    return box(<CheckToggle label="Cites sources" count={8} pressed={on} onPressedChange={setOn} />)
  },
}

export const Histogram: StoryObj = {
  name: "Bucket histogram (months)",
  render: () => {
    const [v, setV] = React.useState<string | null>("2026-09")
    return box(
      <BucketHistogram noun="notes" value={v} onChange={setV} buckets={[
        { key: "2026-07", label: "Jul", name: "July 2026", count: 1 },
        { key: "2026-08", label: "Aug", name: "August 2026", count: 4 },
        { key: "2026-09", label: "Sep", name: "September 2026", count: 11 },
      ]} />,
    )
  },
}

export const SegmentedControl: StoryObj = {
  name: "Segmented control (one of a few)",
  render: () => {
    const [v, setV] = React.useState<"new" | "src">("new")
    return box(<Segmented label="Sort order" value={v} onChange={setV} options={[{ key: "new", label: "Newest" }, { key: "src", label: "Most sources" }]} />)
  },
}

export const Search: StoryObj = {
  name: "Search field",
  render: () => {
    const [q, setQ] = React.useState("")
    return box(<FilterSearch label="Search notes" placeholder="Search titles and summaries" value={q} onChange={setQ} />)
  },
}

export const ChipsRow: StoryObj = {
  name: "Results header with removable chips",
  render: () => {
    const [chips, setChips] = React.useState(["Method", "Tier A", "Sep 2026"])
    return (
      <ResultsHead heading={chips.length ? "Filtered research notes" : "Latest research notes"}>
        <FilterChips onClear={() => setChips([])} chips={chips.map((c) => ({ label: c, onRemove: () => setChips(chips.filter((x) => x !== c)) }))} />
      </ResultsHead>
    )
  },
}

export const Empty: StoryObj = {
  name: "Empty state",
  render: () => (
    <ResultsEmpty title="No notes match every filter." action={<Button variant="outline">Clear filters</Button>}>
      Filters combine with AND across groups. Remove one of the chips above, or clear them all.
    </ResultsEmpty>
  ),
}

/* ---------- The whole pattern: a post index with a filter panel ---------- */

type Row = PostSummary & FilterItem & { tierId: "A" | "B" | "C" | "SPEC" }
const TOPICS = [
  { key: "aep", label: "Audio-evoked potentials" },
  { key: "method", label: "Method" },
  { key: "translation", label: "Biosignal translation" },
]
const row = (i: number, topic: string, tierId: Row["tierId"], date: string, sources: number): Row => ({
  href: "#", date, title: `Placeholder note ${i}`,
  description: "An example description, one or two sentences long, sitting under the title at a readable measure.",
  topic, tier: tierId, tierId, month: date.slice(0, 7), sources, text: `Placeholder note ${i} ${topic}`,
})
const ROWS: Row[] = [
  row(1, "method", "A", "2026-09-28", 0), row(2, "method", "A", "2026-09-21", 3), row(3, "aep", "C", "2026-09-14", 6),
  row(4, "aep", "A", "2026-09-02", 2), row(5, "translation", "C", "2026-08-25", 0), row(6, "method", "SPEC", "2026-08-11", 0),
  row(7, "aep", "C", "2026-08-03", 9), row(8, "method", "C", "2026-07-19", 1),
]
const MONTHS = [
  { key: "2026-07", label: "Jul", name: "July 2026" },
  { key: "2026-08", label: "Aug", name: "August 2026" },
  { key: "2026-09", label: "Sep", name: "September 2026" },
]

function FilteredIndex() {
  const f = useFilter(ROWS)
  const { state, set, counts } = f
  const topicLabel = TOPICS.find((t) => t.key === state.topic)?.label
  const monthMax = Math.max(...MONTHS.map((m) => ROWS.filter((r) => r.month === m.key).length))
  const chips = [
    ...(topicLabel ? [{ label: topicLabel, onRemove: () => set({ topic: "all" }) }] : []),
    ...state.tiers.map((t) => ({ label: `Tier ${t}`, onRemove: () => set({ tiers: state.tiers.filter((x) => x !== t) }) })),
    ...(state.month ? [{ label: MONTHS.find((m) => m.key === state.month)!.name, onRemove: () => set({ month: null }) }] : []),
    ...(state.cited ? [{ label: "Cites sources", onRemove: () => set({ cited: false }) }] : []),
    ...(state.query.trim() ? [{ label: `“${state.query.trim()}”`, onRemove: () => set({ query: "" }) }] : []),
  ]
  const panel = (
    <FilterPanel shown={f.shown.length} total={f.total} noun="notes" footer={<><SidebarMeta feed="#" github="#" /><span className="ui-filter__foot-spacer" /></>}>
      <FilterSearch label="Search notes" placeholder="Search titles and summaries" value={state.query} onChange={(query) => set({ query })} />
      <FilterSection label="Topic">
        <Facet label="Topics" total={f.total} value={state.topic} onChange={(topic) => set({ topic })}
          options={[{ key: "all", label: "All posts", count: counts.topic("all") }, ...TOPICS.map((t) => ({ ...t, count: counts.topic(t.key) }))]} />
      </FilterSection>
      <FilterSection label="Confidence tier" hint="any of" note="A tier is computed from the evidence behind a note, never chosen for it.">
        <TierToggles value={state.tiers} onChange={(tiers) => set({ tiers })}
          tiers={(["A", "C", "SPEC"] as const).map((id) => ({ id, count: counts.tier(id) }))} />
      </FilterSection>
      <FilterSection label="Evidence">
        <CheckToggle label="Cites sources" count={counts.cited()} pressed={state.cited} onPressedChange={(cited) => set({ cited })} />
      </FilterSection>
      <FilterSection label="Published" hint="2026">
        <BucketHistogram noun="notes" max={monthMax} value={state.month} onChange={(month) => set({ month })}
          buckets={MONTHS.map((m) => ({ ...m, count: counts.month(m.key) }))} />
      </FilterSection>
      <FilterSection label="Order">
        <Segmented label="Sort order" value={state.sort} onChange={(sort) => set({ sort })}
          options={[{ key: "new", label: "Newest" }, { key: "src", label: "Most sources" }]} />
      </FilterSection>
    </FilterPanel>
  )
  return (
    <>
      <Shell variant="filter" brand={<Brand word="Polarize" />} sidebar={panel}>
        <ResultsHead heading={f.filtered ? "Filtered research notes" : "Latest research notes"}>
          <FilterChips chips={chips} onClear={f.reset} />
        </ResultsHead>
        {f.shown.length > 0
          ? <PostList posts={f.shown.map((r) => ({ ...r, badges: <Badges tier={r.tierId} items={[{ label: TOPICS.find((t) => t.key === r.topic)!.label }, ...(r.sources ? [{ label: `${r.sources} src` }] : [])]} /> }))} />
          : <ResultsEmpty title="No notes match every filter." action={<Button variant="outline" onClick={f.reset}>Clear filters</Button>}>
              Filters combine with AND across groups. Remove one of the chips above, or clear them all.
            </ResultsEmpty>}
      </Shell>
      <Footer brand={<Brand word="Polarize" />} tagline="Reading and writing the body electric">Placeholder fine print for the footer.</Footer>
    </>
  )
}

export const PostIndexWithFilters: StoryObj = {
  name: "Pattern: post index with filters",
  parameters: { layout: "fullscreen" },
  render: () => <FilteredIndex />,
}
