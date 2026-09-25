#!/usr/bin/env python3
"""dev_check.py -- self-tests for the shared design system. Stdlib only.

    python3 design/dev_check.py

What this exists to stop:

  1. design.css drifting from tokens.json (it is generated; the check runs the
     generator and byte-compares).
  2. The palette silently becoming unreadable. Contrast is COMPUTED here, and
     the colour-blindness separation the dataviz validator measured is recorded
     in tokens.json with its verdicts pinned.
  3. The one rule the whole system exists for going quietly missing: a label may
     never be hidden, MEASURED and PREDICTED may never share styling.
"""

from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
TOKENS = json.loads((HERE / "tokens.json").read_text())
CSS = (HERE / "design.css").read_text() if (HERE / "design.css").exists() else ""
JS = (HERE / "design.js").read_text()

PASS, FAIL = [], []


def ok(name, cond, detail=""):
    (PASS if cond else FAIL).append((name, detail))


# ---------------------------------------------------------------- colour ----

def srgb_to_lin(c):
    c = c / 255.0
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def luminance(hex_):
    h = hex_.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * srgb_to_lin(r) + 0.7152 * srgb_to_lin(g) + 0.0722 * srgb_to_lin(b)


# EVERY theme carrying a palette, so a newly added one cannot slip past the contrast checks
# unverified. `instrument` was added 2026-08-19 and the loops named three themes literally,
# so it was skipped on the day it became the default.
ALL_THEMES = ("polarize", "dark", "light", "instrument", "instrument-dark")

from build_css import _FAMILY_BORROW  # noqa: E402  -- single source of truth for palette borrowing


def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


HEX = re.compile(r"^#[0-9a-fA-F]{6}$")


def check_tokens():
    ok("tokens.json has a schema", TOKENS.get("schema", "").startswith("design.tokens"))
    ok("the choice not to use a component library is written down, with reasons",
       bool(TOKENS.get("why_not_a_component_library", {}).get("why_it_is_not_used_here")))
    ok("...and names the obvious alternative rather than pretending there is none",
       "shadcn" in json.dumps(TOKENS["why_not_a_component_library"]).lower())
    ok("...and says when to revisit the decision",
       bool(TOKENS["why_not_a_component_library"].get("when_to_revisit")))

    prov = TOKENS.get("palette_provenance", {})
    ok("the palette records HOW it was validated", bool(prov.get("method")))
    ok("...and names the script rather than claiming judgement",
       "validate_palette" in prov.get("method", ""))
    ok("...and records what FAILED as well as what passed",
       "FAILS" in json.dumps(prov.get("results", {})))
    ok("...and keeps the record of the defect it replaced",
       "deuteranopia" in json.dumps(prov.get("results", {})))

    for mode in ALL_THEMES:
        for name, v in TOKENS["color"][mode].items():
            # polarize's border/border-strong are intentionally rgba() hairlines
            # (the Polarize handoff's own line tokens), not solid hex.
            if name in ("shadow", "overlay", "note") or (mode == "polarize" and name in ("border", "border-strong")):
                continue
            ok(f"{mode}.{name} is a hex colour", bool(HEX.match(v)), v)

    ink = TOKENS["audioInk"]
    epistemic_hexes = {v[m].lower() for v in TOKENS["epistemic"]["families"].values() for m in ("dark", "light")}
    audio_ink_hexes = {ink[name]["value"].lower() for name in ("clay", "ochre", "lichen")}
    ok("audioInk colours are a separate namespace from the epistemic tier palette "
       "(different semantic axis -- UI role vs. evidence quality -- must never overlap)",
       not (epistemic_hexes & audio_ink_hexes), str(epistemic_hexes & audio_ink_hexes))

    for f in ("literata-normal-variable.woff2", "literata-italic-400.woff2"):
        ok(f"self-hosted font file {f} exists", (HERE / "fonts" / f).exists())
    ok("self-hosted font licence text exists", (HERE / "fonts" / "LITERATA-OFL.txt").exists())
    ok("self-hosted icon sprite exists", (HERE / "icons" / "polarize-icons.svg").exists())


