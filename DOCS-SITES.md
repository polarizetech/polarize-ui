# Docs sites: documenting an existing tool or repository

How to give an existing library, tool or repository a documentation site built on polarize-ui's
**docs layer** (`docs.css` + `docs.js`, React: `src/components/docs.tsx`).

**This repository holds the look only.** The tooling that reads a repository and generates its
site, and the GitHub workflow that keeps it up to date, live in
**[automatic-documentation-site](https://github.com/polarizetech/automatic-documentation-site)**:

```bash
pip install "git+https://github.com/polarizetech/automatic-documentation-site@v0.1.0"
docsite init path/to/repo --write     # docs-site.toml + the workflow
docsite build path/to/repo
```

It reads Markdown (a text-only repository needs nothing else), Python, TypeScript/JavaScript and
Swift source, a JSON catalogue, and stories run at build time. Its
[`docs/ONBOARDING.md`](https://github.com/polarizetech/automatic-documentation-site/blob/main/docs/ONBOARDING.md)
is the procedure to follow. polarize-ui itself is documented with Storybook, not with it.

What follows is the reasoning behind that tool and the markup contract it writes against, for
anyone building a generator of their own or changing the layer.

The shape is the familiar docs site (Tailwind's Syntax and Protocol templates are the reference):
a top bar with search, a left nav, an "on this page" column, a home page with a hero and package
cards, and per-package pages with examples and an API reference. The surface is polarize-ui's
landing style: hairline `--border-strong` rules, `--radius-xs` cards, 2px chips, no shadows, and a
code window that is dark in both themes.

## The principle: generated, not maintained

A docs site that is written by hand drifts from the code within weeks. So **nothing on the page
is typed in by hand.** Every section names its source, and the fix for a wrong page is to fix
that source:

| On the page | Comes from |
|---|---|
| the list of packages, versions, one-line jobs | the repository's own catalogue or manifest (`catalog.json`, `pyproject.toml`, `package.json`, a workspace file) |
| a package's overview | its module docstring or README |
| the API reference | public functions and classes, read from source (Python: `ast`; TS: the compiler API or `.d.ts`) without importing or executing anything |
| "uses from core" | the package's actual imports, read the same way |
| examples | small example files in the repository, **run at build time** |
| dataset licences and citations | one registry file the examples load data through |

A few things are captured by running code at build time (an example's output, a
`discover()`-style listing). They are labelled as captured output, with the version they ran on.

## The examples ("stories")

An example is **one real call on one dataset**, shown three ways from a single function so they
cannot disagree:

1. **Code.** The example function's own source, shown as written, is the usage snippet. Imports
   it uses are prepended; page-layout plumbing (the final `return view(...)`) is hidden.
2. **Input.** What went in, drawn as a plot, with a dataset chip carrying the licence.
3. **Output.** What came back, as plots, tables and verdict lists (docs.js `renderPlot` specs),
   plus a row of headline facts and the raw result behind a disclosure.

Rules:

- **Data is public and licensed, or synthetic.** Never a recording of a person made by the
  project, never unpublished data. Every dataset is registered once with its provider,
  version, licence, DOI and citation, and examples load data only through that registry, so the
  attribution chip and the Datasets page cannot drift from the data.
- **Pick data where the answer is known in advance** (a frequency-tagged stimulus, a textbook
  signal, a synthetic truth). An example is then a check as well as a demonstration.
- **A failing example stays on the page**, labelled EXAMPLE FAILED with its traceback
  (`.ui-example__error`). It is never dropped, because a missing example reads as "there is no
  such feature".
- **A verdict is always a word** (`present`, `absent`, `unavailable`), coloured only as
  reinforcement (`.ui-verdicts__word`). `unavailable` and `absent` are different words.
- **Cache by the example's full source + package version + core version**, so an unchanged
  example does not rerun and a changed one always does. Never cache a failure.
- Decimate long traces for display in the generator, and say so on the page.

## The markup contract

The procedure itself (inventory, config, stories, checks, workflow, hand-over) is
automatic-documentation-site's `docs/ONBOARDING.md`. This is what a generator writes:

```html
<body class="ui ui-docsite">
  <header class="ui-docsite__bar">…brand (.ui-brand), search button [data-ui-search-open],
    theme toggle [data-ui-theme-toggle], nav toggle [data-ui-nav-toggle]…</header>
  <div class="ui-docsite__shell">           <!-- add --wide on pages with no TOC -->
    <nav class="ui-docsite__nav">…</nav>
    <main class="ui-docsite__main">…</main>
    <aside class="ui-docsite__toc">…</aside>
  </div>
  <div class="ui-docsearch" data-ui-search="assets/search.json" hidden>…</div>
  <script type="module" src="assets/docs.js"></script>
</body>
```

An example: `.ui-example` > `.ui-example__head` + `.ui-example__grid` (a `.ui-codewin` and a
`.ui-example__io[data-ui-tabs]` whose body carries `data-ui-plots='{"output":[…],"input":[…]}'`)
+ `.ui-facts`. The plot spec format is documented in `docs.js` and typed in `docs.d.ts`. The
Storybook page **General UI / Docs** shows every piece; the React components render the same
classes.

The search index is a JSON array of `{t, s, h, k}` (title, summary, href, kind) named by
`data-ui-search` on the palette.

## Reference implementation

[automatic-documentation-site](https://github.com/polarizetech/automatic-documentation-site)
documents itself with itself; its `docs-site.toml` and `.github/workflows/` are the worked
example.
