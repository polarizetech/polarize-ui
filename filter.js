/* ==========================================================================
   polarize-ui — filter.js: a faceted filter for an index of posts (zero-build ES module).

   Progressive enhancement for a `.ui-filter` panel (publication.css) beside a list:

     <nav class="ui-filter" data-ui-filter data-target=".ui-postlist" data-noun="notes"> … </nav>
     <script type="module" src="/design/filter.js"></script>

   Without this script the topic rows are plain links and every part marked
   [data-filter-js] stays hidden. With it, the list filters in place.

   Each item in the target list carries what it can be filtered by:
     data-topic="method"   data-tier="A"   data-date="2026-09-28"   data-src="4"

   Rules:
     · groups combine with AND; the tier group is OR within itself;
     · each group's counts are FACETED: they show what selecting that row would give,
       given every other active filter, ignoring the group's own selection;
     · the state lives in the query string (?topic=&tier=A,C&month=2026-09&cited=1&q=&sort=src),
       written with history.replaceState and read back on load, so a view can be shared;
     · it filters only what is on the page: it fetches nothing and stores nothing.

   The matching and counting are pure functions (matches, visible, facetCount, readQuery,
   toQuery), exported so the React components use the same logic rather than a second copy.
   ========================================================================== */

/** The state with nothing selected. */
export const emptyState = () => ({ topic: 'all', tiers: [], month: null, cited: false, query: '', sort: 'new' });

/** Does `item` pass every active group except `skip`? (skip: 'topic' | 'tier' | 'month' | 'cited' | null) */
export function matches(item, state, skip = null) {
  if (skip !== 'topic' && state.topic !== 'all' && item.topic !== state.topic) return false;
  if (skip !== 'tier' && state.tiers.length && !state.tiers.includes(item.tier)) return false;
  if (skip !== 'month' && state.month && item.month !== state.month) return false;
  if (skip !== 'cited' && state.cited && !(item.sources > 0)) return false;
  const q = state.query.trim().toLowerCase();
  if (q && !(item.text || '').toLowerCase().includes(q)) return false;
  return true;
}

/** The items that pass, in display order: original order, or most sources first. */
export function visible(items, state) {
  const shown = items.filter((p) => matches(p, state));
  const index = new Map(items.map((p, i) => [p, i]));
  return state.sort === 'src'
    ? shown.sort((a, b) => (b.sources || 0) - (a.sources || 0) || index.get(a) - index.get(b))
    : shown;
}

/** How many items a row of `group` would show, given the OTHER groups' filters. */
export function facetCount(items, state, group, test) {
  let n = 0;
  for (const p of items) if (matches(p, state, group) && test(p)) n++;
  return n;
}

/** Is anything narrowing the list? (Sort order is not a filter.) */
export const isFiltered = (s) => s.topic !== 'all' || s.tiers.length > 0 || !!s.month || s.cited || s.query.trim() !== '';

/** Query string → state. Unknown keys are ignored. */
export function readQuery(search, initialTopic = 'all') {
  const q = new URLSearchParams(search);
  return {
    topic: q.get('topic') || initialTopic,
    tiers: (q.get('tier') || '').split(',').filter(Boolean),
    month: q.get('month') || null,
    cited: q.get('cited') === '1',
    query: q.get('q') || '',
    sort: q.get('sort') === 'src' ? 'src' : 'new',
  };
}

/** State → query string, without the "?" and with defaults left out. */
export function toQuery(state) {
  const q = new URLSearchParams();
  if (state.topic !== 'all') q.set('topic', state.topic);
  if (state.tiers.length) q.set('tier', state.tiers.join(','));
  if (state.month) q.set('month', state.month);
  if (state.cited) q.set('cited', '1');
  if (state.query.trim()) q.set('q', state.query.trim());
  if (state.sort !== 'new') q.set('sort', state.sort);
  // A comma needs no escaping in a query string, and ?tier=A,C reads better than %2C.
  return q.toString().replace(/%2C/g, ',');
}

const X = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>';

/**
 * Enhance one panel. Returns { state, set } or null when the panel or its list is missing.
 * opts.onChange(state, shownCount) is called after every render.
 */