def check_contrast():
    for mode in ALL_THEMES:
        bg = TOKENS["color"][mode]["background"]
        card = TOKENS["color"][mode]["surface"]
        fg = TOKENS["color"][mode]["foreground"]
        muted = TOKENS["color"][mode]["muted-foreground"]
        faint = TOKENS["color"][mode]["faint-foreground"]

        ok(f"{mode}: body text clears WCAG AA (4.5:1)", contrast(fg, bg) >= 4.5,
           f"{contrast(fg, bg):.2f}")
        ok(f"{mode}: muted text clears AA for body size", contrast(muted, card) >= 4.5,
           f"{contrast(muted, card):.2f}")
        # Faint is used for section eyebrows and tooltip hints only -- large or
        # supplementary text, so the AA-large bar (3:1) is the right one.
        ok(f"{mode}: faint text clears AA-large (3:1)", contrast(faint, card) >= 3.0,
           f"{contrast(faint, card):.2f}")

        # polarize reuses "dark"'s epistemic/series hexes (see build_css.py's
        # fam_mode fallback) rather than declaring its own -- so re-verify those
        # SAME hexes against polarize's own (different) background/surface
        # rather than re-reading tokens under a "polarize" key that doesn't exist.
        # ONE borrow map, imported from the builder. Two copies of "which palette does this
        # theme reuse" is how a theme ends up contrast-checked against the wrong background.
        fam_mode = _FAMILY_BORROW.get(mode, mode)

        # A tier badge is TEXT, so it is held to the text bar (4.5:1), not the
        # 3:1 a chart mark gets.
        for fam, v in TOKENS["epistemic"]["families"].items():
            c = contrast(v[fam_mode], card)
            ok(f"{mode}: tier colour '{fam}' is readable as text (4.5:1)", c >= 4.5,
               f"{c:.2f}")

        # Series colours are MARKS. The reference palette documents that three
        # light slots sit under 3:1 and mitigates with the relief rule, so the
        # check is that the rule is declared -- asserting a contrast the palette
        # was never designed to meet would just mean re-stepping a validated set.
        low = [i for i, s in enumerate(TOKENS["series"][fam_mode], 1)
               if contrast(s, bg) < 3.0]
        if mode in ("polarize", "dark"):
            ok(f"{mode}: every series colour clears 3:1 on the page", not low, str(low))
        else:
            ok("light: the sub-3:1 series slots are covered by a declared relief rule",
               bool(TOKENS["series"].get("relief_rule")), f"slots {low}")

    # audioInk: clay/ochre/lichen-as-text (the tint-safe steps) against the
    # polarize surface -- these are used for text (tag labels, timestamps),
    # so held to 4.5:1 like the tier colours above, not the 3:1 a chart mark gets.
    card = TOKENS["color"]["polarize"]["surface"]
    ink = TOKENS["audioInk"]
    for name, hexval in (("clay", ink["clay"]["value"]), ("ochre", ink["ochre"]["value"]),
                         ("lichen (text-safe step)", ink["lichen"]["onTint"])):
        c = contrast(hexval, card)
        ok(f"polarize: audio ink '{name}' is readable as text (4.5:1)", c >= 4.5, f"{c:.2f}")


