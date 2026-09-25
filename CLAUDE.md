# CLAUDE.md — design

> ## ⛔ READ FIRST: this is a PUBLIC, VERSIONED library (since 2026-09-25)
>
> Every push to `main` is released automatically (`.github/workflows/release.yml`). The
> result is tagged, published on the Releases page, and deployed as the live Storybook.
> People outside Polarize may be pinned to a tag, and so are polarize.tech,
> joshuaanderton.ca and the audio-projects monorepo (they update themselves daily). The
> README makes them a promise: **a patch release never breaks anything.** An unmarked
> breaking change breaks that promise for everyone. So, before you commit:
>
> 1. **Is it breaking?** It is if a consumer's existing code could stop working or change
>    meaning. That includes **renaming or removing** an export, a prop, a `ui-*` class or
>    modifier, a CSS variable, a `tokens.json` key, a custom element or attribute, or a
>    `package.json` entry point. It also includes **changing a prop's type or making it
>    required**, and **changing what an existing prop or class does** (for example a
>    layout change that moves content).
> 2. **If it is breaking, mark the commit.** Either write `!:` in the subject, e.g.
>    `refactor!: rename Label to Eyebrow`, or add a `BREAKING CHANGE: <what and how to
>    migrate>` line to the body. Say in the body how to migrate. That text is what a user
>    reads in the release notes.
> 3. **Prefer not breaking.** Add the new name and keep the old one working (alias,
>    re-export, duplicate class) with a `@deprecated` comment. Remove it in a later,
>    marked release.
> 4. **Adding is never breaking:** a new export, prop (optional), class, variable or
>    token is a patch.
>
> **What the automation catches, and what it does not.** `scripts/api_surface.py` lists
> the public surface. The release workflow compares it with the last tag, and **any
> removal or rename forces a breaking bump** even when the commit is unmarked. A
> hand-set `package.json` version that is too small for a removal fails the release.
> It **cannot** see changed prop types, changed signatures or changed behaviour. Those
> depend entirely on step 2.
>
> **Also:** don't push work in progress to `main` (it ships). Don't move or delete tags
> (consumers are pinned to them). Don't edit the Releases page to say something different
> from what shipped. Full rules for users: `README.md` § Versioning.
>
> After a breaking release, check the consumers' daily `polarize-ui` workflow runs. A
> failed run means that repo needs a migration commit. It is not something to retry.

