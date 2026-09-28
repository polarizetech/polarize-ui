// The LANDING layer in React: a lab's front door. Same classes as landing.css, so the
// zero-build site (polarize.tech) and a React app render the same thing.
// Tier badges are slots (ReactNode): pass <Tier id="MEASURED" />, never a hand-built badge.
import * as React from "react"
import { ArrowUpRight, Menu } from "lucide-react"
import { cn } from "../lib/utils"

export type NavLink = { label: string; href: string; current?: boolean }

/** The dot cluster used as the default CTA icon. */
export function CellDots({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true" className={className} fill="currentColor">
      <circle cx="5" cy="6" r="1.8" /><circle cx="12" cy="4" r="1.3" /><circle cx="9" cy="11" r="2.2" />
      <circle cx="16" cy="10" r="1.4" /><circle cx="11" cy="17" r="1.6" />
    </svg>
  )
}

/** A pill with a dashed ring and a mono label. `icon` = true draws the cell dots. */
export function Cta({ href, children, icon, solid = false, className }: {
  href: string; children: React.ReactNode; icon?: React.ReactNode | true; solid?: boolean; className?: string
}) {
  return (
    <a className={cn("ui-cta", solid && "ui-cta--solid", className)} href={href}>
      {icon && <span className="ui-cta__icon">{icon === true ? <CellDots /> : icon}</span>}
      <span className="ui-cta__text">{children}</span>
    </a>
  )
}

/** Sticky top bar. On a phone the links and actions fold into a <details> menu. */
export function TopNav({ brand, links, actions, menuLabel = "Menu" }: {
  brand: React.ReactNode; links: NavLink[]; actions?: React.ReactNode; menuLabel?: string
}) {
  const items = links.map((l) => (
    <a key={l.label} className={cn("ui-topnav__link", l.current && "is-current")} href={l.href}
       aria-current={l.current ? "page" : undefined}>{l.label}</a>
  ))
  return (
    <header className="ui-topnav">
      {brand}
      <nav className="ui-topnav__links" aria-label="Main">{items}</nav>
      {actions && <div className="ui-topnav__actions">{actions}</div>}
      <details className="ui-topnav__menu">
        <summary aria-label={menuLabel}><Menu aria-hidden="true" /></summary>
        <nav className="ui-topnav__panel" aria-label={menuLabel}>{items}{actions}</nav>
      </details>
    </header>
  )
}

/** Centred hero: a display heading (wrap the accented words in <em>), a lede and actions. */
export function Hero({ id, title, lede, actions, reveal = true }: {
  id?: string; title: React.ReactNode; lede?: React.ReactNode; actions?: React.ReactNode; reveal?: boolean
}) {
  const r = (n: number) => (reveal ? cn("ui-reveal", n > 1 && `ui-reveal--${n}`) : undefined)
  return (
    <section className="ui-hero" id={id}>
      <h1 className={cn("ui-hero__title", r(1))}>{title}</h1>
      {lede && <p className={cn("ui-hero__lede", r(3))}>{lede}</p>}
      {actions && <div className={cn("ui-hero__actions", r(4))}>{actions}</div>}
    </section>
  )
}

/** A page section with its head: eyebrow, display title, and a lede or action beside it. */
export function Section({ id, eyebrow, title, lede, action, stack = false, className, children }: {
  id?: string; eyebrow?: string; title?: React.ReactNode; lede?: React.ReactNode; action?: React.ReactNode
  stack?: boolean; className?: string; children?: React.ReactNode
}) {
  return (
    <section className={cn("ui-section", className)} id={id}>
      {(eyebrow || title) && (
        <div className={cn("ui-section__head", stack && "ui-section__head--stack")}>
          <div className="ui-section__titles">
            {eyebrow && <p className="ui-section__eyebrow">{eyebrow}</p>}
            {title && <h2 className="ui-section__title">{title}</h2>}
            {stack && lede && <p className="ui-section__lede">{lede}</p>}
          </div>
          {!stack && (lede || action) && (
            <div className="ui-section__side">
              {lede && <p className="ui-section__lede">{lede}</p>}
              {action}
            </div>
          )}
        </div>
      )}
      {children}
    </section>
  )
}