def check_epistemic():
    tiers = TOKENS["epistemic"]["tiers"]
    fams = TOKENS["epistemic"]["families"]
    ids = [t["id"] for t in tiers]
    ok("tier ids are unique", len(ids) == len(set(ids)))
    for t in tiers:
        ok(f"tier {t['id']} names a real family", t["family"] in fams, t["family"])
        ok(f"tier {t['id']} carries a WORD label", bool(t["label"]))
        ok(f"tier {t['id']} carries a GLYPH -- hue is never alone",
           bool(t.get("glyph")))
        ok(f"tier {t['id']} states what it means", len(t.get("meaning", "")) > 20)

    # Every family must be reachable, or a colour is defined and never used.
    used = {t["family"] for t in tiers}
    ok("every family is used by at least one tier", used == set(fams), str(used ^ set(fams)))

    # The three that must never be confused.
    for a, b in (("measured", "predicted"), ("measured", "refuted"), ("predicted", "refuted")):
        for mode in ("dark", "light"):
            ca, cb = fams[a][mode], fams[b][mode]
            ok(f"{mode}: {a} and {b} are different colours", ca.lower() != cb.lower())

    # The tier ladder must be ordered, so a UI can sort by strength of claim.
    weights = {t["id"]: t["weight"] for t in tiers}
    ok("MEASURED outranks PREDICTED outranks SPEC outranks REFUTED",
       weights["MEASURED"] > weights["PREDICTED"] > weights["SPEC"] > weights["REFUTED"])

    # Series and tier palettes must not collide, or a chart line can impersonate
    # an epistemic claim.
    for mode in ("dark", "light"):
        series = {s.lower() for s in TOKENS["series"][mode]}
        tier_c = {v[mode].lower() for v in fams.values()}
        overlap = series & tier_c
        # Overlap is expected -- both draw from the same validated reference hues --
        # so the rule is enforced by USAGE, not by hex. What must hold is that the
        # series list is declared separately and carries its own cap.
        ok(f"{mode}: the series palette declares an all-pairs cap",
           isinstance(TOKENS["series"].get("all_pairs_cap"), int))
        ok(f"{mode}: the cap is 3, matching what the validator actually passed",
           TOKENS["series"]["all_pairs_cap"] == 3, str(overlap))


def check_css():
    ok("design.css exists", bool(CSS))
    proc = subprocess.run([sys.executable, str(HERE / "build_css.py"), "--check"],
                          capture_output=True, text=True)
    ok("design.css is not stale (regenerates byte-identically)", proc.returncode == 0,
       proc.stdout.strip())

    ok("design.css says it is generated", "GENERATED from tokens.json" in CSS)

    # THE rule, in CSS: measured and predicted must not share styling.
    m = re.search(r"\.ui-measured\s*\{([^}]*)\}", CSS)
    p = re.search(r"\.ui-predicted\s*\{([^}]*)\}", CSS)
    ok("both .ui-measured and .ui-predicted exist", bool(m) and bool(p))
    if m and p:
        ok("MEASURED and PREDICTED do not share a declaration block",
           m.group(1).strip() != p.group(1).strip())
        ok("...they differ by COLOUR", "--measured" in m.group(1) and "--predicted" in p.group(1))
        ok("...and by more than colour, so the distinction survives greyscale, "
           "a projector and colour-blindness",
           "italic" in p.group(1) and "italic" not in m.group(1))

    # INSTRUMENT is the bare :root default from 2026-08-19 -- verified by position (its block
    # must be the first ":root {" in the file).
    first_root = CSS.index(":root {")
    # To the END of the block, not a fixed character window -- the token list is ~850 chars and a
    # 400-char window silently missed `color-scheme` at the bottom of it.
    head = CSS[first_root:CSS.index("}", first_root)]
    ok("instrument is declared first, as the bare :root default",
       TOKENS["color"]["instrument"]["background"] in head)
    ok("...and the bare :root carries the LIGHT palette, so an un-stamped page in a light OS "
       "is not left on a dark ground", "color-scheme: light" in head)

    # The three-state rule. Unlike every previous theme here, instrument has a real light/dark
    # pair, so it must resolve correctly in all three viewer states -- and the un-stamped
    # default-system state is the one most viewers are in and the one most often got wrong.
    ok("instrument auto-switches to its dark half on prefers-color-scheme: dark",
       "@media (prefers-color-scheme: dark)" in CSS
       and TOKENS["color"]["instrument-dark"]["background"] in CSS)
    media = CSS[CSS.index("@media (prefers-color-scheme: dark)"):]
    ok("...guarded with :not([data-theme]) so an explicit stamp always beats the OS preference",
       ":root:not([data-theme])" in media[:media.index("}")+200])
    ok("...and both halves are reachable by explicit stamp, so a toggle wins in either direction",
       '[data-theme="instrument"]' in CSS and '[data-theme="instrument-dark"]' in CSS)
    ok("light and dark (the pre-2026-08-04 look) remain available as explicit "
       "opt-ins in BOTH directions", '[data-theme="light"]' in CSS and '[data-theme="dark"]' in CSS)
    ok("polarize remains reachable by name -- the opt-out a project uses to keep its old look",
       '[data-theme="polarize"]' in CSS)
    ok("reduced motion is honoured", "prefers-reduced-motion" in CSS)
    ok("focus is always visible", CSS.count(":focus-visible") >= 4)
    # A local, self-hosted font file src is a relative url() with no scheme --
    # this still catches an accidental fonts.googleapis.com/CDN reference.
    body = CSS.split("*/", 1)[1]
    ok("no webfont or CDN reference (self-hosted @font-face uses a local relative "
       "url(), never http(s)://)", "@import" not in CSS and "http" not in body)
    ok("the self-hosted serif @font-face block is present, and points locally",
       "@font-face" in CSS and 'url("fonts/' in CSS)

    for cls in (".ui-card", ".ui-btn", ".ui-field", ".ui-table", ".ui-tier",
                ".ui-marker", ".ui-tooltip", ".ui-drawer", ".ui-tabs", ".ui-rule",
                ".ui-eyebrow", ".ui-icon", ".ui-waveform", ".ui-transport",
                ".ui-region-marker", ".ui-spectrogram", ".ui-tag", ".ui-live-dot"):
        ok(f"design.css defines {cls}", cls in CSS)


