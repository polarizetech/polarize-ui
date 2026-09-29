// The DOCS layer in React: a documentation site for a library or tool. Same classes as
// docs.css, so a static generator (zero-build) and a React app render the same page.
// Plots and syntax highlighting reuse docs.js itself (loaded lazily, auto-init off), so
// there is one renderer. Guide: DOCS-SITES.md.
import * as React from "react"
import { Menu, Moon, Search, Sun } from "lucide-react"
import { cn } from "../lib/utils"
import type { PlotSpec } from "../../docs.js"

export type { PlotSpec }
export type DocsNavItem = { label: React.ReactNode; href: string; current?: boolean; meta?: React.ReactNode }
export type DocsNavGroup = { title: string; items: DocsNavItem[] }
export type DocsTocItem = { label: string; href: string; sub?: boolean }

type DocsModule = typeof import("../../docs.js")
let docsModule: Promise<DocsModule> | null = null
function loadDocs(): Promise<DocsModule> {
  // React owns the page: stop docs.js wiring document-wide listeners on import.
  ;(window as unknown as { __uiDocsNoAutoInit?: boolean }).__uiDocsNoAutoInit = true
  return (docsModule ??= import("../../docs.js"))
}

/** The whole page: top bar, left nav, content, and an optional "on this page" column. */
export function DocsShell({ brand, sub = "docs", nav, toc, wide = false, flag, actions, onSearch, children }: {
  brand: React.ReactNode; sub?: string; nav: DocsNavGroup[]; toc?: DocsTocItem[]; wide?: boolean
  flag?: string; actions?: React.ReactNode; onSearch?: () => void; children: React.ReactNode
}) {
  const [navOpen, setNavOpen] = React.useState(false)
  return (
    <div className={cn("ui-docsite", navOpen && "is-nav-open")}>
      <header className="ui-docsite__bar">
        <button className="ui-docsite__iconbtn ui-docsite__navtoggle" aria-label="Open navigation"
                aria-expanded={navOpen} onClick={() => setNavOpen((o) => !o)}><Menu /></button>
        <span className="ui-docsite__brand">{brand}<span className="ui-docsite__brand-sub">{sub}</span></span>
        <button className="ui-docsite__search-btn" onClick={onSearch}>
          <Search width={15} height={15} /><span>Search docs</span><kbd>⌘K</kbd>
        </button>
        <div className="ui-docsite__actions">
          {flag && <span className="ui-docsite__flag">{flag}</span>}
          {actions}
        </div>
      </header>
      <div className={cn("ui-docsite__shell", (wide || !toc?.length) && "ui-docsite__shell--wide")}>
        <nav className="ui-docsite__nav" aria-label="Documentation">
          {nav.map((g) => (
            <div className="ui-docsite__navgroup" key={g.title}>
              <h2 className="ui-docsite__navtitle">{g.title}</h2>
              <ul>{g.items.map((it) => (
                <li key={it.href}><a href={it.href} className={cn(it.current && "is-current")}
                  aria-current={it.current ? "page" : undefined}>{it.label}
                  {it.meta && <span className="ui-docsite__navmeta">{it.meta}</span>}</a></li>
              ))}</ul>
            </div>
          ))}
        </nav>
        <main className="ui-docsite__main">{children}</main>
        {toc?.length ? (
          <aside className="ui-docsite__toc" aria-label="On this page">
            <h2 className="ui-docsite__navtitle">On this page</h2>
            <ul>{toc.map((t) => <li key={t.href} className={cn(t.sub && "is-sub")}><a href={t.href}>{t.label}</a></li>)}</ul>
          </aside>
        ) : null}
      </div>
    </div>
  )
}

/** The theme toggle button for DocsShell's actions: `dark` and `onToggle` are the app's. */
export function DocsThemeToggle({ dark, onToggle }: { dark: boolean; onToggle: () => void }) {
  return (
    <button className="ui-docsite__iconbtn" aria-label="Toggle colour theme" onClick={onToggle}>
      {dark ? <Moon /> : <Sun />}
    </button>
  )
}

/** Eyebrow, display title and lead for a page. */
export function DocsPageHead({ eyebrow, title, lead }: { eyebrow?: string; title: React.ReactNode; lead?: React.ReactNode }) {
  return (
    <>
      {eyebrow && <p className="ui-docsite__eyebrow">{eyebrow}</p>}
      <h1 className="ui-display ui-display--1 ui-docsite__title">{title}</h1>
      {lead && <p className="ui-docsite__lead">{lead}</p>}
    </>
  )
}

/** A section heading with a hairline above it. */
export function DocsSection({ id, title, lead, children }: { id?: string; title: string; lead?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <>
      <h2 id={id} className="ui-docsite__h2">{title}</h2>
      {lead && <p className="ui-docsite__sublead">{lead}</p>}
      {children}
    </>
  )
}

