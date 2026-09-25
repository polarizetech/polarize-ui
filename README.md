# polarize-ui

The design system behind Polarize's research tools. It is built for interfaces that show
scientific data honestly: every measured, modelled or speculative value carries a label, and
the label can never be hidden.

- **`tokens.json`** — the single source of truth: colour, type, spacing, the epistemic tier
  ladder, and a colour-blind-validated chart palette.
- **`design.css`** — generated from the tokens by `build_css.py`. Link it and set
  `<body class="ui">`; no build step, no CDN.
- **`design.js`** — custom elements: `<ui-tier>` (an always-visible evidence badge),
  `<ui-note>` / `<ui-docs>` (explanations in a documentation drawer), tooltips.
- **`publication.css`** — components for a research blog: sidebar shell, post list,
  article, prose, inline source cards, citations, claims, references, parts, pager, form,
  footer. Load after `design.css`; the React versions (`Shell`, `PostList`, `Article`,
  `Source`, `References`, …) render the same classes.
- **`shadcn/`** — the generated shadcn/ui theme (from `tokens.json`) and the React `<Tier>`.
- **`src/`** — the React library: shadcn/ui components (restyled to the type rules), `<Tier>`,
  `<Note>` + `<DocsProvider>` (the documentation drawer, replacing `<ui-note>`/`<ui-docs>`),
  `<Hint>`, `<Value>`, `<Readout>`, `<Display>`/`<Label>`/`<Standfirst>`, and visx charts —
  `<LineChart>`, `<BarChart>`, `<Waveform>`.
- **`specimens.css`, `src/specimens.ts`** — specimen icons: field-guide style illustrations
  (`<Specimen name="bee" />`) drawn in theme colours. How to draw more: `SPECIMEN-ICONS.md`.
- **`fonts/`, `icons/`** — self-hosted Instrument Serif, Inter, IBM Plex Mono, Literata (OFL)
  and a Phosphor icon sprite (MIT).

## The rule

> **A label may never be hidden. Its explanation must be.**

## Storybook

```bash
npm install
npm run storybook        # http://localhost:6006
```

Use the Theme toolbar to switch between `instrument` (default), `polarize`, and the classic
light/dark themes. The MCP add-on (`@storybook/addon-mcp`) lets coding agents discover the
components and their stories.

## React

In an app that already runs Vite + Tailwind v4:

```bash
yarn add github:polarizetech/polarize-ui#v0.4.0
```

```css
/* your app's main stylesheet */
@import "tailwindcss";
@import "tw-animate-css";
@import "@polarizetech/polarize-ui/theme.css";
@source "../node_modules/@polarizetech/polarize-ui/src";
```

```tsx
import { Shell, PostList, Article, Button, Tier, LineChart } from "@polarizetech/polarize-ui/react"
```

- The package ships TypeScript source; Vite compiles it. There is no build step here yet.
- `src/` uses **relative imports only** — an `@/` import would resolve against the
  consuming app's alias and pick up its components. `dev_check.py` enforces this. The shadcn
  CLI writes `@/` imports, so rewrite them after `npx shadcn add`.
- Dark mode is a `.dark` class on `<html>`.
- Chart rules, carried from the zero-build `tools/chart`: a threshold is drawn on the axes it
  judges; a log axis says so in its label and refuses a non-positive domain; decimation is
  printed on the panel; colour is a theme token, never a literal.

## Using it from another repo

- **As a git submodule** (how the `audio-projects` monorepo consumes it, at `tools/design`):
  `git submodule add https://github.com/polarizetech/polarize-ui.git tools/design`
- **As an npm dependency, pinned to a tag or commit:**
  `npm install github:polarizetech/polarize-ui#v0.1.0`

Wiring a zero-build page in: [`INTEGRATION.md`](INTEGRATION.md). React projects:
[`shadcn/SHADCN.md`](shadcn/SHADCN.md). Background and design decisions:
[`CLAUDE.md`](CLAUDE.md).

## Releases and consumers

Every push to `main` that passes the checks is tagged automatically
(`.github/workflows/release.yml`): the patch number goes up by one, unless you bumped
`package.json`'s version yourself (for a minor or major release), in which case that
version is tagged.

Each consuming repo runs a `polarize-ui` workflow hourly (or on demand from its Actions
tab) that moves its pin to the newest tag, runs its own checks, and commits + deploys
only if they pass:

| repo | pin | gate before it commits |
|---|---|---|
| polarizetech/polarize.tech | `design/` submodule | `check_design.py`, `validate_posts.py` |
| joshuaanderton/joshuaanderton.ca | `package.json` git dependency | `tsc -b && vite build`, then the Pages deploy |
| polarizetech/audio-projects | `tools/design` submodule | `tools/design/dev_check.py` |

A breaking change fails the consumer's gate, so nothing is pushed there and GitHub
emails you about the failed run.

## Checks

```bash
python3 dev_check.py     # tokens, contrast, the type rule, generated-file drift
```

Edit `tokens.json`, never `design.css`; run `python3 build_css.py` and
`python3 shadcn/build_shadcn.py` to regenerate.

## Licence

Code: MIT (see `LICENSE`). Fonts: SIL Open Font License, texts in `fonts/`. Icons: Phosphor, MIT.