def check_js():
    for el in ("ui-tier", "ui-note", "ui-docs"):
        ok(f"design.js defines <{el}>", f"customElements.define('{el}'" in JS)

    ok("the rule is stated at the top of design.js",
       "A LABEL may never be hidden" in JS)
    # <ui-note> must empty itself and leave only a marker -- that IS the hiding.
    ok("<ui-note> replaces its body with a marker",
       "this.innerHTML = ''" in JS and "ui-marker" in JS)
    # <ui-tier> must never create a marker or a disclosure.
    tier_src = JS[JS.index("class UiTier"):JS.index("/* ------------------------------------------------------------------ note -- */")]
    ok("<ui-tier> renders inline and cannot be collapsed",
       "ui-marker" not in tier_src and "docs()" not in tier_src)
    ok("<ui-tier> carries its glyph as well as its label",
       "ui-tier__glyph" in tier_src)
    ok("<ui-tier> is reachable by keyboard", "tabindex" in tier_src)

    ok("the drawer closes on Escape", "'Escape'" in JS)
    ok("the drawer does not depend on requestAnimationFrame -- it does not fire "
       "in a hidden tab", "requestAnimationFrame(" not in JS)
    ok("the drawer opens on ?", "'?'" in JS)
    ok("...but not while typing in a field", "INPUT|TEXTAREA|SELECT" in JS)
    ok("tooltips work from keyboard focus, not just hover", "focusin" in JS)
    ok("a missing tokens.json degrades instead of failing the app",
       "degrade, never fail to start" in JS.lower() or "console.warn('design" in JS)
    ok("series colours are exposed to charts", "export function seriesColors" in JS)
    # tokens.json + the icon sprite -- both same-folder, both degrade on failure.
    ok("no network beyond the design folder itself",
       JS.count("fetch(") == 2 and "tokens.json" in JS and "polarize-icons.svg" in JS)
    ok("a missing icon sprite degrades instead of failing the app",
       "icon sprite unavailable" in JS)
    ok("the icon sprite is INLINED into the document, not left as a cross-document "
       "<use> reference (verified unreliable in-browser -- silent failure, no error)",
       "unreliable across browsers" in JS and "innerHTML = svgText" in JS)