/** An always-dark code window. `output` is shown under a dashed rule, as captured output. */
export function CodeWindow({ name, code, lang = "python", output, note, copy = true, className }: {
  name?: string; code: string; lang?: string; output?: string; note?: React.ReactNode; copy?: boolean; className?: string
}) {
  const ref = React.useRef<HTMLElement>(null)
  const [copied, setCopied] = React.useState(false)
  React.useEffect(() => {
    if (lang !== "python" || !ref.current) return
    const el = ref.current
    loadDocs().then((m) => { el.innerHTML = m.highlight(code) })
  }, [code, lang])
  return (
    <div className={cn("ui-codewin", className)}>
      <div className="ui-codewin__bar">
        <span className="ui-codewin__dots" aria-hidden="true"><i /><i /><i /></span>
        {name && <span className="ui-codewin__name">{name}</span>}
        {copy && <button className="ui-codewin__copy" onClick={() => {
          navigator.clipboard?.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1400) })
        }}>{copied ? "Copied" : "Copy"}</button>}
      </div>
      <pre><code ref={ref} className={`language-${lang}`}>{code}</code></pre>
      {output && <pre className="ui-codewin__out"><code>{output}</code></pre>}
      {note && <p className="ui-codewin__note">{note}</p>}
    </div>
  )
}

/** One plot from a JSON spec, drawn by docs.js's renderer (the same one static pages use). */
export function Plot({ spec }: { spec: PlotSpec }) {
  const ref = React.useRef<HTMLDivElement>(null)
  React.useEffect(() => {
    const host = ref.current
    if (!host) return
    let alive = true
    const draw = () => loadDocs().then((m) => { if (alive) { host.innerHTML = ""; m.renderPlot(spec, host) } })
    draw()
    const obs = new MutationObserver(draw) // theme flips (class or data-theme on <html>)
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["class", "data-theme"] })
    const onResize = () => draw()
    addEventListener("resize", onResize)
    return () => { alive = false; obs.disconnect(); removeEventListener("resize", onResize) }
  }, [spec])
  return <div ref={ref} />
}

export type ExampleTab = { id: string; label: string; plots: PlotSpec[] }

/** One real call: its code, then tabs of plots (output first), facts and a provenance line. */
export function Example({ id, title, summary, meta, code, codeName, codeLang = "python", tabs, badge, facts, foot, raw }: {
  id?: string; title: string; summary?: React.ReactNode; meta?: React.ReactNode; code: string; codeName?: string; codeLang?: string
  tabs: ExampleTab[]; badge?: React.ReactNode; facts?: [string, React.ReactNode][]; foot?: React.ReactNode; raw?: unknown
}) {
  const [tab, setTab] = React.useState(tabs[0]?.id)
  const current = tabs.find((t) => t.id === tab) ?? tabs[0]
  return (
    <section className="ui-example">
      <div className="ui-example__head">
        <div>
          <h3 id={id} className="ui-example__title">{title}</h3>
          {summary && <p className="ui-example__summary">{summary}</p>}
        </div>
        {meta && <div className="ui-example__meta">{meta}</div>}
      </div>
      <div className="ui-example__grid">
        <CodeWindow name={codeName} code={code} lang={codeLang} />
        <div className="ui-example__io">
          <div className="ui-example__tabs" role="tablist">
            {tabs.map((t) => (
              <button key={t.id} role="tab" className="ui-example__tab" aria-selected={t.id === current?.id}
                      onClick={() => setTab(t.id)}>{t.label}</button>
            ))}
            <span className="ui-example__spacer" />
            {badge}
          </div>
          <div className="ui-example__body">{current?.plots.map((p, i) => <Plot key={`${current.id}-${i}`} spec={p} />)}</div>
        </div>
      </div>
      {facts?.length ? (
        <dl className="ui-facts">{facts.map(([k, v]) => (
          <div className="ui-facts__item" key={k}><dt>{k}</dt><dd>{v}</dd></div>
        ))}</dl>
      ) : null}
      {raw !== undefined && (
        <details className="ui-example__raw"><summary>Raw result (JSON)</summary>
          <pre><code>{JSON.stringify(raw, null, 2)}</code></pre></details>
      )}
      {foot && <p className="ui-example__foot">{foot}</p>}
    </section>
  )
}

/** A broken example: shown, labelled and with its error, never dropped from the page. */
export function ExampleFailed({ title, error, trace }: { title: string; error: string; trace?: string }) {
  return (
    <section className="ui-example">
      <div className="ui-example__head"><h3 className="ui-example__title">{title}</h3></div>
      <div className="ui-example__error">
        <span className="ui-example__failed">Example failed</span> <code>{error}</code>
        {trace && <details><summary>Traceback</summary><pre>{trace}</pre></details>}
      </div>
    </section>
  )
}

/** One function or class in an API reference. */
export function ApiEntry({ id, kind = "function", name, signature, summary, source, more }: {
  id?: string; kind?: string; name: string; signature: string; summary?: React.ReactNode; source?: string; more?: React.ReactNode
}) {
  return (
    <article className="ui-apientry" id={id}>
      <div className="ui-apientry__head">
        <span className="ui-apientry__kind">{kind}</span>
        <h4 className="ui-apientry__name"><code>{name}</code></h4>
        {source && <a className="ui-apientry__src" href={source}>source</a>}
      </div>
      <pre className="ui-apientry__sig"><code>{signature}</code></pre>
      {summary && <div className="ui-apientry__doc">{summary}</div>}
      {more && <details className="ui-apientry__more"><summary>Full docstring</summary><div className="ui-docsite__prose">{more}</div></details>}
    </article>
  )
}

