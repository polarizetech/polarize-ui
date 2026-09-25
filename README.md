# polarize-ui

**[Live Storybook →](https://polarizetech.github.io/polarize-ui/)** · [Releases](https://github.com/polarizetech/polarize-ui/releases)

The design system behind [Polarize](https://polarize.tech)'s research tools. It is built for
interfaces that show scientific data honestly: every measured, modelled or speculative value
carries a label, and the label can never be hidden.

> **A label may never be hidden. Its explanation must be.**

It comes in two forms that share one set of tokens:

- **Zero-build CSS + custom elements** — link a stylesheet, no npm, no bundler.
- **React** — shadcn/ui components on the same theme, plus publication layouts, evidence
  badges and [visx](https://visx.airbnb.tech/) charts.

## What is in it

### Science: the charts and analysis views (the point of the library)

| | |
|---|---|
| **Charts** | `LineChart`, `BarChart`. A threshold is drawn on the axes it judges, a log axis says so in its label, thinning a trace for display is printed on the panel, and a shared or independent y-scale across panels is declared. |
| **Signals** | `Heatmap` (spectrograms, time–frequency maps, comodulograms) on a one-hue magnitude ramp with a colour bar, hover readout, and counted clipping. `Waveform` with marked regions. |
| **Statistics** | `NullDistribution` and `nullTest()`: an observed statistic against its surrogate or permutation null, with the permutation p printed with its count, z beside it, and a warning when p is at its floor. |
| **Evidence** | `Tier` (a MEASURED / PREDICTED / REFUTED badge that can't be hidden), `Value` (measured and predicted never styled alike), `Readout` (figures with their source), and `Note` + `DocsProvider` (explanations in a drawer). |

Source: `src/science/`. Every view is in the [live Storybook](https://polarizetech.github.io/polarize-ui/) under **Science**.

### General UI

| | |
|---|---|
| `tokens.json` | The single source of truth: colour, type, spacing, the tier ladder, a colour-blind-validated categorical palette and a one-hue sequential ramp. |
| `design.css` + `design.js` | The zero-build form, generated from the tokens: link it and set `<body class="ui">`. Custom elements: `<ui-tier>`, `<ui-note>`, `<ui-docs>`. |
| `publication.css` | Layouts for a research blog: sidebar shell, post list, article, prose, source cards, citations, claims, references, pager, footer. React versions render the same classes. |
| `specimens.css` | Field-guide style illustrations drawn in theme colours ([`SPECIMEN-ICONS.md`](SPECIMEN-ICONS.md)). |
| `src/components/` | shadcn/ui components restyled to the type rules, typography (`Display`, `Eyebrow`, `Standfirst`), the publication layouts and `Specimen`. |
| `fonts/`, `icons/` | Self-hosted Instrument Serif, Inter, IBM Plex Mono, Literata (OFL) and a Phosphor icon sprite (MIT). |

## Using it

**It is not published to npm.** If there is enough interest we will happily turn it into a
proper npm package. Until then, use it straight from this repository, **always pinned to a
release tag**, or fork or clone it and make it your own.

### In a React app (Vite + Tailwind v4)

```bash
npm install github:polarizetech/polarize-ui#v0.5.2     # or: yarn add github:polarizetech/polarize-ui#v0.5.2
```

```css
/* your app's main stylesheet */
@import "tailwindcss";
@import "tw-animate-css";
@import "@polarizetech/polarize-ui/theme.css";
@source "../node_modules/@polarizetech/polarize-ui/src";
```

```tsx
import { Heatmap, NullDistribution, LineChart, Tier, Button } from "@polarizetech/polarize-ui/react"
```

- The package ships TypeScript source and your bundler compiles it; there is no build step
  here. It is type-checked with `noUnusedLocals`/`noUnusedParameters` on, so it compiles
  under strict app settings.
- Dark mode is a `.dark` class on `<html>`.
- Importing from `/react` also loads the self-hosted fonts.

### In a plain HTML page

Add it as a git submodule pinned to a tag, and link the files:

```bash
git submodule add https://github.com/polarizetech/polarize-ui.git design
git -C design checkout v0.5.2
```

```html
<link rel="stylesheet" href="design/design.css">
<link rel="stylesheet" href="design/publication.css">   <!-- optional: blog layouts -->
<script type="module" src="design/design.js"></script>
<body class="ui">
```

The full wiring guide, including how to serve the fonts, is [`INTEGRATION.md`](INTEGRATION.md).

### Staying up to date

- **Watch → Custom → Releases** on this repository to be told when a new version is out.
  Each release has notes listing what changed.
- To update, change the tag you pin: the `#v…` in your dependency, or
  `git -C design checkout v…` for a submodule.
- Read the release notes before crossing a **minor** version while we are below 1.0 (see
  below).

## Versioning

Releases follow [Semantic Versioning](https://semver.org/). While the version is **below
1.0.0**, the rule is the one npm applies to `0.x` versions:

| bump | below 1.0.0 | from 1.0.0 on |
|---|---|---|
| **patch** (`0.5.2 → 0.5.3`) | never breaking | never breaking |
| **minor** (`0.5.x → 0.6.0`) | **may be breaking**: read the release notes | new features, never breaking |
| **major** | — | breaking |

**Covered by that promise (the public API):**

- everything exported from `@polarizetech/polarize-ui/react`, and its props;
- the stylesheet entry points (`design.css`, `publication.css`, `specimens.css`, `theme.css`)
  and the `ui-*` class names and modifiers they define;
- the CSS custom properties (`--background`, `--space-4`, `--tier-measured`, …) and the
  keys in `tokens.json`;
- the custom elements in `design.js` and their attributes.

**Not covered:** exact colour values and spacing (a tweak is a patch release, not a breaking
change), the stories, the build scripts, and anything under `.storybook/` or `.github/`.

Removing or renaming anything in the public API always produces a breaking bump:
`scripts/api_surface.py` lists that surface, and the release workflow compares it with the
previous release. What was removed is listed at the top of the release notes. Changes it
cannot see, such as a prop's type or a component's behaviour, have to be marked by whoever
makes them, and the contributor guidance ([`AGENTS.md`](AGENTS.md)) requires it.

Every push to `main` is released automatically by
[`.github/workflows/release.yml`](.github/workflows/release.yml), which applies these rules:
a commit whose subject has `!:` (for example `refactor!: rename Label to Eyebrow`) or a
`BREAKING CHANGE:` line produces a breaking bump, and anything else produces a patch. Setting
the version in `package.json` by hand always wins.

## Working on it

```bash
npm install
npm run storybook        # http://localhost:6006
python3 dev_check.py     # tokens, contrast, the type rule, generated-file drift
```

Edit `tokens.json`, never `design.css`; regenerate with `python3 build_css.py` and
`python3 shadcn/build_shadcn.py`. `src/` uses relative imports only. An `@/` import would
resolve against the consuming app's alias, and `dev_check.py` rejects it. The shadcn CLI writes
`@/` imports, so rewrite them after `npx shadcn add`.

The Storybook's own interface follows the viewer's light or dark setting, and so does its
**Theme** toolbar button. The MCP add-on (`@storybook/addon-mcp`) lets coding agents find the
components and their stories.

### Where it is used

These Polarize repos track new releases automatically. A daily workflow in each one moves
its pin to the newest tag, runs that repo's own checks, and commits and deploys only if
they pass.

| repo | pin | gate before it commits |
|---|---|---|
| polarizetech/polarize.tech | `design/` submodule | `check_design.py`, `validate_posts.py` |
| joshuaanderton/joshuaanderton.ca | `package.json` git dependency | `tsc -b && vite build`, then the Pages deploy |
| polarizetech/audio-projects | `tools/design` submodule | `tools/design/dev_check.py` |

Background and design decisions: [`CLAUDE.md`](CLAUDE.md). React specifics:
[`shadcn/SHADCN.md`](shadcn/SHADCN.md).

## Licence

Code: MIT (see [`LICENSE`](LICENSE)). Fonts: SIL Open Font License, texts in `fonts/`.
Icons: Phosphor, MIT.
