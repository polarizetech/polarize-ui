# claude-design-system

A copy of this library as a Claude **Design System** artifact, kept in the repo so it can be reopened or republished later.

- Live artifact (private to the owner unless shared): https://claude.ai/artifact/9gWHMLHB5exoNc67MGayjG
- Imported from `tokens.json` at v0.6.2 on 2026-10-30.
- `project/` holds the artifact's files exactly as published (`design-system.json`, `tokens.json`, `README.md`, `components/`, `fonts/`).
- `build_tokens.py` and `build_docs.py` regenerate `project/` from the repo's `tokens.json` and `design.css`. Run `build_tokens.py` then `build_docs.py` from this folder. Both read the repo by absolute path, so adjust `R` if the checkout moves.
- This folder is not in `package.json` `files`, so it is not published to npm.

To republish, ask Claude Code to publish `project/` to the artifact URL above. Its tokens are a copy, so `tokens.json` at the repo root stays the source of truth.