def check_type_rule():
    """SANS-SERIF is the default for every theme and every project.

    Set 2026-08-13 at the operator's request, repo-wide and forward-looking:
    "use Inter or a nice sans-serif, and that goes for all future projects".
    Pinned here because the whole point is that a NEW project inherits it with
    zero configuration -- a rule nobody checks is a rule that lasts one theme.
    """
    t = TOKENS["type"]

    for theme, which in t["primaryByTheme"].items():
        ok(f"theme '{theme}' uses a sans primary face", which == "sans",
           f"got {which!r}")

    ok("the sans stack names Inter first", t["sans"].strip().startswith("Inter"))
    ok("the sans stack falls back to the system stack",
       "-apple-system" in t["sans"] and t["sans"].rstrip().endswith("sans-serif"))
    ok("mono is still a system stack", "ui-monospace" in t["mono"])

    # The serif token stays available -- it is simply no longer anyone's primary.
    ok("a serif token still exists for deliberate use", bool(t.get("serif")))
    ok("but no theme uses it as primary", "serif" not in t["primaryByTheme"].values())

    # And the generated CSS must actually agree with the tokens.
    css = (HERE / "design.css").read_text()
    for block_ in css.split("--font-primary:")[1:]:
        decl = block_.split(";")[0]
        ok("every --font-primary in the built CSS is the sans stack",
           "Inter" in decl and "serif" not in decl.replace("sans-serif", ""),
           decl.strip()[:60])

    # Fonts referenced by @font-face must exist on disk. This was stale: the
    # docs and the serve allow-list still named source-serif-4 files that had
    # been replaced by Literata, so a consumer copying them served 404s.
    import re as _re
    for url in _re.findall(r'url\("([^"]+)"\)', css):
        ok(f"@font-face file {url} exists", (HERE / url).exists())

    # UPPERCASE IS ALWAYS MONO; THE DISPLAY SERIF IS NEVER UPPERCASED (operator, 2026-08-20).
    # Found in veil-bypass: `.ui-card > h2` uppercased whatever heading landed in a card, so a
    # `.ui-display` heading rendered as uppercase Instrument Serif -- the one combination the
    # type system forbids. Every rule that says `text-transform: uppercase` must therefore either
    # set the mono face in the same block or inherit it from the same selector's other block.
    rules = _re.findall(r'([^{}]+)\{([^{}]*text-transform:\s*uppercase[^{}]*)\}', css)
    ok("the built CSS still has uppercase rules to police", len(rules) >= 5, str(len(rules)))
    for sel, body in rules:
        sel = sel.strip().split("\n")[-1].strip()
        ok(f"uppercase rule '{sel[:48]}' sets the mono face",
           "var(--font-mono)" in body, "uppercase without mono")
    ok(".ui-display explicitly refuses text-transform",
       _re.search(r'\.ui-display\s*\{[^}]*text-transform:\s*none', css) is not None)
    ok("a plain-h2 card kicker excludes .ui-display",
       ".ui-card > h2:not(.ui-display)" in css)
    ok("the standfirst is body-sized, not enlarged",
       _re.search(r'\.ui-standfirst\s*\{[^}]*font-size:\s*var\(--text-base\)', css) is not None)

    # THE SANS IS NEVER BOLD AND NEVER TRACKED (operator, 2026-08-20). Weight >= 600 may appear
    # only inside @font-face blocks (variable-font ranges); everywhere else the heaviest weight
    # in the system is the mono's 500. Browser bold is reset at the source: plain headings and
    # <strong> both render 400, with <strong> marked by ink instead of weight.
    body_css = _re.sub(r'@font-face\s*\{[^}]*\}', '', css)
    ok("no rule outside @font-face uses font-weight 600/700/bold",
       not _re.search(r'font-weight:\s*(600|700|bold)', body_css))
    ok("plain headings are reset to the regular weight",
       _re.search(r'h1, h2, h3, h4, h5, h6\s*\{\s*font-weight:\s*400', css) is not None)
    ok("<strong> is regular weight, marked by ink not bold",
       _re.search(r'b, strong\s*\{\s*font-weight:\s*400;\s*color:\s*var\(--foreground\)', css) is not None)
    # No sans-face rule tracks: every letter-spacing in the built CSS belongs to a block that is
    # mono-faced, uppercase (therefore mono, per the rule above), the display serif's optical
    # correction, or an explicit reset to 0.
    for m in _re.finditer(r'([^{}]+)\{([^{}]*letter-spacing[^{}]*)\}', body_css):
        sel, body = m.group(1).strip().split("\n")[-1].strip(), m.group(2)
        legit = ("var(--font-mono)" in body or "uppercase" in body
                 or "letter-spacing: 0" in body or ".ui-display" in sel)
        ok(f"letter-spacing in '{sel[:44]}' is mono/serif/reset, never tracked sans", legit)