export function initFilter(root, opts = {}) {
  if (!root || root.dataset.filterReady) return null;
  const list = document.querySelector(root.dataset.target || '.ui-postlist');
  if (!list) return null;
  root.dataset.filterReady = 'true';
  const noun = root.dataset.noun || 'items';
  const items = [...list.children].filter((el) => el.dataset.topic !== undefined || el.dataset.date !== undefined).map((el) => ({
    el,
    topic: el.dataset.topic || '',
    tier: el.dataset.tier || '',
    month: (el.dataset.date || '').slice(0, 7),
    sources: Number(el.dataset.src || 0),
    text: el.textContent,
  }));
  const total = items.length;
  const $ = (s) => root.querySelector(s);
  const $$ = (s) => [...root.querySelectorAll(s)];
  const empty = document.querySelector('[data-filter-empty]');
  const chips = document.querySelector('[data-filter-chips]');
  const heading = document.querySelector('[data-filter-heading]');
  const search = $('[data-search]');

  document.querySelectorAll('[data-filter-js]').forEach((n) => (n.hidden = false));

  const state = readQuery(location.search, root.dataset.initialTopic || 'all');
  const set = (patch) => { Object.assign(state, patch); render(); };
  const reset = () => { if (search) search.value = ''; set({ ...emptyState(), sort: state.sort }); };

  // A topic row is a link without this script; with it, the link acts as a toggle button.
  $$('[data-topic]').forEach((b) => {
    if (b.tagName === 'A') b.setAttribute('role', 'button');
    b.addEventListener('click', (e) => { e.preventDefault(); set({ topic: b.dataset.topic }); });
    b.addEventListener('keydown', (e) => { if (e.key === ' ') { e.preventDefault(); set({ topic: b.dataset.topic }); } });
  });
  $$('[data-tier]').forEach((b) => b.addEventListener('click', () => {
    const t = b.dataset.tier;
    set({ tiers: state.tiers.includes(t) ? state.tiers.filter((x) => x !== t) : [...state.tiers, t] });
  }));
  $$('[data-month]').forEach((b) => b.addEventListener('click', () => set({ month: state.month === b.dataset.month ? null : b.dataset.month })));
  $$('[data-sort]').forEach((b) => b.addEventListener('click', () => set({ sort: b.dataset.sort })));
  $('[data-cited]')?.addEventListener('click', () => set({ cited: !state.cited }));
  if (search) { search.value = state.query; search.addEventListener('input', () => set({ query: search.value })); }
  document.querySelectorAll('[data-filter-reset]').forEach((b) => b.addEventListener('click', reset));

  // Histogram heights are a share of the fullest month in the WHOLE list, so a bar's
  // height means the same thing whatever else is selected.
  const monthMax = Math.max(1, ...$$('[data-month]').map((b) => items.filter((p) => p.month === b.dataset.month).length));
  const label = (sel) => $(sel)?.dataset.label || '';

  function render() {
    $$('[data-topic]').forEach((b) => {
      const t = b.dataset.topic;
      const n = facetCount(items, state, 'topic', (p) => t === 'all' || p.topic === t);
      const on = state.topic === t;
      b.setAttribute('aria-pressed', String(on));
      b.removeAttribute('aria-current');
      b.classList.toggle('is-empty', !n && !on);
      const c = b.querySelector('.ui-facet__count');
      if (c) c.textContent = String(n);
      b.style.setProperty('--share', String(total ? n / total : 0));
    });
    $$('[data-tier]').forEach((b) => {
      const n = facetCount(items, state, 'tier', (p) => p.tier === b.dataset.tier);
      b.setAttribute('aria-pressed', String(state.tiers.includes(b.dataset.tier)));
      b.classList.toggle('is-empty', !n);
      const c = b.querySelector('.ui-tier__count');
      if (c) c.textContent = String(n);
    });
    $$('[data-month]').forEach((b) => {
      const n = facetCount(items, state, 'month', (p) => p.month === b.dataset.month);
      b.setAttribute('aria-pressed', String(state.month === b.dataset.month));
      b.style.setProperty('--share', String(n / monthMax));
      const c = b.querySelector('[data-month-count]');
      if (c) c.textContent = String(n);
      b.setAttribute('aria-label', `${b.dataset.label || b.dataset.month}, ${n} ${noun}`);
    });
    $$('[data-sort]').forEach((b) => b.setAttribute('aria-pressed', String(state.sort === b.dataset.sort)));
    const cited = $('[data-cited]');
    if (cited) {
      cited.setAttribute('aria-pressed', String(state.cited));
      const c = cited.querySelector('.ui-check__count');
      if (c) c.textContent = String(facetCount(items, state, 'cited', (p) => p.sources > 0));
    }

    const shown = visible(items, state);
    const keep = new Set(shown);
    items.forEach((p) => (p.el.hidden = !keep.has(p)));
    shown.forEach((p) => list.appendChild(p.el));
    const tally = $('[data-filter-tally]');
    if (tally) {
      const b = document.createElement('b');
      b.textContent = String(shown.length);
      tally.replaceChildren(b, ` / ${total} ${noun}`);
    }
    if (empty) empty.hidden = shown.length > 0;

    const active = [];
    if (state.topic !== 'all') active.push([label(`[data-topic="${CSS.escape(state.topic)}"]`) || state.topic, () => set({ topic: 'all' })]);
    state.tiers.forEach((t) => active.push([`Tier ${t}`, () => set({ tiers: state.tiers.filter((x) => x !== t) })]));
    if (state.month) active.push([label(`[data-month="${CSS.escape(state.month)}"]`) || state.month, () => set({ month: null })]);
    if (state.cited) active.push([cited?.dataset.label || 'Cites sources', () => set({ cited: false })]);
    if (state.query.trim()) active.push([`“${state.query.trim()}”`, () => { if (search) search.value = ''; set({ query: '' }); }]);
    if (chips) {
      chips.replaceChildren(...active.map(([text, remove]) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'ui-chip';
        b.setAttribute('aria-label', `Remove filter: ${text}`);
        b.innerHTML = `<span></span>${X}`;
        b.firstChild.textContent = text;
        b.addEventListener('click', remove);
        return b;
      }));
      if (active.length) {
        const c = document.createElement('button');
        c.type = 'button';
        c.className = 'ui-chips__clear';
        c.textContent = 'Clear all';
        c.addEventListener('click', reset);
        chips.appendChild(c);
      }
    }
    if (heading) heading.textContent = active.length ? (heading.dataset.filtered || heading.textContent) : (heading.dataset.default || heading.textContent);

    // A feed for the view: the topic's own feed when exactly one topic is selected.
    const feed = $('[data-filter-feed]');
    if (feed) feed.href = state.topic !== 'all' ? `${feed.dataset.base || '/blog/topics/'}${state.topic}/feed.xml` : (feed.dataset.all || '/blog/feed.xml');

    const qs = toQuery(state);
    history.replaceState(null, '', location.pathname + (qs ? `?${qs}` : '') + location.hash);
    opts.onChange?.(state, shown.length);
  }

  render();
  return { state, set, reset };
}

/** Enhance every [data-ui-filter] on the page. Safe to call again. */
export function init() {
  document.querySelectorAll('[data-ui-filter]').forEach((n) => initFilter(n));
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
}
