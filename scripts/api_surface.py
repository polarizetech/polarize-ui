#!/usr/bin/env python3
"""List polarize-ui's public API surface, one identifier per line.

The README's versioning promise covers these, and removing or renaming any of them
is a breaking change. The release workflow compares the surface at the previous
tag with the one being released; if anything disappeared it forces a breaking
version bump, whether or not the commit was marked with `!:` / `BREAKING CHANGE:`.

    python3 scripts/api_surface.py                  # the surface of this checkout
    python3 scripts/api_surface.py --removed v0.5.3  # what was removed since v0.5.3

What it cannot see: a changed prop, a changed function signature, or a change in
behaviour. Those still need the commit marker (see CLAUDE.md § Versioning).
"""
from __future__ import annotations

import json
import re
import subprocess
import sys
import tarfile
import tempfile
from io import BytesIO
from pathlib import Path

HERE = Path(__file__).resolve().parent.parent
CSS_ENTRIES = ["design.css", "publication.css", "specimens.css",
               "shadcn/theme.css", "shadcn/system.css", "shadcn/tier.css", "src/theme.css"]
NOTE_KEYS = re.compile(r"(^|_)note$|^palette_provenance$|^why_not_a_component_library$")


def _exports(root: Path, file: Path, seen: set[Path]) -> set[str]:
    """Names exported from a TS module, following `export * from` re-exports."""
    if file in seen or not file.is_file():
        return set()
    seen.add(file)
    src = re.sub(r"/\*.*?\*/|//[^\n]*", "", file.read_text(), flags=re.S)
    names: set[str] = set()
    for m in re.finditer(r'export\s+\*\s+from\s+"([^"]+)"', src):
        names |= _exports(root, _resolve(file, m.group(1)), seen)
    for m in re.finditer(r"export\s+(?:type\s+)?\{([^}]*)\}", src):
        for part in m.group(1).split(","):
            part = part.strip()
            if part:
                names.add(re.split(r"\s+as\s+", part)[-1].replace("type ", "").strip())
    for m in re.finditer(r"export\s+(?:declare\s+)?(?:async\s+)?(?:function|const|let|class|type|interface|enum)\s+([A-Za-z_$][\w$]*)", src):
        names.add(m.group(1))
    return names


def _resolve(frm: Path, spec: str) -> Path:
    base = (frm.parent / spec).resolve()
    for cand in (base, base.with_suffix(".ts"), base.with_suffix(".tsx"), base / "index.ts"):
        if cand.is_file():
            return cand
    return base


def _token_keys(obj, prefix="") -> set[str]:
    keys: set[str] = set()
    if isinstance(obj, dict):
        for k, v in obj.items():
            if NOTE_KEYS.search(k):
                continue
            path = f"{prefix}.{k}" if prefix else k
            keys.add(path)
            keys |= _token_keys(v, path)
    return keys


def surface(root: Path) -> set[str]:
    out: set[str] = set()
    pkg = json.loads((root / "package.json").read_text())
    out |= {f"entry:{k}" for k in pkg.get("exports", {})}
    index = root / "src" / "index.ts"
    if index.is_file():
        out |= {f"export:{n}" for n in _exports(root, index, set())}
    for rel in CSS_ENTRIES:
        f = root / rel
        if not f.is_file():
            continue
        css = re.sub(r"/\*.*?\*/", "", f.read_text(), flags=re.S)
        css = re.sub(r"url\([^)]*\)", "", css)
        body = re.sub(r"\{[^{}]*\}", "{}", css)  # selectors only, not values
        out |= {f"class:{c}" for c in re.findall(r"\.(-?[a-zA-Z_][\w-]*)", body)}
        out |= {f"cssvar:{v}" for v in re.findall(r"(--[a-zA-Z0-9-]+)\s*:", css)}
    tokens = root / "tokens.json"
    if tokens.is_file():
        out |= {f"token:{k}" for k in _token_keys(json.loads(tokens.read_text()))}
    js = root / "design.js"
    if js.is_file():
        out |= {f"element:{e}" for e in re.findall(r"customElements\.define\('([a-z-]+)'", js.read_text())}
    return out


def surface_at(ref: str) -> set[str]:
    data = subprocess.run(["git", "archive", ref], cwd=HERE, check=True, capture_output=True).stdout
    with tempfile.TemporaryDirectory() as tmp:
        with tarfile.open(fileobj=BytesIO(data)) as tar:
            try:
                tar.extractall(tmp, filter="data")  # Python 3.12+: refuse unsafe paths
            except TypeError:
                tar.extractall(tmp)  # older Pythons; the archive is our own git history
        return surface(Path(tmp))


def main(argv: list[str]) -> int:
    if len(argv) == 3 and argv[1] == "--removed":
        removed = sorted(surface_at(argv[2]) - surface(HERE))
        print("\n".join(removed))
        return 0
    print("\n".join(sorted(surface(HERE))))
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv))
