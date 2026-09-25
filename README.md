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
- **`shadcn/`** — the generated shadcn/ui theme (from `tokens.json`) and the React `<Tier>`.
- **`src/`** — the React library: shadcn/ui components (restyled to the type rules), `<Tier>`,
  `<Note>` + `<DocsProvider>` (the documentation drawer, replacing `<ui-note>`/`<ui-docs>`),
  `<Hint>`, `<Value>`, `<Readout>`, `<Display>`/`<Label>`/`<Standfirst>`, and visx charts —
  `<LineChart>`, `<BarChart>`, `<Waveform>`.
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

```tsx
import "@polarizetech/polarize-ui/react.css"   // Tailwind v4 + theme + fonts
import { LineChart, Tier, Note, DocsProvider } from "@polarizetech/polarize-ui/react"
```

Needs a Vite + Tailwind v4 setup and an `@` → `src` alias (see `.storybook/main.ts`). The
package ships TypeScript source for now; there is no compiled build yet.

Chart rules, carried from the zero-build `tools/chart`: a threshold is drawn on the axes it
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

## Checks

```bash
python3 dev_check.py     # tokens, contrast, the type rule, generated-file drift
```

Edit `tokens.json`, never `design.css`; run `python3 build_css.py` and
`python3 shadcn/build_shadcn.py` to regenerate.

## Licence

Code: MIT (see `LICENSE`). Fonts: SIL Open Font License, texts in `fonts/`. Icons: Phosphor, MIT.
