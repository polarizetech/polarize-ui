import type { Meta, StoryObj } from "@storybook/react-vite"
import { Brand } from "@/components/publication"
import {
  ArticleCard, ChangeFeed, Cta, FeaturedArticle, Hero, MetaLine, Principle, ProcessSteps, ProjectFeature,
  Promises, RepoCard, Section, SiteFooter, StoryCard, StoryRow, TierLegend, TopNav,
} from "@/components/landing"
import { CellField } from "@/components/cellfield"
import { Tier } from "@/science/evidence/tier"

// Real content from polarize.tech, for layout. Images are served from the live site.
const IMG = "https://polarize.tech/assets"

const meta: Meta = { title: "General UI/Landing", parameters: { layout: "fullscreen" } }
export default meta

const nav = (
  <TopNav
    brand={<Brand word="Polarize" />}
    links={[
      { label: "Process", href: "#process" },
      { label: "Projects", href: "#projects" },
      { label: "Findings", href: "#findings" },
      { label: "Speculations", href: "#speculations" },
      { label: "Changelog", href: "#changelog" },
    ]}
    actions={<Cta href="#contact" solid>Get in touch</Cta>}
  />
)

const hero = (
  <Hero
    id="hero"
    title={<>Reading and writing the <em>body electric.</em></>}
    lede="An independent research lab building open instruments and software for bioelectric sensing — and publishing what they find, including when the answer is no."
    actions={<><Cta href="#process" icon>Our process</Cta><Cta href="#contact" solid>Get in touch</Cta></>}
  />
)

const process = (
  <Section id="process" eyebrow="Process" title="Built to show where we were wrong."
    lede="Every study borrows the discipline of a clinical trial: the inputs and the predictions are preregistered before anything runs, so a result can fail in public and stay on the record.">
    <ProcessSteps steps={[
      { num: "01", stage: "Before anything runs", repo: "adaptive-preregistration", version: "v0.1.1", title: "Predict first, then run the code.",
        body: "Predictions and pass criteria are tagged in git before the code runs. Every later change is dated and can't turn a fail into a pass.",
        files: ["PREREG.md", "DEVIATIONS.md", "RESULTS.md"], latest: { date: "Sep 25", text: "ARCHIVING.md: when to use OSF, Zenodo, both or neither" },
        read: "Read the method →", href: "#" },
      { num: "02", stage: "How a study is laid out", repo: "scientific-research-scaffold", title: "One question per study, and a check that it's kept.",
        body: "A protocol for studies and simulators across repositories, and a CLI that scaffolds and checks them.",
        files: ["STUDY.toml", "apps/vN-*", "scaffold check"], latest: { date: "Sep 25", text: "The study protocol, templates, and the scaffold CLI" },
        read: "Protocol →", href: "#" },
      { num: "03", stage: "What the literature says", repo: "retrieval-augmented-generation", title: "Evidence first, so the model can't make it up.",
        body: "Code controls search, evidence and verification; claims that fail a check are removed and counted, not softened.",
        files: ["answer.md", "run.json"], latest: { date: "Sep 27", text: "Present null-search results by what they show" },
        read: "Read the method →", href: "#" },
    ]} />
    <Promises items={[
      { title: "Failures stay on the record", text: "A prediction that fails is reported as a fail." },
      { title: "Every change to a plan is dated", text: "Each change says whether the result was already known." },
      { title: "No claim without its source", text: "Every claim cites a verbatim passage." },
    ]} />
  </Section>
)

