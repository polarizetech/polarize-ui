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
- **`shadcn/`** — a generated shadcn/ui theme and a React `<Tier>` for Vite + React projects.
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
