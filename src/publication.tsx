/**
 * Publication components — React renderers for publication.css, the same classes the
 * zero-build (Jekyll) sites use. One stylesheet, two renderers, so they cannot drift.
 */
import * as React from "react"
import { ArrowUpRight, BookOpen, FileCheck, Rss, Mail, GitBranch, AlignLeft } from "lucide-react"
import { Tier, type TierId } from "./components/tier"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const icon = "ui-icon size-[1em]"

/* ---------- Shell ---------- */

export function Shell({ brand, sidebar, children }: { brand: React.ReactNode; sidebar: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="ui-shell">
      <div className="ui-shell__brand">{brand}</div>
      <aside className="ui-sidebar">{sidebar}</aside>
      <main className="ui-main">{children}</main>
    </div>
  )
}

export function Brand({ word, href = "/" }: { word: string; href?: string }) {
  return (
    <a className="ui-brand" href={href}>
      <span className="ui-brand__mark" aria-hidden="true" />
      <span className="ui-brand__word">{word}</span>
    </a>
  )
}

export function AuthorNote({
  tagline, name, place, avatar, note, contactHref,
}: { tagline?: string; name: string; place?: string; avatar?: string; note?: string; contactHref?: string }) {
  return (
    <div>
      {tagline && <p className="ui-sidebar__tagline">{tagline}</p>}
      <div className="ui-sidebar__ident">
        {avatar && <img className="ui-sidebar__avatar" src={avatar} alt="" />}
        <div className="ui-sidebar__who">
          <span className="ui-sidebar__name">{name}</span>
          {place && <span className="ui-sidebar__place">{place}</span>}
          {contactHref && (
            <a className="ui-sidebar__contact" href={contactHref}><Mail className={icon} />Get in touch</a>
          )}
        </div>
      </div>
      {note && <p className="ui-sidebar__note">{note}</p>}
    </div>
  )
}

export type NavItem = { label: string; href: string; count?: number; current?: boolean }

export function SidebarSection({ heading, items }: { heading: string; items: NavItem[] }) {
  return (
    <nav className="ui-sidebar__section" aria-label={heading}>
      <p className="ui-label ui-sidebar__heading">{heading}</p>
      <ul className="ui-sidebar__list">
        {items.map((it) => (
          <li key={it.href}>
            <a className={cn("ui-sidebar__link", it.current && "is-current")} href={it.href} aria-current={it.current ? "page" : undefined}>
              <span>{it.label}</span>
              {it.count !== undefined && <span className="ui-sidebar__count">{it.count}</span>}
            </a>
          </li>
        ))}
      </ul>
    </nav>
  )
}

export function SidebarMeta({ feed, github }: { feed?: string; github?: string }) {
  return (
    <div className="ui-sidebar__meta">
      {feed && <a className="ui-sidebar__meta-link" href={feed} aria-label="RSS feed"><Rss className="ui-icon size-4" /></a>}
      {github && <a className="ui-sidebar__meta-link" href={github} aria-label="GitHub"><GitBranch className="ui-icon size-4" /></a>}
    </div>
  )
}

/* ---------- Post index ---------- */

export type PostSummary = {
  href: string; date: string; title: string; description?: string; thumb?: string; badges?: React.ReactNode
}

export function PostList({ posts, empty = "Nothing here yet." }: { posts: PostSummary[]; empty?: string }) {
  if (!posts.length) return <ul className="ui-postlist"><li className="ui-postlist__item ui-postlist__item--empty">{empty}</li></ul>
  return (
    <ul className="ui-postlist">
      {posts.map((p) => (
        <li key={p.href} className="ui-postlist__item">
          <a className="ui-postlist__link" href={p.href}>
            <span className="ui-postlist__main">
              <time className="ui-postlist__date">{p.date}</time>
              <span className="ui-postlist__body">
                <span className="ui-postlist__title">{p.title}</span>
                {p.description && <span className="ui-postlist__desc">{p.description}</span>}
              </span>
              {p.badges && <span className="ui-postlist__meta">{p.badges}</span>}
            </span>
            {p.thumb && <span className="ui-postlist__thumb"><img src={p.thumb} alt="" loading="lazy" /></span>}
          </a>
        </li>
      ))}
    </ul>
  )
}

export function Pager({ prev, next, page, total }: { prev?: string; next?: string; page: number; total: number }) {
  return (
    <nav className="ui-pager" aria-label="Pagination">
      {prev ? <Button asChild variant="outline"><a href={prev}>← Newer</a></Button> : <span className="ui-pager__spacer" />}
      <span className="ui-label ui-pager__count">Page {page} of {total}</span>
      {next ? <Button asChild variant="outline"><a href={next}>Older →</a></Button> : <span className="ui-pager__spacer" />}
    </nav>
  )
}

/* ---------- Article ---------- */

export function Article({
  label, title, standfirst, meta, children,
}: { label?: string; title: string; standfirst?: string; meta?: React.ReactNode; children: React.ReactNode }) {
  return (
    <article className="ui-article">
      <header className="ui-article__head">
        {label && <p className="ui-label">{label}</p>}
        <h1 className="font-display text-[length:var(--display-1)] leading-[1.05] tracking-[-.015em]">{title}</h1>
        {standfirst && <p className="ui-standfirst text-[length:var(--text-lg)] text-muted-foreground">{standfirst}</p>}
        {meta && <div className="ui-article__meta">{meta}</div>}
      </header>
      {children}
    </article>
  )
}