const projects = (
  <Section id="projects" eyebrow="Projects" title="What we're building, in the open." stack
    lede="Every project is a public repository — its plans, code and raw outputs.">
    <ProjectFeature href="#" repo="neural-memory" meta={["model-v0.3.0", "Python"]}
      question="Can a network of neurons hold on to a sound?"
      description="Falsification benches for how a memory of a sound could be held in neural tissue."
      finding={{ tier: <Tier id="SPEC" />, text: "Sound went in readably. Nothing came back out.", read: "Read: A spiking network built to lose →" }}
      changes={[{ date: "Sep 25", num: "#8", title: "singlecell: labile recycling factor switches" }, { date: "Sep 25", num: "#7", title: "model-v0.3.0: single-cell habituation (Stentor)" }]}
      plate={{ src: `${IMG}/schematics/vicq-dazyr-brain-1798.jpg`, alt: "The brain in section, 1798.", caption: "The brain in section, after Vicq-d'Azyr, 1798 · Public domain" }} />
    <ProjectFeature href="#" repo="olimex-shield" meta={["v0.2.0", "Hardware"]} flip
      question="What can a $70 amplifier actually hear?"
      finding={{ tier: <Tier id="C" />, text: "In-band 40 Hz power across six captures.", read: "Read: Can a $70 board tell me I'm wrong? →" }}
      plate={{ src: `${IMG}/schematics/galvani-frog-1792.jpg`, alt: "Galvani's frog legs on a metal arc, 1792.", caption: "Luigi Galvani, 1792 · Public domain" }} />
    <div style={{ marginTop: 24 }} className="ui-repocards">
      <RepoCard href="#" name="paper-fetch" pitch="Every source, fetched legally and traced." description="Search, legal full-text fetch, provenance, and an MCP server." latest={{ date: "Sep 25", text: "Initial release of paperlib" }} />
    </div>
  </Section>
)

const changelog = (
  <Section id="changelog">
    <div className="ui-split">
      <div className="ui-section__titles">
        <p className="ui-section__eyebrow">Changelog</p>
        <h2 className="ui-section__title">Recently merged.</h2>
      </div>
      <ChangeFeed items={[
        { date: "Sep 25", repo: "neural-memory", kind: "PR #8", title: "singlecell: labile recycling factor and k_deg_scale switches", href: "#" },
        { date: "Sep 25", repo: "neural-memory", kind: "PR #7", title: "model-v0.3.0: single-cell habituation (Stentor) in a peer-reviewed simulator", href: "#" },
        { date: "Sep 25", repo: "neural-memory", kind: "PR #3", title: "Findings, pre-release review, lint and MIT licence", href: "#" },
      ]} />
    </div>
  </Section>
)

const findings = (
  <Section id="findings" eyebrow="Findings" title="What the work turned up." action={<Cta href="#">All articles →</Cta>}>
    <FeaturedArticle href="#" image={{ src: `${IMG}/posts/golgi-pyramidal-neuron.jpg`, alt: "A Golgi-stained pyramidal neuron.", caption: "Photograph: MethoxyRoxy", photo: true }}
      meta={<MetaLine tier={<Tier id="SPEC" />}>Sep 25 · Audio-evoked potentials</MetaLine>}
      title="A spiking network built to lose: what it would and would not remember"
      summary="In simulation, synaptic depletion never kept a sound-specific memory, and only plasticity gated by the receiving cell did."
      from="from neural-memory" />
    <div className="ui-cards">
      <ArticleCard href="#" image={{ src: `${IMG}/posts/darwin-notebook-b-tree.jpg`, alt: "Darwin's 1837 notebook tree.", photo: true }}
        meta={<MetaLine tier={<Tier id="A" />}>Sep 24 · Method</MetaLine>} title="Adaptive preregistration: predict first, then run the code"
        description="Predictions, pass criteria and environment fixed in git before anything a report will cite is allowed to run." credit="Charles Darwin, Notebook B (1837) · Public domain" />
      <ArticleCard href="#" pull="The model is used for bounded transformations, while code controls search, evidence, verification, abstention and the run log."
        meta={<MetaLine tier={<Tier id="A" />}>Sep 24 · Method</MetaLine>} title="A RAG tool that keeps the model in check" />
      <ArticleCard href="#" image={{ src: `${IMG}/posts/european-green-crab.jpg`, alt: "A European green crab on wet sand.", photo: true }}
        meta={<MetaLine tier={<Tier id="C" />}>Sep 16 · Invasive species</MetaLine>} title="Twelve ways to catch a green crab" credit="Photograph: Victor Heng" />
    </div>
  </Section>
)