export type PlateProps = { src: string; alt: string; caption?: React.ReactNode; photo?: boolean; className?: string }

/** An archival plate (cream line on near-black, which drops out on a dark page) or a photograph. */
export function Plate({ src, alt, caption, photo = false, className }: PlateProps) {
  return (
    <figure className={cn("ui-plate", className)}>
      <div className="ui-plate__frame">
        <img className={cn("ui-plate__img", photo && "ui-plate__img--photo")} src={src} alt={alt} loading="lazy" />
      </div>
      {caption && <figcaption className="ui-plate__caption">{caption}</figcaption>}
    </figure>
  )
}

export type Latest = { date: string; text: React.ReactNode }

function LatestLine({ latest, className }: { latest: Latest; className: string }) {
  return (
    <div className={className}>
      <span className="ui-label">Latest · {latest.date}</span>
      <span>{latest.text}</span>
    </div>
  )
}

export type ProcessStep = {
  num: string; stage: string; repo: string; version?: string; title: string; body: React.ReactNode
  files?: string[]; latest?: Latest; read?: React.ReactNode; href: string
}

/** Numbered steps joined by arrows (downward on a phone). */
export function ProcessSteps({ steps }: { steps: ProcessStep[] }) {
  return (
    <ol className="ui-steps">
      {steps.map((s) => (
        <li key={s.num}>
          <a className="ui-step" href={s.href}>
            <div className="ui-step__head">
              <span className="ui-step__num">{s.num}</span>
              <span className="ui-label">{s.stage}</span>
            </div>
            <div className="ui-step__repo">{s.repo}{s.version && <span className="ui-label">{s.version}</span>}</div>
            <h3 className="ui-step__title">{s.title}</h3>
            <p className="ui-step__body">{s.body}</p>
            {s.files && s.files.length > 0 && (
              <div className="ui-step__files" aria-label="Leaves behind">
                {s.files.map((f) => <span key={f} className="ui-step__file">{f}</span>)}
              </div>
            )}
            {s.latest && <LatestLine latest={s.latest} className="ui-step__latest" />}
            <div className="ui-step__foot"><span>{s.read}</span><span className="ui-label">GitHub ↗</span></div>
          </a>
        </li>
      ))}
    </ol>
  )
}

/** Short promises in a ruled row. */
export function Promises({ items }: { items: { title: string; text: React.ReactNode }[] }) {
  return (
    <div className="ui-promises">
      {items.map((p) => (
        <div key={p.title} className="ui-promise">
          <p className="ui-promise__title">{p.title}</p>
          <p className="ui-promise__text">{p.text}</p>
        </div>
      ))}
    </div>
  )
}

export type Change = { date: string; num?: string; title: React.ReactNode }

