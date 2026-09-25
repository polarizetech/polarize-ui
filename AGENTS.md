# AGENTS.md

Instructions for coding agents working in this repository. The full context is in
[`CLAUDE.md`](CLAUDE.md); **read its first section before committing anything.**

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

## Checks

```bash
python3 dev_check.py                 # design rules, generated files, imports
npx tsc -p .                         # types (with noUnusedLocals, as consumers compile it)
python3 scripts/api_surface.py --removed "$(git describe --tags --abbrev=0)"   # anything removed?
```

`src/` uses relative imports only, never `@/`. Edit `tokens.json`, never `design.css`.
