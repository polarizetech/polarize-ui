# claude-design-system

A copy of this library as a Claude **Design System** artifact, kept in the repo so it can be reopened or republished later.

- Live artifact (private to the owner unless shared): https://claude.ai/artifact/9gWHMLHB5exoNc67MGayjG
- Imported at v0.6.2 on 2026-10-30; synced to v0.6.7 on 2026-11-10 (stylesheet with the panel stack, dashboard frames and navbar; the Navbar card).
- `project/` holds the artifact's files exactly as published (`design-system.json`, `tokens.json`, `README.md`, `components/`, `fonts/`).
- `build_tokens.py` and `build_docs.py` regenerate `project/` from the repo's `tokens.json` and `design.css`. Run `build_tokens.py` then `build_docs.py` (from any folder). They find the repo from their own location and take the version from `package.json`. `build_docs.py` keeps the system's `createdOnFiles` and writes a fresh `lastChange`; the Cover and Navbar cards are kept in the script as published, so edit them there when the published cards change.
- This folder is not in `package.json` `files`, so it is not published to npm.

To republish, ask Claude Code to publish `project/` to the artifact URL above. Its tokens are a copy, so `tokens.json` at the repo root stays the source of truth.