const speculations = (
  <Section id="speculations">
    <StoryRow intro={<>
      <div className="ui-section__titles">
        <p className="ui-section__eyebrow">Speculations</p>
        <h2 className="ui-section__title">Thinking out loud.</h2>
        <p className="ui-storyrow__lede">Short dictated pieces — hunches the projects are trying to test, or trying to kill.</p>
      </div>
      <Cta href="#">All speculations →</Cta>
    </>}>
      <StoryCard href="#" when="Sep 25, 2026" badge={<Tier id="SPEC" />} time="2 min read"
        image={{ src: `${IMG}/schematics/cajal-retina.jpg`, alt: "Cajal's drawing of the retina." }}
        title="Every cell remembers, and knows where it sits"
        excerpt="My guess is that a single cell can hold long-term memory, and that habituation is the form it takes." />
      <StoryCard href="#" when="Sep 25, 2026" badge={<Tier id="SPEC" />} time="3 min read"
        image={{ src: `${IMG}/schematics/cajal-vestibular.jpg`, alt: "Cajal's vestibular nerve fibres." }}
        title="Something has to glue this together"
        excerpt="There's something about polarity and polarization that I think has not been tapped into yet." />
    </StoryRow>
  </Section>
)

const principle = (
  <Section>
    <Principle note="Measured and predicted are never styled alike, and every badge ships a word and a glyph with its colour."
      legend={<TierLegend items={[
        { tier: <Tier id="MEASURED" />, text: "Read off the actual render or a real instrument." },
        { tier: <Tier id="PREDICTED" />, text: "Output of a model. Never styled like a measurement." },
        { tier: <Tier id="EXPLORATORY" />, text: "An open question being actively tried." },
        { tier: <Tier id="SPEC" />, text: "A stated guess. Never evidence." },
        { tier: <Tier id="REFUTED" />, text: "A claim this project explicitly does not make." },
      ]} />}>
      A label may never be hidden. <em>Its explanation must be.</em>
    </Principle>
  </Section>
)

const footer = (
  <SiteFooter id="contact" title="Follow the work as it happens."
    lede="New posts, speculations and merged changes, as they land. Questions, corrections and collaborations are welcome."
    actions={<><Cta href="#" icon>Subscribe via RSS</Cta><Cta href="#" solid>Get in touch</Cta></>}
    links={[{ label: "Posts", href: "#" }, { label: "Speculations", href: "#" }, { label: "Changelog", href: "#" }, { label: "GitHub", href: "#" }]}
    word="Polarize"
    fine={<><span className="ui-label">© 2026 Polarize · Victoria, BC</span><span className="ui-label">Falsification-first · citation-gated</span></>} />
)

const page = (field: boolean) => (
  <div className="ui-cellfield-host">
    {field && <CellField hero="#hero" />}
    {nav}{hero}{process}{projects}{changelog}{findings}{speculations}{principle}{footer}
  </div>
)

/** The whole homepage, with the cell field behind it. */
export const Homepage: StoryObj = { name: "Homepage", render: () => page(true) }

/** The same page at phone width. */
export const HomepageMobile: StoryObj = {
  name: "Homepage (phone)",
  render: () => page(true),
  parameters: { viewport: { defaultViewport: "mobile1" } },
  globals: { viewport: { value: "mobile1", isRotated: false } },
}

export const HeroOnly: StoryObj = { name: "Hero + cell field", render: () => <div className="ui-cellfield-host"><CellField hero="#hero" />{hero}</div> }
export const Steps: StoryObj = { name: "Process steps", render: () => process }
export const Projects: StoryObj = { name: "Project features", render: () => projects }
export const Articles: StoryObj = { name: "Article cards", render: () => findings }
export const Stories: StoryObj = { name: "Story cards", render: () => speculations }
export const Footer: StoryObj = { name: "Site footer", render: () => footer }
