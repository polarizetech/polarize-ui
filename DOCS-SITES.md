# Docs sites: documenting an existing tool or repository

How to give an existing library, tool or repository a documentation site built on polarize-ui's
**docs layer** (`docs.css` + `docs.js`, React: `src/components/docs.tsx`). The layer supplies the
page; the repository supplies a small generator that reads what the code already says about itself.

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

## Implementation plan for an existing repository

Budget: a day for the first version of a mid-sized Python or TypeScript repository.

**1. Decide where it lives and who may see it.** The generator and example files live **inside
the repository they document** (`site/`), so a code change and its docs change land in one
commit. The built output (`site/dist/`) is not committed. **A private repository gets a private
site:** serve it locally or behind access control, never on a public host, and never put its
content into a public repository (this one included).

**2. Pin polarize-ui.** Fetch `design.css`, `design.js`, `tokens.json`, `publication.css`,
`landing.css`, `docs.css`, `docs.js`, `cellfield.js` and `fonts/` from a **release tag** (as
every consumer of this library does; see README § Versioning), with an environment override to a
local checkout for developing polarize-ui itself. Copy them into `dist/assets/` at build time.

**3. Inventory what the repository already says about itself.** List the catalogue or
manifest, the package docstrings or READMEs, the public API, and the long-form docs worth
rendering (a contract, a changelog). Anything that has no source yet is a gap to fix in the
code, not a paragraph to write on the site.

**4. Write the reader.** Stdlib only where possible:
- the catalogue → one page per package, including packages that live in other repositories
  (shown as catalogue-only, with a callout);
- source → API entries (`.ui-apientry`: kind, name, signature, summary, full docstring behind a
  disclosure, a link to the source line);
- imports → a "uses from core" list linking to the core's own API anchors;
- Markdown → HTML with a small renderer that escapes everything it does not recognise.

**5. Register datasets, then write two or three examples per package.** Start with the function
a new user would call first. Prefer one dataset reused across packages to many.

**6. Render pages with the docs layer.** Markup contract:

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

**7. Build a search index** (`[{t, s, h, k}]`: title, summary, href, kind) covering packages,
modules, functions, examples and datasets.

**8. Check it.** Build with a cold cache; every example passes or is visibly failed. Click
through in light and dark and at phone width. Search for a function by its short name.

**9. Hand it over.** A `site/README.md` with the build command, what each page is generated
from, and how to add an example.

**10. Extract later, not first.** The generator stays in its repository until a second
repository needs one. Then the generic parts (page shell, Markdown renderer, example harness)
move somewhere shared, because the second consumer is what shows which parts are generic.

## Reference implementation

The first site built this way documents a private Python library and its extensions; its
generator is `site/build.py` in that repository. It is not linked here because the repository is
private.