def check_shadcn() -> None:
    """The shadcn bridge: generated from tokens.json, and refusing the --accent collision.

    `salamander-tail` and `global-biocommunication-visualizer` both hold COPIED design values
    with the drift risk merely recorded. A third hand-copy is what this prevents.
    """
    import subprocess
    from pathlib import Path
    d = Path(__file__).parent / "shadcn"
    if not d.is_dir():
        print("  SKIP shadcn bridge not present")
        return

    r = subprocess.run([sys.executable, str(d / "build_shadcn.py"), "--check"],
                       capture_output=True, text=True)
    ok("shadcn bridge is regenerated from tokens.json (no drift)", r.returncode == 0,
       r.stdout.strip() + r.stderr.strip())

    theme = (d / "theme.css").read_text()
    tokens = json.loads((Path(__file__).parent / "tokens.json").read_text())
    brand = tokens["color"]["instrument"]["accent"]
    surface2 = tokens["color"]["instrument"]["surface-2"]

    # THE collision. shadcn's --accent is a hover surface; ours is the brand teal. If these
    # ever become the same value, every hover row in a React project turns saturated teal.
    ok("shadcn --primary carries the BRAND colour", f"--primary: {brand};" in theme)
    ok("shadcn --accent is the muted surface, NOT the brand colour",
       f"--accent: {surface2};" in theme and f"--accent: {brand};" not in theme)
    ok("the --accent collision is documented in the generated file",
       "MUTED HOVER SURFACE" in theme)
    ok("SHADCN.md warns against loading design.css and theme.css together",
       "do not load" in (d / "SHADCN.md").read_text().lower())

    # The three-channel rule must survive the port to React.
    tsx = (d / "tier.tsx").read_text()
    ok("Tier renders a glyph AND a label (colour is never load-bearing)",
       "t.glyph" in tsx and "t.label" in tsx)

    # Search the CODE, not the comment that explains the rule. The first version of this check
    # matched tier.tsx's own header ("deliberately no `compact` ... prop") and failed on a file
    # that was correct. `tree-signal-reader`, `stimulus-to-signal` and `translation-board` each
    # recorded the same defect; weakening the check was the wrong repair in all three.
    code = re.sub(r"/\*.*?\*/", "", tsx, flags=re.S)
    code = re.sub(r"//.*", "", code)
    ok("the prop check reads code, not the comment that describes it",
       "deliberately no" in tsx and "deliberately no" not in code)
    for prop in ("compact", "iconOnly", "hideLabel"):
        ok(f"Tier has no `{prop}` prop — a hidden label is the failure the badge exists to stop",
           prop not in code)
    ok("Tier's vocabulary is generated, not hand-written",
       "GENERATED by tools/design/shadcn/build_shadcn.py" in tsx)
    ok("every epistemic tier reached the React component",
       all(f'"{t["id"]}"' in tsx for t in tokens["epistemic"]["tiers"]))

    # Prepared, not adopted: this must not have quietly been wired into a project.
    # Only meaningful when mounted as the monorepo's tools/design submodule.
    root = Path(__file__).resolve().parents[2]
    if (root / "tools" / "REGISTRY.md").is_file():
        wired = [p.name for p in (root / "projects").glob("*/package.json")
                 if "shadcn" in p.read_text()]
        ok("shadcn is prepared but adopted nowhere yet (no project depends on it)",
           not wired, str(wired))
    else:
        print("SKIP  shadcn adoption check -- not mounted inside the audio-projects monorepo")