/** A card for a package, extension or plugin, with a pointer-following grid texture. */
export function PkgCard({ href, icon, version, title, desc, footStart, footEnd }: {
  href: string; icon?: React.ReactNode; version?: string; title: string; desc?: React.ReactNode
  footStart?: React.ReactNode; footEnd?: React.ReactNode
}) {
  return (
    <a className="ui-pkgcard" href={href} onPointerMove={(e) => {
      const r = e.currentTarget.getBoundingClientRect()
      e.currentTarget.style.setProperty("--mx", `${e.clientX - r.left}px`)
      e.currentTarget.style.setProperty("--my", `${e.clientY - r.top}px`)
    }}>
      <div className="ui-pkgcard__grid" aria-hidden="true" />
      <div className="ui-pkgcard__top">
        {icon ? <span className="ui-pkgcard__icon">{icon}</span> : <span />}
        {version && <span className="ui-pkgcard__ver">{version}</span>}
      </div>
      <h3 className="ui-pkgcard__title">{title}</h3>
      {desc && <p className="ui-pkgcard__desc">{desc}</p>}
      {(footStart || footEnd) && <div className="ui-pkgcard__foot"><span>{footStart}</span><span>{footEnd}</span></div>}
    </a>
  )
}
export function PkgCards({ children }: { children: React.ReactNode }) {
  return <div className="ui-pkgcards">{children}</div>
}

/** A labelled chip: `<Chip label="version"><code>0.1.2</code></Chip>`. With `dot` it is a dataset chip. */
export function Chip({ label, href, dot, licence, children }: {
  label?: string; href?: string; dot?: boolean; licence?: string; children: React.ReactNode
}) {
  const body = (<>{dot && <span className="ui-chip__dot" />}{label && <span className="ui-chip__label">{label}</span>}{children}
    {licence && <span className="ui-chip__lic">{licence}</span>}</>)
  return href ? <a className="ui-chip" href={href}>{body}</a> : <span className="ui-chip">{body}</span>
}
export function Chips({ children }: { children: React.ReactNode }) {
  return <div className="ui-chips">{children}</div>
}

/** A boxed note. `warn` for a claim boundary or caveat, `info` for context. */
export function Callout({ tone = "info", label, children }: { tone?: "info" | "warn"; label: string; children: React.ReactNode }) {
  return (
    <div className={cn("ui-callout", `ui-callout--${tone}`)}>
      <p className="ui-callout__label">{label}</p>
      {children}
    </div>
  )
}

/** A row of counts under a hero. */
export function StatRow({ items }: { items: [React.ReactNode, string][] }) {
  return (
    <div className="ui-statrow">{items.map(([n, label]) => (
      <div className="ui-statrow__item" key={label}><span className="ui-statrow__n">{n}</span><span className="ui-statrow__label">{label}</span></div>
    ))}</div>
  )
}

/** A numbered explainer row ("How this site is made"). */
export function HowTo({ items }: { items: [string, React.ReactNode][] }) {
  return (
    <div className="ui-howto">{items.map(([step, text]) => (
      <div className="ui-howto__item" key={step}><p className="ui-howto__step">{step}</p><p className="ui-howto__text">{text}</p></div>
    ))}</div>
  )
}

/** A dataset with its licence and citation, so attribution travels with the data. */
export function DatasetCard({ id, title, licence, why, provider, providerHref, version, modality, doi, licenceHref, cite, usedBy }: {
  id?: string; title: string; licence: string; why?: React.ReactNode; provider: string; providerHref?: string; version?: string
  modality?: string; doi?: string; licenceHref?: string; cite: React.ReactNode; usedBy?: React.ReactNode
}) {
  return (
    <section className="ui-dataset" id={id}>
      <div className="ui-dataset__head"><h3 className="ui-display ui-display--3">{title}</h3><span className="ui-dataset__lic">{licence}</span></div>
      {why && <p className="ui-dataset__why">{why}</p>}
      <dl className="ui-dataset__dl">
        <div><dt>provider</dt><dd>{providerHref ? <a href={providerHref}>{provider}</a> : provider}{version && ` · v${version}`}</dd></div>
        {modality && <div><dt>modality</dt><dd>{modality}</dd></div>}
        {doi && <div><dt>DOI</dt><dd><a href={`https://doi.org/${doi}`}>{doi}</a></dd></div>}
        <div><dt>licence</dt><dd>{licenceHref ? <a href={licenceHref}>{licence}</a> : licence}</dd></div>
      </dl>
      <p className="ui-dataset__cite">{cite}</p>
      {usedBy && <p className="ui-dataset__used">{usedBy}</p>}
    </section>
  )
}
