# shadcn/ui — ready to adopt, adopted nowhere

**Status: prepared, not installed.** No project's `package.json` was touched. This folder makes
[shadcn/ui](https://ui.shadcn.com/) adoptable by the build-based projects here in four steps,
with the palette **generated** from `tokens.json` rather than copied.

```bash
python3 tools/design/shadcn/build_shadcn.py           # regenerate
python3 tools/design/shadcn/build_shadcn.py --check   # fail on drift (runs in dev_check.py)
```

## Why now

`tools/design/CLAUDE.md` has always said shadcn is the obvious answer and is not used here,
because almost every project is deliberately zero-build. It also named the trigger:

> *Revisit if a second build-based app appears.*

**Four now exist**, so the trigger has fired:

| project | React | Tailwind | use |
|---|---|---|---|
| `neuron-transcription-factors` | 19 | **v4** | `theme.css` |
| `salamander-tail` | 19 | **v3** | `theme.tailwind-v3.css` |
| `global-biocommunication-visualizer` | 18 | none yet | add Tailwind first |
| `tree-signal-reader-v1` | 18 | none yet | add Tailwind first |

That doc is also stale: it still calls `biome-soundscape-designer` "the one Vite + React project
here", and that project is archived.

**This does not change the zero-build rule.** ~20 projects stay vanilla ES modules + `design.css`.
Nothing here is a step toward npm in those.

## ⚠ The one thing that will bite you: `--accent` means two different things

| | `--accent` is |
|---|---|
| `tools/design` | the **brand teal** (`#0d6d6b` / `#5fd0c6`) — the same value as `--ring` |
| shadcn/ui | the **muted hover surface** behind menu items and list rows |

Map them by name and every hover state becomes saturated teal — it looks deliberate, and it is
not. So the bridge sends the brand colour to **`--primary`** (where shadcn puts a brand colour)
and gives `--accent` the subtle surface it expects.

**Measured, not assumed:** with `--primary-foreground` taken from the theme background, contrast
is **5.69:1** light and **10.04:1** dark — both clear WCAG AA.

**Consequence: do not load `design.css` and `theme.css` in the same document.** Both define
`--accent` at `:root` with different meanings and the loser is silent. In practice this costs
nothing — `design.css` exists to give zero-build projects custom elements, and a React project
takes shadcn components instead.

## Adopt it (four steps)

**1.** Copy the config and theme into the project:

```bash
cp tools/design/shadcn/components.json           projects/<p>/
cp tools/design/shadcn/theme.css                 projects/<p>/src/design-theme.css   # Tailwind v4
# or, for Tailwind v3:
cp tools/design/shadcn/theme.tailwind-v3.css     projects/<p>/src/design-theme.css
cp tools/design/shadcn/tier.css                  projects/<p>/src/
cp tools/design/shadcn/tier.tsx                  projects/<p>/src/components/
```

Copying is right here — shadcn's own model is copy-in components you then own. What must **not**
be copied is the palette, which is why it is generated.

**2.** Import the theme first in `src/index.css`, then Tailwind:

```css
@import "./design-theme.css";
@import "./tier.css";
@import "tailwindcss";           /* v4 */
```

**3.** Install and add components — nothing here pins versions, so use the current CLI:

```bash
cd projects/<p>
npx shadcn@latest init      # it will see components.json; keep cssVariables: true
npx shadcn@latest add button card dialog tabs
```

**4.** Use `<Tier>` for anything epistemic. Never a plain `<Badge>`.

```tsx
import { Tier } from "@/components/tier"
<Tier id="MEASURED" />   <Tier id="PREDICTED" />   <Tier id="SPEC" />
```

## What `tier.tsx` is, and why it has no `compact` prop

It is the one component shadcn cannot supply and this monorepo cannot ship a UI without. The
rule from `tools/design`, carried into React unchanged:

> **A label may never be hidden, and its explanation must be.**

`<Tier>` always renders **colour + word + glyph** — all three, every time. Hue is never
load-bearing, so the badge survives colour-blindness and a greyscale screenshot. (Five colours
cannot clear an all-pairs contrast check in any ordering; that is a measured result in
`tools/design/CLAUDE.md`, not a preference.)

There is deliberately **no `compact`, `iconOnly` or `hideLabel` prop.** Adding one re-opens the
exact failure the three-channel rule closes: PREDICTED must never be able to look like MEASURED.
The tier list is generated from `tokens.json`, so a badge vocabulary cannot drift from source.

## Honest status

- **Never rendered.** No project imports any of this; `npx shadcn init` has never been run
  against `components.json`, and `tier.tsx` has never been compiled or seen on a screen. The
  contrast figures are computed from hex, not sampled from a browser.
- **Only the `instrument` theme is bridged** — the current default. `polarize`, `dark` and
  `light` are in `tokens.json` and would each need a `.dark`-style block.
- **No dark-mode toggle.** The files define `.dark`; putting that class on `<html>` is the
  project's job.
- **`components.json` pins `style: new-york` and `lucide` icons** — a default, not a decision.
  `tools/design` ships a self-hosted 15-icon Phosphor sprite, so a project that wants no network
  and no second icon set should say so before running `add`.
- **Versions float.** shadcn is a CLI that copies current source; a component added in six months
  may not match one added today.