> ## ⭐ THE DEFAULT IS **INSTRUMENT** (2026-08-19)
>
> Set at the operator's request after the `attend-to-send` briefing page: *"require other projects
> to implement this design."* A project that links `design.css` and sets `<body class="ui">` gets
> it with **zero configuration**.
>
> | Role | Face | Used for |
> |---|---|---|
> | **Display** | **Instrument Serif** | headings only — `.ui-display--1/2/3` |
> | **Body** | **Inter** | all running text |
> | **Label** | **IBM Plex Mono**, uppercase, tracked | eyebrows, kickers, data captions — `.ui-label` |
>
> **⚠ The case rule (operator, 2026-08-20): uppercase text is ALWAYS the mono face, and the
> display serif is NEVER uppercased.** Regular-case headings are the serif; all-caps anything is a
> label and gets the mono. The rule exists because the two used to collide: `.ui-card > h2` set
> `text-transform: uppercase` on whatever heading a card contained, so a `.ui-display` heading in
> a card rendered as uppercase Instrument Serif (first seen on `veil-bypass`'s screening card).
> **And the sans is NEVER BOLD and NEVER TRACKED (same day):** Inter's regular weight is the
> design — hierarchy comes from size, face, colour and case, never from weight. Browser defaults
> were the main leak (plain headings at 700, `<strong>` at bold), so `design.css` resets both to
> 400; `<strong>` keeps its semantics and is marked by full-strength ink inside the muted body
> colour instead of weight. Primary/pressed buttons lost their 600, the header h1 its tracking.
> The mono keeps its 500 and its tracking (a label idiom, not running text); the display serif
> keeps its −.015em optical correction. `dev_check.py` fails any rule outside `@font-face` that
> says 600/700/bold, and any tracked rule that is not mono, uppercase, the display face, or a
> reset.
>
> Now `.ui-card > h2:not(.ui-display)` scopes the uppercase kicker away from display headings,
> `.ui-display` carries an explicit `text-transform: none`, and every `text-transform: uppercase`
> rule in the built CSS (`.ui-table th`, `.ui-tier`, `.ui-drawer__section`, `.ui-eyebrow`, …) sets
> `var(--font-mono)` in the same block — `dev_check.py` walks the built CSS and fails any
> uppercase rule that does not. In the same pass `.ui-standfirst` dropped from `--text-lg` to
> `--text-base`: it differs from running text by colour and measure, not size.
>
> **All three are self-hosted** under `fonts/` with their OFL texts — **76 KB** for the three latin
> subsets. Nothing references a CDN, so the offline-PWA rule still holds. That size is also why
> Inter could finally be vendored: the older note here declined it assuming 100 KB+, and the
> variable latin subset is 48 KB.
>
> **Body and subtitle got SMALLER** in the same pass (`base` 15→14px, `lg` 17→15.5px). Headings
> were deliberately left alone.
>
> **Instrument Serif is a display face** — no optical-size axis, spindly below ~20px.
> `--font-display` is for headings; running text is Inter. `--font-serif` still resolves to
> Literata for a project that genuinely wants a serif for *running* text.
>
> **A project keeps its old look by pinning a theme:** `data-theme="polarize"` (the warm-dark
> 2026-08-04 default) or `data-theme="dark"` (the pre-Polarize slate). Same opt-out `tuning-forks`
> used through the Polarize migration, and it still works.
>
> **Instrument is the first theme here with a real light/dark pair**, so it follows the three-state
> rule: bare `:root` is the complete light palette, the dark half is behind
> `@media (prefers-color-scheme: dark)` guarded with `:root:not([data-theme])`, and both halves are
> reachable by explicit stamp. `dev_check.py` asserts all three states.


**The monorepo's shared design protocol.** One place that defines how every app
here looks and how it presents the enormous amount of honest hedging these
projects carry. Same idea as `tailscale/` (one place for serving) and `sound-fx/`
(one place for audio assets): a project opts in, and stops making its own
decisions.

Tests: `python3 design/dev_check.py`.

---

## The look: Polarize (default theme, 2026-08-04)

**Polarize** is the monorepo's default visual identity as of 2026-08-04 — a
warm-dark adaptation of the Broadsheet design system, handed off as "Polarize
Audio Research System" (a Claude-Design mockup
at handoff time). It replaces gold-accent-on-slate as what a project gets with
**zero configuration**: link `design.css`, set `<body class="ui">`, do nothing
else, and a new project is Polarize.

**What it looks like.** Set in **sans-serif** everywhere, including UI chrome,
buttons and numerals.

