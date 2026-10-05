/**
 * Filter components — React renderers for the FILTERS section of publication.css, the
 * same classes filter.js enhances on a zero-build site. The matching and counting are
 * filter.js's own pure functions, so the two cannot disagree about what a filter shows.
 *
 * Each control stands alone and is controlled: it takes a value and reports a change.
 * `useFilter` holds the state for a whole index and gives every control its faceted count.
 * State is always carried by aria-pressed on a real <button>, never by a class alone.
 */
import * as React from "react"
import { Check, Search, X } from "lucide-react"
import {
  emptyState, facetCount, isFiltered, readQuery, toQuery, visible,
  type FilterItem, type FilterState,
} from "../../filter.js"
import { TIERS, type TierId } from "../science/evidence/tier"
import { cn } from "../lib/utils"

export type { FilterItem, FilterState }

const share = (v: number) => ({ "--share": String(Math.max(0, Math.min(1, v))) }) as React.CSSProperties

/* ---------- Panel ---------- */

/** The panel shell: a label, a live tally of what is shown, the sections, and a footer row. */
export function FilterPanel({
  label = "Filter", shown, total, noun = "items", footer, children, className, ...rest
}: {
  label?: string
  /** How many items pass the filters, and how many there are. Both are printed. */
  shown: number
  total: number
  noun?: string
  footer?: React.ReactNode
  children: React.ReactNode
} & Omit<React.ComponentProps<"nav">, "children">) {
  return (
    <nav className={cn("ui-filter", className)} aria-label={`${label} ${noun}`} {...rest}>
      <div className="ui-filter__head">
        <p className="ui-label">{label}</p>
        <span className="ui-filter__tally" aria-live="polite"><b>{shown}</b> / {total} {noun}</span>
      </div>
      {children}
      {footer && <div className="ui-filter__foot">{footer}</div>}
    </nav>
  )
}

/** One group of controls: a label, an optional hint beside it and a note under it. */
export function FilterSection({ label, hint, note, children }: {
  label: string; hint?: string; note?: React.ReactNode; children: React.ReactNode
}) {
  return (
    <section className="ui-filter__section">
      <div className="ui-filter__section-head">
        <p className="ui-label">{label}</p>
        {hint && <span className="ui-filter__hint">{hint}</span>}
      </div>
      {children}
      {note && <p className="ui-filter__note">{note}</p>}
    </section>
  )
}

export function FilterSearch({ value, onChange, label, placeholder }: {
  value: string; onChange: (value: string) => void
  /** The accessible name; the field has no visible label. */
  label: string
  placeholder?: string
}) {
  return (
    <label className="ui-filter__search">
      <span className="sr-only">{label}</span>
      <Search aria-hidden="true" />
      <input type="search" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} />
    </label>
  )
}

/* ---------- Facet: single-select list with counts and share bars ---------- */

export type FacetOption = { key: string; label: string; count: number }

/**
 * Pick one of a list. Each row prints its count and draws it as a share of `total`, so the
 * bar and the number say the same thing. A row with nothing behind it is dimmed, not removed.
 */
