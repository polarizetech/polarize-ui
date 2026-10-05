# AGENTS.md

Instructions for coding agents working in this repository. The full context is in
[`CLAUDE.md`](CLAUDE.md); **read its first section before committing anything.**

## Nothing novel goes in here

This repository is public. Do not add novel research, unpublished findings, or a new way of
visualizing data that could be productized or patented. That stays in the private repo it
came from. Views must use standard methods, and demos must use public licensed data or
synthetic data, never recordings of people. If in doubt, don't push; ask.

## This is a public, versioned library

Every push to `main` is released automatically: tagged, published on the Releases page,
and deployed as the live Storybook. Outside users and three Polarize sites are pinned to
those tags, and the README promises them that **a patch release never breaks anything.**

Before every commit:

1. **Decide whether it is breaking.** It is if you rename or remove an export, a prop, a
   `ui-*` class or modifier, a CSS variable, a `tokens.json` key, a custom element or
   attribute, or a `package.json` entry point. It also is if you change a prop's type,
   make a prop required, or change what an existing prop or class does.
2. **If it is, mark the commit.** Put `!:` in the subject (`refactor!: rename X to Y`) or a
   `BREAKING CHANGE: …` line in the body, and say how to migrate.
3. **Prefer an alias over a break.** Keep the old name working and mark it `@deprecated`.
4. **Never** push work in progress to `main`, move or delete a tag, or rewrite a release.

`scripts/api_surface.py` and the release workflow force a breaking bump when something is
**removed**, but they cannot detect a changed prop, signature or behaviour. That part is on
you.

## Where things go

- **`src/science/`** holds the charts (`charts/`), signal views (`signals/`), statistical views
  (`stats/`) and evidence labels (`evidence/`). **This is the core of the library.** A new
  chart, data view or analysis display goes here, with a story under `stories/science/`
  titled `Science/<Charts|Signals|Statistics|Evidence>`.
- **`src/science/space/`** holds the 3-D views (`Scene3D` and the landscape, hodogram and
  event-aligned stack on it), drawn on a plain canvas with no 3-D dependency. Scene axes are
  right-handed; a left-handed data frame (north, east, up) is drawn mirrored.
- **Real demo data is NOT in this repository.** Each `stories/datasets/<name>/` holds a
  `SOURCE.json` (source, accession, licence, attribution, public URL, sha256) and the `reduce.py`
  that made the data from the public source. The data is published to Polarize's public bucket by
  a private build step, and `import data from "virtual:dataset/<name>"` fetches it at Storybook build
  time and refuses it if the hash differs. After a new reduction, regenerate the types with
  `python3 scripts/dataset_types.py`. `dev_check.py` (add `--network` to re-verify the downloads)
  refuses a dataset without a redistributable licence, a committed `data.json`, or a URL that is
  not the content-addressed one.
- **Filters** (a faceted panel for an index, and its controls) are three files that must agree:
  the `FILTERS` section of `publication.css` (the classes), `filter.js` (zero-build behaviour
  and the pure matching/counting logic) and `src/components/filter.tsx` (React, which imports
  that logic from `filter.js`, never a copy). State is `aria-pressed` on a real button. A tier
  toggle is the tier badge with `ui-tier--toggle`; it never names a tier colour.
- **`src/components/`** holds the general UI: shadcn components (`ui/`), typography, page
  layouts and illustrations. Stories go under `stories/ui/`, titled `General UI/…`.
- Science views follow the chart rules in `stories/Introduction.mdx`. They state their scale,
  what they dropped or clipped, and their uncertainty. Colour comes from tokens only:
  `--chart-n` for series, `--seq-n` for magnitude, `--tier-*` for evidence.
- Export anything public from `src/index.ts`, in its section.

## Checks

```bash
python3 dev_check.py                 # design rules, generated files, imports
npx tsc -p .                         # types (with noUnusedLocals, as consumers compile it)
python3 scripts/api_surface.py --removed "$(git describe --tags --abbrev=0)"   # anything removed?
```

`src/` uses relative imports only, never `@/`. Edit `tokens.json`, never `design.css`.