> **THE TYPE RULE, for this and every future project (set 2026-08-13 at the
> operator's request):** the default face is **sans-serif**. A new project gets
> it with zero configuration and should not opt out. The stack names **Inter**
> first and falls back through the system stack, so it renders Inter where
> installed and SF Pro on macOS/iOS. A serif token still exists
> (`var(--font-serif)`, self-hosted Literata) for a project that deliberately
> wants one — but no theme uses it as primary any more.
>
> Polarize was serif from 2026-08-04 until then; that is the only thing about it
> that changed. Warm-dark, clay/ochre/lichen and the hairline structure are
> unchanged.
>
> **Inter is NOT vendored.** Shipping it means committing a ~100 KB+ woff2, which
> was not done unasked. The plumbing is proven (Literata is self-hosted exactly
> that way) — drop `inter-variable.woff2` into `fonts/` with its OFL text and add
> an `@font-face` in `build_css.py`. Structure comes from whitespace and hairlines
(`--border`/`--border-strong`), not boxes. Three spot inks, one job each:
**clay** `--clay` (`#c4643c`) for signal/action — the one dominant colour per
view; **ochre** `--ochre` (`#d9a441`) for human annotation only; **lichen**
`--lichen` (`#7d8a63`) for machine state only. These are declared in
`tokens.json`'s `audioInk` block, **separate from `epistemic.families`** —
different semantic axis (UI role vs. evidence quality), never reused for each
other, `dev_check.py` asserts the hex sets don't overlap.

**Self-hosted, not a CDN dependency.** Both new assets are vendored into this
folder specifically so "no network" (earth-heart-beat's offline PWA, `geometry`'s
"no CDN" goal) keeps holding:
- **Font:** the UI face is a **system stack** — nothing to download at all. The
  optional serif is `fonts/literata-{normal-variable,italic-400}.woff2` —
  Literata, OFL-licensed, latin subset, ~131 KB total, used only by
  `var(--font-serif)`. `design.css`'s `@font-face`
  `src: url()` is always a local relative path; `dev_check.py`'s "no webfont or
  CDN" check still passes because it was always checking for `http` in the
  file, and a local path never has one.
- **Icons:** `icons/polarize-icons.svg` — an SVG sprite (`<symbol>` per icon),
  15 Phosphor Icons (duotone, MIT), 8 KB. Not the full icon-font — just the
  icons actually used, per `tokens.json`'s `icons.used` list. `design.js`
  fetches it once and **inlines** it into the document (a hidden `<div>`
  appended to `<body>`), so consumers reference a local fragment,
  `<svg class="ui-icon"><use href="#ph-play"/></svg>` — NOT
  `href="icons/polarize-icons.svg#ph-play"`. Cross-document `<use>` referencing
  an external file was the first thing tried; it rendered nothing, silently,
  no console error, verified in-browser. Inlining is the standard fix for
  exactly this cross-browser inconsistency.

**Scope built so far — foundation + audio primitives, not every screen.** The
original handoff specs five full screens (listening workspace, corpus browser,
notebook/synthesis, reference manager, mobile companion); its own audio widgets
were one-off inline styles in the mockup, not reusable classes. What's actually
built as shared CSS: the token/typography/spacing layer, the existing
`.ui-card`/`.ui-btn`/`.ui-tabs`/`.ui-table`/etc. component set (re-skinned
automatically, since they reference the same CSS custom properties), plus new
audio-specific primitives —

| Class | What it is |
|---|---|
| `.ui-eyebrow` | 10px/600/uppercase/`.20em` tracking section label |
| `.ui-icon` | sizing wrapper for a `<use>`'d sprite icon |
| `.ui-waveform` / `.ui-waveform__playhead` | the well + SVG-path bg/played-portion pattern from `tokens.json` `audio.waveform` |
| `.ui-region-marker` | overlay marker on a waveform/spectrogram, ochre (human) or `data-kind="attention"` clay |
| `.ui-spectrogram` | canvas well; drawing the six-stop ramp (`audio.spectrogram.ramp`) is a script concern |
| `.ui-transport` / `.ui-transport__play` / `.ui-transport__btn` / `.ui-transport__time` | play/pause/skip/repeat row, sizes from `audio.transport` |
| `.ui-live-dot` | the `pz-pulse` recording indicator (capped duration, folds into the global reduced-motion override) |
| `.ui-tag--clay` / `--ochre` / `--lichen` | audio-ink tinted chips, distinct from the neutral `.ui-pill` |

**Not built yet, documented as patterns instead** (build when a project needs
one — `tools/PROTOCOL.md` P3-E1, a second consumer or an exclusive resource is
what earns the work, not "the handoff specs it"): the corpus-browser table
layout, the notebook manuscript/citation-block layout, the reference-manager
entry grid, and the mobile companion's bezel chrome. Read `README.md`'s
"Screens / views" section (still in the handoff zip, not copied into this repo)
for the full spec if you're building one of these.

**Existing consumers keep their current look.** `tuning-forks/index.html` sets
`<html data-theme="dark">` explicitly to pin the pre-2026-08-04 gold-accent
appearance — see "Adopted by" below. That is the ONE edit this migration made
to an existing consumer; nothing else changed for it. New projects that
explicitly want the classic look instead of Polarize can do the same.

**Not yet done:** the audioInk palette (clay/ochre/lichen) has not been run
through the `dataviz` skill's colour-blindness validator the way `epistemic`
was — it's copied from the handoff as final-intent design values, not yet
independently checked the way this file's own palette section below insists on.
Do that before leaning on clay/ochre/lichen distinctness for anything
safety-critical.

---

## The rule

> **A label may never be hidden. Its explanation must be.**

These projects are full of tiers, caveats, provenance, scopes, and sentences like
*"MODELLED, chosen by ear, not measured"*. All of it is load-bearing. None of it
belongs in the middle of a control panel.

So the split is:

| Stays, always, inline | Moves into the documentation drawer |
|---|---|
| the tier badge `[A]` `[SPEC]` `REFUTED` | why it is that tier |
| `MEASURED` vs `PREDICTED` styling | how it was measured, and against what |
| `ADDED` / `TASTE` on an invented layer | the paragraph admitting what was invented |
| a REFUTED verdict | its scope, its reason, its cheapest probe |
| a number, and its units | the provenance of the number |

`<ui-tier>` renders a badge that **cannot** be collapsed. `<ui-note>` renders a
marker whose body is **always** collapsed. That is enforced by the components,
not by convention.

This is not a compromise between honesty and calm. **A badge with an essay
stapled to it gets skimmed; a badge you can interrogate gets read.** Moving the
prose into a real document, with sections and anchors, is what makes it legible
at all — and the badge that remains is *more* prominent than it was when it was
drowning in its own footnote.

### What must never happen

- A tier badge behind a disclosure.
- `MEASURED` and `PREDICTED` sharing a colour, a weight or a style. Ever, in any
  project. `.ui-measured` is green upright; `.ui-predicted` is blue italic.
- A REFUTED register that only appears if you go looking for it. The badge is on
  the page; the drawer holds the argument.
- An invented value rendered as if it were derived. If it has no source, it wears
  `TASTE` or `ADDED`.

---

## Why not shadcn/ui

It is the obvious answer and it is a good library. It is not used here because
almost every project in this monorepo is deliberately **zero-build**: one HTML
file, vanilla ES modules, a stdlib Python server, no npm, no bundler, and no CDN
(`geometry/` states "no deps, no CDN, no build" as a goal; `earth-heart-beat` must install
as an offline PWA). Adding React + Tailwind + a bundler to those in order to get
a button is a bad trade, and a CDN `<script>` breaks the offline rule.

**What is here instead:** a token file, a generated stylesheet, and four
standards-based custom elements. No framework, no runtime dependency.

**The bridge is deliberate.** Token names follow the shadcn/ui convention —
`--background`, `--foreground`, `--card`, `--muted`, `--border`, `--ring`,
`--radius` — so a Vite + React project can adopt real shadcn/ui and point its
variables straight at these values. Same look, two implementations, one source of
truth.

### ⭐ That trigger has FIRED — see [`shadcn/SHADCN.md`](shadcn/SHADCN.md) (2026-09-09)

This section used to say *"revisit if a second build-based app appears"* and to call
`biome-soundscape-designer` "the one Vite + React project here". Both are now stale:
that project is **archived**, and **four** build-based projects exist —
`neuron-transcription-factors` (Tailwind v4), `salamander-tail` (v3),
`global-biocommunication-visualizer` and `tree-signal-reader-v1` (no Tailwind yet).

So `shadcn/` now holds a **prepared, unadopted** bridge: a theme for each Tailwind
major, a `components.json`, and `tier.tsx` — **generated** from `tokens.json` by
`build_shadcn.py`, because `salamander-tail` and `global-biocommunication-visualizer`
already hold *copied* palette values with the drift risk merely recorded, and a third
hand-copy is what generating prevents. `dev_check.py` runs `--check` and fails on drift.

**The finding that makes the bridge necessary rather than cosmetic: `--accent` means
two different things.** Here it is the brand teal (the same value as `--ring`); in
shadcn it is the muted hover surface behind menu items and list rows. Mapped by name,
every hover state in a React project turns saturated teal — it looks deliberate and is
not. The bridge sends the brand colour to `--primary` and gives `--accent` the subtle
surface shadcn expects; contrast for `--primary-foreground` is **measured** at 5.69:1
light and 10.04:1 dark. The cost is that **a document must not load `design.css` and
`theme.css` together** — both define `--accent` at `:root` and the loser is silent.

**`tier.tsx` has no `compact`/`iconOnly`/`hideLabel` prop and a test asserts it**, because
a hidden label is exactly the failure the badge exists to stop. That test first matched
`tier.tsx`'s *own comment* saying the props are deliberately absent — the same defect
`tree-signal-reader`, `stimulus-to-signal` and `translation-board` each recorded — so it
strips comments now, and was then proven to fail on an injected `hideLabel`.

**None of this changes the zero-build rule.** ~20 projects stay vanilla ES modules plus
`design.css`. Nothing here is a step toward npm in those. Radix arrives with shadcn for
the React projects only, and `tokens.json` stays the layer underneath.

**Do not force reuse.** A one-off control belongs in its project. The things
worth centralising are the ones every project has: surfaces, type, the epistemic
badges, the disclosure mechanism, tabs, cards, tables, and the chart palette.

---

## The palette, and a defect it caught

Colours are **not** eyeballed. They are validated with the `dataviz` skill's
six-check script, and the results are recorded in `tokens.json`
(`palette_provenance`).

Running it found a real defect in the palette these apps had been sharing:

> `spec` (`#a06fd0`) and `predicted` (`#6f8fd0`) sat **ΔE 2.2 apart under
> deuteranopia** and 10.2 in normal vision. Those two carry *opposite* epistemic
> meaning — a model's prediction against pure speculation — and to a large
> fraction of readers they were the same colour.

What replaced it, from the skill's validated reference hues:

| Family | Dark | Light | Used for |
|---|---|---|---|
| `measured` | `#199e70` | `#1baf7a` | `[A]`, MEASURED, PHYSICS |
| `predicted` | `#3987e5` | `#2a78d6` | `[B]`, PREDICTED, MODELLED |
| `exploring` | `#c98500` | `#eda100` | `[C]`, EXPLORATORY |
| `spec` | `#9085e9` | `#4a3aa7` | `[SPEC]`, ADDED, TASTE |
| `refuted` | `#e66767` | `#e34948` | REFUTED |

- **The core three** — measured / predicted / refuted — pass every check on the
  **all-pairs** list, worst normal-vision ΔE 20.9. Those are the three that must
  never be confused, and they are safe in any arrangement.
- **All five** pass on the **adjacent** pairlist, dark and light.
- **All five all-pairs FAILS**, and that is a documented property of the method,
  not a fixable bug — past three slots no ordering clears it. The mitigation is
  the one the method prescribes and it is compulsory here: **every badge carries a
  word and a glyph as well as a colour**, so hue never carries meaning alone.

Chart series colours are a separate, reserved set. A status colour never
impersonates a series and a series colour never impersonates a tier.

---

## Files

| File | |
|---|---|
| `tokens.json` | **the** definition — colour, type, space, radius, the tier ladder, the series palette, and the palette's validation record |
| `design.css` | generated from tokens by `build_css.py`; checked in so projects need no build |
| `design.js` | `<ui-tier>`, `<ui-note>`, `<ui-docs>`, tooltips, and a small script API |
| `build_css.py` | regenerates `design.css`; `--check` fails if it is stale |
| `dev_check.py` | token/CSS/JS agreement, contrast, and the rules above |
| `INTEGRATION.md` | **how to wire a project in** — read that one to do the work |
| `fonts/` | self-hosted **Literata**, the OPTIONAL serif (`var(--font-serif)`); two `.woff2` files. The UI face is a system stack and needs no file. |
| `icons/` | self-hosted Phosphor icon sprite (Polarize's icon set) |

Edit `tokens.json`, never `design.css`. `dev_check.py` fails if they have drifted.

---

## Conventions this inherits

- Stdlib Python, vanilla ES modules, no CDN, no build step. Self-hosted assets
  (fonts, icons) are fine and still satisfy "no network" — the constraint is
  live network dependency, not typeface choice; see "The look: Polarize" above.
- `setInterval` rather than `requestAnimationFrame` for anything that must
  survive a sleeping screen — inherited from `zatara`/`earth-heart-beat` and unrelated to
  this folder, but it is the other repo-wide UI rule worth knowing.
- Dark is the default because every app here is a dark app — now specifically
  **Polarize** dark, not the older gold-accent dark. Polarize does NOT
  auto-switch on `prefers-color-scheme: light` (there is no Polarize light
  variant); `[data-theme="light"]` and `[data-theme="dark"]` are explicit
  opt-ins only.
- `prefers-reduced-motion` is honoured globally in the generated CSS,
  including Polarize's `pz-pulse` recording indicator.

## Adopted by

- **`tuning-forks/`** — the reference implementation for the epistemic system
  (tier badges, the disclosure drawer, MEASURED≠PREDICTED). Its six tabs, its
  four claim registers and every provenance note in it run through this
  system. Pinned to the **pre-Polarize look** (`<html data-theme="dark">`) as
  of the 2026-08-04 Polarize migration — untouched otherwise, per the
  migrate-when-touched policy below.
- **`geometric-cathedral-soundscape/`** — migrated 2026-08-04, full Polarize
  (no `data-theme` pin). The room's tier badge is `<ui-tier>`; four inline
  explanation blocks (why the live controls were reduced to positions only,
  why "record voice" exists instead of trusting GO LIVE's duplex mic path, how
  to read the IPD/monitor-gain seat readout, room-turn-vs-spin) moved into
  `<ui-note>` drawers under three sections (Live audio / Readouts / How it
  works) — the tier badge and every number stayed inline per the rule; only
  the prose explaining them moved.

Everything else still carries its own inline styles, or (new projects, from
2026-08-04 on) gets Polarize automatically with zero configuration. **Migrate
an existing project when you are next changing it, not as a sweep** — the
point of this folder is that the next change is cheaper, not that a weekend is
spent repainting things nobody is looking at.
