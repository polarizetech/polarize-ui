import type { Meta, StoryObj } from "@storybook/react-vite"
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