export function Facet({ options, value, onChange, total, label }: {
  options: FacetOption[]; value: string; onChange: (key: string) => void
  /** What a full bar means. Defaults to the largest count in the list. */
  total?: number
  /** Accessible name for the list. */
  label: string
}) {
  const full = total ?? Math.max(1, ...options.map((o) => o.count))
  return (
    <ul className="ui-facet" aria-label={label}>
      {options.map((o) => {
        const on = o.key === value
        return (
          <li key={o.key} className="ui-facet__item">
            <button type="button" className={cn("ui-facet__btn", !o.count && !on && "is-empty")} aria-pressed={on}
              style={share(full ? o.count / full : 0)} onClick={() => onChange(o.key)}>
              <span className="ui-facet__row">
                <span className="ui-facet__name"><span className="ui-facet__mark" />{o.label}</span>
                <span className="ui-facet__count">{o.count}</span>
              </span>
              <span className="ui-facet__bar" aria-hidden="true"><span className="ui-facet__fill" /></span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}

/* ---------- Tier toggles: multi-select ---------- */

/**
 * A tier badge you can press. It is the same badge as <Tier> — same glyph, word and colour,
 * read from the tier table — so a filter can never show a tier differently from a result.
 */
export function TierToggle({ id, pressed, onPressedChange, count }: {
  id: TierId; pressed: boolean; onPressedChange: (pressed: boolean) => void; count?: number
}) {
  const t = TIERS[id]
  if (!t) throw new Error(`unknown tier ${String(id)} — add it to tokens.json, not here`)
  return (
    <button type="button" data-family={t.family} title={t.meaning} aria-pressed={pressed}
      aria-label={`${t.label}: ${t.meaning}${count === undefined ? "" : ` (${count})`}`}
      className={cn("ui-tier", `ui-tier--${t.family}`, "ui-tier--toggle", count === 0 && "is-empty")}
      onClick={() => onPressedChange(!pressed)}>
      <span className="ui-tier__glyph" aria-hidden="true">{t.glyph}</span>
      <span>{t.label}</span>
      {count !== undefined && <span className="ui-tier__count">{count}</span>}
    </button>
  )
}

/** A row of tier toggles; any number can be on. `value` is the list of pressed tiers. */
export function TierToggles({ tiers, value, onChange }: {
  tiers: { id: TierId; count?: number }[]; value: string[]; onChange: (value: string[]) => void
}) {
  return (
    <div className="ui-filter__tiers">
      {tiers.map(({ id, count }) => (
        <TierToggle key={id} id={id} count={count} pressed={value.includes(id)}
          onPressedChange={(on) => onChange(on ? [...value, id] : value.filter((x) => x !== id))} />
      ))}
    </div>
  )
}

/* ---------- Check toggle ---------- */

/** One yes/no filter, full width, with the count it would leave. A button, not a checkbox. */
export function CheckToggle({ pressed, onPressedChange, label, count }: {
  pressed: boolean; onPressedChange: (pressed: boolean) => void; label: string; count?: number
}) {
  return (
    <button type="button" className="ui-check" aria-pressed={pressed} onClick={() => onPressedChange(!pressed)}>
      <span className="ui-check__box"><Check aria-hidden="true" /></span>
      <span className="ui-check__label">{label}</span>
      {count !== undefined && <span className="ui-check__count">{count}</span>}
    </button>
  )
}

/* ---------- Histogram of buckets ---------- */

export type Bucket = { key: string; label: string; count: number; name?: string }

/**
 * A few clickable buckets (months, sizes), one bar each. Bar height is the bucket's count as
 * a share of `max`; pass the same `max` whenever the counts change, or the bars rescale and a
 * taller bar stops meaning more. The count is always printed under the bar.
 */
export function BucketHistogram({ buckets, value, onChange, max, noun = "items" }: {
  buckets: Bucket[]; value: string | null; onChange: (key: string | null) => void
  /** What a full-height bar means. Defaults to the largest count shown. */
  max?: number
  noun?: string
}) {
  const full = max ?? Math.max(1, ...buckets.map((b) => b.count))
  return (
    <div className="ui-histo" style={{ "--buckets": String(buckets.length) } as React.CSSProperties}>
      {buckets.map((b) => (
        <button key={b.key} type="button" className="ui-histo__btn" aria-pressed={value === b.key}
          aria-label={`${b.name ?? b.label}, ${b.count} ${noun}`} style={share(b.count / full)}
          onClick={() => onChange(value === b.key ? null : b.key)}>
          <span className="ui-histo__plot"><span className="ui-histo__bar" /></span>
          <span className="ui-histo__axis"><span>{b.label}</span><span>{b.count}</span></span>
        </button>
      ))}
    </div>
  )
}

/* ---------- Segmented control ---------- */

/** Pick one of a few options that are always all visible (a sort order, a view). */
export function Segmented<K extends string>({ options, value, onChange, label }: {
  options: { key: K; label: string }[]; value: K; onChange: (key: K) => void
  /** Accessible name for the group. */
  label: string
}) {
  return (
    <div className="ui-seg" role="group" aria-label={label} style={{ "--segments": String(options.length) } as React.CSSProperties}>
      {options.map((o) => (
        <button key={o.key} type="button" className="ui-seg__btn" aria-pressed={o.key === value} onClick={() => onChange(o.key)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ---------- Results header, chips, empty state ---------- */

export type FilterChip = { label: string; onRemove: () => void }

/** The active filters as removable chips, with "Clear all". Announces changes politely. */
export function FilterChips({ chips, onClear }: { chips: FilterChip[]; onClear?: () => void }) {
  return (
    <div className="ui-chips" aria-live="polite">
      {chips.map((c) => (
        <button key={c.label} type="button" className="ui-chip" aria-label={`Remove filter: ${c.label}`} onClick={c.onRemove}>
          <span>{c.label}</span><X aria-hidden="true" />
        </button>
      ))}
      {chips.length > 0 && onClear && <button type="button" className="ui-chips__clear" onClick={onClear}>Clear all</button>}
    </div>
  )
}

/** Heading on the left; chips (or anything else) on the right. */
export function ResultsHead({ heading, children }: { heading: React.ReactNode; children?: React.ReactNode }) {
  return (
    <div className="ui-results__head">
      <h1 className="ui-label ui-main__heading">{heading}</h1>
      {children}
    </div>
  )
}

/** Shown in place of the list when nothing passes. Says why, and offers the way back. */
export function ResultsEmpty({ title, children, action }: { title: string; children?: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="ui-results__empty">
      <p className="ui-results__empty-title">{title}</p>
      {children && <p>{children}</p>}
      {action}
    </div>
  )
}

/* ---------- State for a whole index ---------- */

/**
 * Filter state for an index, with the faceted count for every control.
 *   · groups combine with AND; tiers are OR among themselves;
 *   · each count ignores its own group's selection, so it shows what picking that row gives;
 *   · with `syncQuery`, the state is read from and written to the page's query string.
 */
export function useFilter<T extends FilterItem>(items: T[], { initial, syncQuery = false }: {
  initial?: Partial<FilterState>; syncQuery?: boolean
} = {}) {
  const [state, setState] = React.useState<FilterState>(() => ({
    ...(syncQuery && typeof location !== "undefined" ? readQuery(location.search) : emptyState()),
    ...initial,
  }))
  React.useEffect(() => {
    if (!syncQuery) return
    const qs = toQuery(state)
    history.replaceState(null, "", location.pathname + (qs ? `?${qs}` : "") + location.hash)
  }, [state, syncQuery])

  const set = React.useCallback((patch: Partial<FilterState>) => setState((s) => ({ ...s, ...patch })), [])
  const reset = React.useCallback(() => setState((s) => ({ ...emptyState(), sort: s.sort })), [])
  const shown = React.useMemo(() => visible(items, state), [items, state])
  const counts = React.useMemo(() => ({
    topic: (key: string) => facetCount(items, state, "topic", (p) => key === "all" || p.topic === key),
    tier: (code: string) => facetCount(items, state, "tier", (p) => p.tier === code),
    month: (key: string) => facetCount(items, state, "month", (p) => p.month === key),
    cited: () => facetCount(items, state, "cited", (p) => p.sources > 0),
  }), [items, state])

  return { state, set, reset, shown, counts, total: items.length, filtered: isFiltered(state) }
}