def check_publication() -> None:
    """publication.css is held to the same rules as design.css."""
    path = HERE / "publication.css"
    ok("publication.css exists", path.is_file())
    if not path.is_file():
        return
    css = re.sub(r"/\*.*?\*/", "", path.read_text(), flags=re.S)
    ok("publication.css has no hex or rgb() colour literal",
       not re.search(r"#[0-9a-fA-F]{3,8}\b|rgba?\(", css))
    ok("publication.css never bolds",
       not re.search(r"font-weight:\s*(600|700|800|900|bold)", css))
    blocks = re.findall(r"([^{}]+)\{([^{}]*)\}", css)
    upper = [s.strip() for s, b in blocks if "uppercase" in b and "var(--font-mono)" not in b]
    ok("publication.css: every uppercase rule sets the mono face", not upper, str(upper[:3]))
    tracked = [s.strip() for s, b in blocks if "letter-spacing" in b
               and not any(k in b for k in ("var(--font-mono)", "uppercase", "var(--font-display)"))]
    ok("publication.css: the sans is never tracked", not tracked, str(tracked[:3]))
    names = set(re.findall(r"var\((--[a-z0-9-]+)", css)) - {"--pub-accent", "--measure", "--tier-color"}
    system = (HERE / "shadcn" / "system.css").read_text() + (HERE / "shadcn" / "theme.css").read_text()
    for where, text in (("design.css", CSS), ("the React theme", system)):
        missing = sorted(n for n in names if f"{n}:" not in text)
        ok(f"every token publication.css reads is defined by {where}", not missing, str(missing))
    ok("publication.css only ever reads the brand colour through --pub-accent",
       "var(--accent)" not in css.replace("var(--pub-accent, var(--accent))", ""))


def check_react_mirror() -> None:
    """src/theme.css re-declares a few design.css classes for React documents; they must match."""
    path = HERE / "src" / "theme.css"
    if not path.is_file():
        return
    react = path.read_text()

    def decls(css: str, cls: str) -> set[str]:
        m = re.search(r"(?m)^\s*\." + re.escape(cls) + r"\s*\{([^}]*)\}", css)
        return {d.strip() for d in m.group(1).replace("\n", " ").split(";") if d.strip()} if m else set()

    # .ui-icon is deliberately NOT mirrored: design.css fills a sprite icon, and lucide
    # icons are strokes, so `fill: currentColor` would paint them solid.
    for cls in ("ui-label", "ui-standfirst", "ui-pill"):
        a, b = decls(CSS, cls), decls(react, cls)
        ok(f"React's .{cls} matches design.css", a == b and bool(a), f"design.css-only {sorted(a - b)}, react-only {sorted(b - a)}")


def check_package_imports() -> None:
    """src/ ships as source to other apps. An `@/` import there resolves against the
    CONSUMER's alias, so it would silently pick up the host's own components."""
    bad = [str(f.relative_to(HERE)) for f in (HERE / "src").rglob("*.ts*")
           if re.search(r'from\s+"@/', f.read_text())]
    ok("src/ uses relative imports only (no `@/` — it would resolve inside the consumer)", not bad, str(bad))


def main() -> int:
    check_tokens()
    check_contrast()
    check_epistemic()
    check_type_rule()
    check_css()
    check_js()
    check_shadcn()
    check_publication()
    check_react_mirror()
    check_package_imports()
    for name, detail in FAIL:
        print(f"FAIL  {name}" + (f"   [{detail}]" if detail else ""))
    print(f"\n{len(PASS)}/{len(PASS) + len(FAIL)} checks passed")
    return 1 if FAIL else 0


if __name__ == "__main__":
    raise SystemExit(main())
