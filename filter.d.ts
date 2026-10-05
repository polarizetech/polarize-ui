/** Types for filter.js (a zero-build ES module; see the file header). */
export type FilterState = {
  /** Selected topic key, or "all". */
  topic: string
  /** Selected tier codes; an item passes when its tier is any of them. */
  tiers: string[]
  /** Selected month as "YYYY-MM", or null. */
  month: string | null
  /** Only items that cite at least one source. */
  cited: boolean
  /** Free-text query, matched against each item's text. */
  query: string
  /** "new" keeps the list's own order; "src" puts the most sources first. */
  sort: "new" | "src"
}
export type FilterItem = { topic: string; tier: string; month: string; sources: number; text?: string }
export type FilterGroup = "topic" | "tier" | "month" | "cited"

export function emptyState(): FilterState
export function matches(item: FilterItem, state: FilterState, skip?: FilterGroup | null): boolean
export function visible<T extends FilterItem>(items: T[], state: FilterState): T[]
export function facetCount<T extends FilterItem>(items: T[], state: FilterState, group: FilterGroup, test: (item: T) => boolean): number
export function isFiltered(state: FilterState): boolean
export function readQuery(search: string, initialTopic?: string): FilterState
export function toQuery(state: FilterState): string

export type FilterHandle = { state: FilterState; set(patch: Partial<FilterState>): void; reset(): void }
/** Enhance one `.ui-filter` panel. Null when the panel or its target list is missing. */
export function initFilter(root: HTMLElement | null, opts?: { onChange?: (state: FilterState, shown: number) => void }): FilterHandle | null
/** Enhance every [data-ui-filter] on the page. */
export function init(): void