/** A project: the question it asks, its latest finding, its latest changes, and a plate. */
export function ProjectFeature({ href, repo, meta = [], question, description, finding, changes = [], plate, flip = false }: {
  href: string; repo: string; meta?: string[]; question: React.ReactNode; description?: React.ReactNode
  finding?: { tier?: React.ReactNode; text: React.ReactNode; read?: React.ReactNode }
  changes?: Change[]; plate?: PlateProps; flip?: boolean
}) {
  return (
    <a className={cn("ui-project", flip && "ui-project--flip")} href={href}>
      <div className="ui-project__body">
        <div className="ui-project__meta">
          <span className="ui-project__repo">{repo}</span>
          {meta.map((m) => <span key={m} className="ui-label">{m}</span>)}
        </div>
        <h3 className="ui-project__question">{question}</h3>
        {description && <p className="ui-project__desc">{description}</p>}
        {finding && (
          <div className="ui-project__finding">
            <div className="ui-project__finding-head"><span className="ui-label">Finding</span>{finding.tier}</div>
            <p className="ui-project__finding-text">{finding.text}</p>
            {finding.read && <span className="ui-arrowlink">{finding.read}</span>}
          </div>
        )}
        {changes.length > 0 && (
          <div>
            <p className="ui-label" style={{ marginBottom: 10 }}>Latest changes</p>
            <ul className="ui-project__changes">
              {changes.map((c, i) => (
                <li key={i}>
                  <span className="ui-project__date">{c.date}</span>
                  <span className="ui-project__num">{c.num}</span>
                  <span>{c.title}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
      {plate && <Plate {...plate} className={cn("ui-project__media", plate.className)} />}
    </a>
  )
}

/** A smaller repository card. */
export function RepoCard({ href, name, version, pitch, description, latest, read }: {
  href: string; name: string; version?: string; pitch?: React.ReactNode; description?: React.ReactNode
  latest?: Latest; read?: React.ReactNode
}) {
  return (
    <a className="ui-repocard" href={href}>
      <div className="ui-repocard__head">
        <span className="ui-repocard__name">{name}</span>
        {version && <span className="ui-label">{version}</span>}
      </div>
      {pitch && <h4 className="ui-repocard__pitch">{pitch}</h4>}
      {description && <p className="ui-repocard__desc">{description}</p>}
      {latest && <LatestLine latest={latest} className="ui-repocard__latest" />}
      {read && <span className="ui-arrowlink">{read}</span>}
    </a>
  )
}

export type FeedItem = { date: string; repo: string; kind: string; title: React.ReactNode; href: string }

/** The changelog as a feed: one row per merged change. */
export function ChangeFeed({ items }: { items: FeedItem[] }) {
  return (
    <ul className="ui-changes">
      {items.map((c, i) => (
        <li key={i}>
          <a className="ui-change" href={c.href}>
            <span className="ui-change__date">{c.date}</span>
            <span className="ui-change__repo">{c.repo}</span>
            <span className="ui-change__kind">{c.kind}</span>
            <span className="ui-change__title">{c.title}</span>
            <span className="ui-change__go" aria-hidden="true">→</span>
          </a>
        </li>
      ))}
    </ul>
  )
}

/** Tier badge + mono label, the meta row on cards. */
export function MetaLine({ tier, children }: { tier?: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="ui-metaline">
      {tier}
      {children && <span className="ui-metaline__text">{children}</span>}
    </div>
  )
}

/** The lead article: image beside title and summary. */
export function FeaturedArticle({ href, image, meta, title, summary, from, read = "Read the article →" }: {
  href: string; image?: PlateProps; meta?: React.ReactNode; title: React.ReactNode; summary?: React.ReactNode
  from?: React.ReactNode; read?: React.ReactNode
}) {
  return (
    <a className="ui-feature" href={href}>
      {image && <Plate {...image} className={cn("ui-feature__media", image.className)} />}
      <div className="ui-feature__body">
        {meta}
        <h3 className="ui-feature__title">{title}</h3>
        {summary && <p className="ui-feature__summary">{summary}</p>}
        <div className="ui-feature__foot"><span className="ui-feature__from">{from}</span><span>{read}</span></div>
      </div>
    </a>
  )
}

/** An article card. With no image, a line from the piece stands in, set large. */
export function ArticleCard({ href, image, pull, meta, title, description, credit }: {
  href: string; image?: PlateProps; pull?: React.ReactNode; meta?: React.ReactNode; title: React.ReactNode
  description?: React.ReactNode; credit?: React.ReactNode
}) {
  return (
    <a className="ui-articlecard" href={href}>
      {image ? <Plate {...image} className={cn("ui-articlecard__media", image.className)} />
        : pull ? <p className="ui-articlecard__pull">“{pull}”</p> : null}
      <div className="ui-articlecard__body">
        {meta}
        <h3 className="ui-articlecard__title">{title}</h3>
        {description && <p className="ui-articlecard__desc">{description}</p>}
        {credit && <span className="ui-articlecard__credit">{credit}</span>}
      </div>
    </a>
  )
}

/** A portrait card told like a post: who and when at the top, the words at the bottom. */
export function StoryCard({ href, image, who = "Polarize", when, badge, title, excerpt, time, read = "Keep reading →" }: {
  href: string; image?: { src: string; alt: string }; who?: string; when?: string; badge?: React.ReactNode
  title: React.ReactNode; excerpt?: React.ReactNode; time?: string; read?: React.ReactNode
}) {
  return (
    <a className="ui-story" href={href}>
      {image && <img className="ui-story__bg ui-plate__img" src={image.src} alt={image.alt} loading="lazy" />}
      <div className="ui-story__head">
        <span className="ui-story__avatar" aria-hidden="true" />
        <span className="ui-story__who">{who}{when && <span className="ui-story__when">{when}</span>}</span>
        {badge}
      </div>
      <div className="ui-story__body">
        <h3 className="ui-story__title">{title}</h3>
        {excerpt && <p className="ui-story__excerpt">“{excerpt}”</p>}
        <div className="ui-story__foot"><span>{read}</span>{time && <span className="ui-story__time">{time}</span>}</div>
      </div>
    </a>
  )
}

/** An intro column beside a horizontally scrolling row of story cards. */
export function StoryRow({ intro, children }: { intro: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="ui-storyrow">
      <div className="ui-storyrow__intro">{intro}</div>
      <ul className="ui-stories">
        {React.Children.map(children, (c) => <li>{c}</li>)}
      </ul>
    </div>
  )
}

/** Every story as a wrapping grid (an index page). */
export function StoryGrid({ children }: { children: React.ReactNode }) {
  return <ul className="ui-stories ui-stories--grid">{React.Children.map(children, (c) => <li>{c}</li>)}</ul>
}

/** One sentence set large, with an optional note and legend beneath. */
export function Principle({ children, note, legend }: { children: React.ReactNode; note?: React.ReactNode; legend?: React.ReactNode }) {
  return (
    <div className="ui-principle">
      <p className="ui-principle__text">{children}</p>
      {note && <p className="ui-principle__note">{note}</p>}
      {legend}
    </div>
  )
}

/** The tier ladder explained: badge + one line each. */
export function TierLegend({ items }: { items: { tier: React.ReactNode; text: React.ReactNode }[] }) {
  return (
    <div className="ui-tierlegend">
      {items.map((it, i) => (
        <div key={i} className="ui-tierlegend__item">{it.tier}<p className="ui-tierlegend__text">{it.text}</p></div>
      ))}
    </div>
  )
}

/** The site footer: a closing call to action, links, and the wordmark. */
export function SiteFooter({ id, title, lede, actions, links = [], word, fine }: {
  id?: string; title: React.ReactNode; lede?: React.ReactNode; actions?: React.ReactNode
  links?: NavLink[]; word?: string; fine?: React.ReactNode
}) {
  return (
    <footer className="ui-sitefooter" id={id}>
      <div className="ui-sitefooter__cta">
        <div>
          <h2 className="ui-sitefooter__title">{title}</h2>
          {lede && <p className="ui-sitefooter__lede">{lede}</p>}
        </div>
        {actions && <div className="ui-sitefooter__actions">{actions}</div>}
      </div>
      {links.length > 0 && (
        <div className="ui-sitefooter__nav">
          <nav className="ui-sitefooter__links" aria-label="Footer">
            {links.map((l) => <a key={l.label} className="ui-sitefooter__link" href={l.href}>{l.label}</a>)}
          </nav>
        </div>
      )}
      {word && <div className="ui-sitefooter__word" aria-hidden="true">{word}</div>}
      {fine && <div className="ui-sitefooter__fine">{fine}</div>}
    </footer>
  )
}

/** A mono "GitHub ↗" style external marker. */
export function External({ children = "GitHub" }: { children?: React.ReactNode }) {
  return <span className="ui-label" style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>{children}<ArrowUpRight className="ui-icon" aria-hidden="true" /></span>
}
