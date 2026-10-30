Polarize UI is a design system for interfaces that show scientific data honestly. Every measured, modelled or speculative value carries a label, and the label can never be hidden.

> A label may never be hidden. Its explanation must be.

## Principles

- Keep tier badges, MEASURED/PREDICTED styling, units and verdicts inline, always. Move the explanation (why that tier, how it was measured, provenance) into a `ui-note` drawer.
- Never put a tier badge behind a disclosure. Never give `measured` and `predicted` the same colour, weight or style: measured values are upright, predicted values are italic.
- An invented value with no source wears `spec` and the word `TASTE` or `ADDED`. Never render it as derived.
- Do not force reuse. A one-off control belongs in its project; centralise only surfaces, type, tier badges, disclosure, tabs, cards, tables and chart palettes.

## Content fundamentals

- Write plainly and hedge precisely: "MODELLED, chosen by ear, not measured." State n, units and scope next to a number.
- Tier words are uppercase mono: `MEASURED`, `PREDICTED`, `MODELLED`, `EXPLORATORY`, `SPEC`, `ADDED`, `TASTE`, `REFUTED`. Letter tiers are `[A]`, `[B]`, `[C]`, `[SPEC]`.
- A REFUTED badge carries its scope, reason and cheapest probe in the drawer.
- No emoji, no exclamation marks, no marketing voice.

## Visual foundations

- **Themes.** Default is `instrument` (light) with `instrument-dark` under `prefers-color-scheme`. Set `data-theme` to pin one: `instrument`, `instrument-dark`, `polarize` (warm dark, clay accent), `fieldguide` / `fieldguide-dark` (magenta accent, Geist body). Pinning `polarize` keeps the pre-Instrument look.
- **Type: a triad.** Headings in `display-1/2/3` (Instrument Serif, regular case only, never uppercased). Running text in `text-base` (Inter 14px). Any uppercase text, any caption or eyebrow, uses `label` (IBM Plex Mono). The case rule: uppercase is always mono, the serif is never uppercased.
- **Inter is never bold and never tracked.** Hierarchy comes from size, face, colour and case, not weight. `<strong>` is marked by `foreground` ink inside `muted-foreground` copy.
- **Structure.** Use hairlines (`border`, `border-strong`) and whitespace, not boxes or shadows. Pad cards with `space-4`, radius `radius-base`.
- **One accent.** Use `accent` for the single dominant action per view; `ring` for a 2px solid focus outline.
- **Colour axes never mix.** Tier colours (`measured`, `predicted`, `exploring`, `spec`, `refuted`) mean evidence quality only. Chart series use `series-1`..`series-8` in fixed order; only the first three are safe when every pair is compared. Magnitude uses the one-hue `sequential-*` ramp. In the Polarize theme, `clay` = signal, `ochre` = human annotation, `lichen` = machine state.
- **Colour-blind safety.** Every badge carries a word and a glyph as well as a colour: `◆` measured, `▲` predicted, `●` exploring, `◇` spec, `✕` refuted.
- **Motion.** 120/200/320 ms with `cubic-bezier(.2,.7,.3,1)`; everything honours `prefers-reduced-motion`.
- **Spacing** is a 4px scale (`space-1`..`space-9`); radii are `radius-xs`..`radius-pill`.

## Iconography

Phosphor Icons (duotone, MIT) as a self-hosted SVG sprite, inlined once by `design.js`, referenced as `<svg class="ui-icon"><use href="#ph-play"/></svg>`. Fifteen icons are in use (play, pause, stop, skip, repeat, waveform, gauge, bookmark and similar). The sprite is not part of this file set; take it from the repo's `icons/polarize-icons.svg`.

## Using it

- **Zero-build:** link `design.css`, load `design.js` as a module, set `<body class="ui">`. Components are `ui-*` classes plus `<ui-tier>`, `<ui-note>`, `<ui-docs>`. Hardware-style controls (knob, faders, timeline, lane, panner) are in `controls.css` + `controls.js`.
- **React:** shadcn/ui on the same theme (`shadcn/theme.css`, `tier.tsx`), plus publication layouts, evidence badges and visx charts. Do not load `design.css` and `shadcn/theme.css` in one document; both define `--accent`.
- **Versioning:** the package is public and released on every push to `main`; a patch release never breaks consumers. Renaming or removing a class, token, prop or export is breaking and must be marked.
- Package: `@polarizetech/polarize-ui`. Source: github.com/polarizetech/polarize-ui.