/** Tier badges and topic pills for an article or a post row. A tier is always a <Tier>. */
export function Badges({ tier, items = [] }: { tier?: TierId; items?: { label: string; href?: string }[] }) {
  return (
    <ul className="ui-article__badges">
      {tier && <li><Tier id={tier} /></li>}
      {items.map((b) => (
        <li key={b.label}>
          {b.href ? <a className="ui-article__topic" href={b.href}>{b.label}</a> : <span className="ui-article__topic">{b.label}</span>}
        </li>
      ))}
    </ul>
  )
}

export function Summary({ title = "In short", children }: { title?: string; children: React.ReactNode }) {
  return (
    <aside className="ui-article__summary">
      <p className="ui-label ui-article__summary-title"><AlignLeft className={icon} />{title}</p>
      <div className="ui-article__summary-body">{children}</div>
    </aside>
  )
}

export function Prose({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn("ui-prose", className)}>{children}</div>
}

/* ---------- Sources and citations ---------- */

export type SourceRecord = { title: string; meta: string; href: string; note?: string; fullTextRead?: boolean }

/** An inline source card. Every field should come from a citation ledger, never typed by hand. */
export function Source({ record }: { record: SourceRecord | null }) {
  if (!record) return <div className="ui-source ui-source--broken">Source missing from the ledger.</div>
  return (
    <div className="ui-source">
      <a className="ui-source__link" href={record.href}>
        <span className="ui-source__icon"><BookOpen className="ui-icon" /></span>
        <span className="ui-source__text">
          <span className="ui-source__title">{record.title}</span>
          <span className="ui-source__meta">{record.meta}</span>
        </span>
        <span className="ui-source__go"><ArrowUpRight className="ui-icon size-4" /></span>
      </a>
      {record.note && <p className="ui-source__note">{record.note}</p>}
      {record.fullTextRead && <p className="ui-source__ft"><FileCheck className="ui-icon" />Full text read</p>}
    </div>
  )
}

export function Cite({ n, href }: { n: number; href: string }) {
  return <a className="ui-cite" href={href}>[{n}]</a>
}

export type Claim = { id: string; tier: TierId; statement: string | null }

export function Claims({ title = "Claims this rests on", items }: { title?: string; items: Claim[] }) {
  return (
    <section className="ui-claims">
      <h2 className="ui-refs__title">{title}</h2>
      <ul className="ui-claims__list">
        {items.map((c) => (
          <li key={c.id} className="ui-claims__item">
            <span className="ui-claims__id">{c.id}</span>
            <Tier id={c.tier} />
            <p className={cn("ui-claims__stmt", !c.statement && "ui-claims__stmt--broken")}>
              {c.statement ?? "Claim not found in the research ledger."}
            </p>
          </li>
        ))}
      </ul>
    </section>
  )
}

export type Reference = {
  key: string; authors: string; year: string; title: string; journal?: string; doi?: string
  fullTextRead?: boolean; why?: string
}

export function References({ title = "References", items, note }: { title?: string; items: Reference[]; note?: React.ReactNode }) {
  return (
    <section className="ui-refs">
      <h2 className="ui-refs__title"><BookOpen className={icon} />{title}</h2>
      <ol className="ui-refs__list">
        {items.map((r) => (
          <li key={r.key} id={`ref-${r.key}`} className="ui-refs__item">
            <span className="ui-refs__authors">{r.authors}</span> <span className="ui-refs__year">({r.year})</span>
            <span className="ui-refs__ttl">{r.title}</span>
            {r.journal && <span className="ui-refs__journal">{r.journal}</span>}
            <span className="ui-refs__meta">
              {r.doi && <a className="ui-refs__doi" href={`https://doi.org/${r.doi}`}>doi:{r.doi}</a>}
              <span className="ui-refs__key">{r.key}</span>
              {r.fullTextRead && <span className="ui-refs__ft">Full text read</span>}
            </span>
            {r.why && <p className="ui-refs__why">{r.why}</p>}
          </li>
        ))}
      </ol>
      {note && <p className="ui-refs__note">{note}</p>}
    </section>
  )
}

/* ---------- Parts ---------- */

export type PartItem = { name: string; role?: string; meta?: string; image?: string; href: string }

export function Parts({ items }: { items: PartItem[] }) {
  return (
    <div className="ui-parts">
      {items.map((p) => (
        <a key={p.name} className="ui-part" href={p.href}>
          <span className="ui-part__media">{p.image && <img src={p.image} alt="" loading="lazy" />}</span>
          <span className="ui-part__text">
            <span className="ui-part__name">{p.name}</span>
            {p.role && <span className="ui-part__role">{p.role}</span>}
            {p.meta && <span className="ui-part__meta">{p.meta}</span>}
          </span>
        </a>
      ))}
    </div>
  )
}

/* ---------- Footer ---------- */

export function Footer({ brand, tagline, children }: { brand?: React.ReactNode; tagline?: string; children?: React.ReactNode }) {
  return (
    <footer className="ui-footer">
      {brand && <div className="ui-footer__brand">{brand}</div>}
      {tagline && <p className="ui-footer__tag">{tagline}</p>}
      {children && <p className="ui-footer__fine text-sm text-muted-foreground">{children}</p>}
    </footer>
  )
}
