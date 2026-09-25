#!/usr/bin/env python3
"""build_css.py -- generate design.css from tokens.json.

    python3 design/build_css.py            # write design.css
    python3 design/build_css.py --check    # exit 1 if design.css is stale

Stdlib only. design.css is CHECKED IN so a project can just link it with no
build step; this script exists so the checked-in file can never drift from the
tokens. dev_check.py runs --check.

The variable NAMES follow the shadcn/ui convention (--background, --foreground,
--card, --muted, --border, --ring, --radius) on purpose: the one React project
here can adopt real shadcn/ui and point its variables at these values.
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
TOKENS = json.loads((HERE / "tokens.json").read_text())
OUT = HERE / "design.css"

BANNER = """/* design.css -- GENERATED from tokens.json by build_css.py. Do not edit by hand.
 *
 * The monorepo's shared look. Link it, then write markup against the classes and
 * the custom elements in design.js:
 *
 *     <link rel="stylesheet" href="design/design.css">
 *     <script type="module" src="design/design.js"></script>
 *
 * See design/INTEGRATION.md. The rule that matters most is in design/CLAUDE.md:
 * a LABEL may never be hidden, and its EXPLANATION must be.
 */
"""


def _font_stack(key: str) -> str:
    return TOKENS["type"]["serif"] if key == "serif" else TOKENS["type"]["sans"]


# Themes without their own epistemic/series palette borrow a validated one of matching
# luminance. Contrast is then RE-VERIFIED against the borrowing theme's real background in
# dev_check.py -- borrowing the hues is allowed, assuming they still pass is not.
_FAMILY_BORROW = {
    "polarize": "dark",
    "instrument": "light",
    "instrument-dark": "dark",
}


DARK_MODES = {"polarize", "dark", "instrument-dark"}


def _vars(mode: str, indent: int = 2) -> str:
    c = TOKENS["color"][mode]
    fam = TOKENS["epistemic"]["families"]
    fam_mode = _FAMILY_BORROW.get(mode, mode)
    series = TOKENS["series"][fam_mode]
    primary_key = TOKENS["type"]["primaryByTheme"][mode]
    out = []
    # shadcn-compatible names first, then our own.
    out.append(f"  --background: {c['background']};")
    out.append(f"  --foreground: {c['foreground']};")
    out.append(f"  --card: {c['surface']};")
    out.append(f"  --card-foreground: {c['foreground']};")
    out.append(f"  --popover: {c['surface-2']};")
    out.append(f"  --muted: {c['surface-2']};")
    out.append(f"  --muted-foreground: {c['muted-foreground']};")
    out.append(f"  --faint-foreground: {c['faint-foreground']};")
    out.append(f"  --border: {c['border']};")
    out.append(f"  --border-strong: {c['border-strong']};")
    out.append(f"  --ring: {c['ring']};")
    out.append(f"  --accent: {c['accent']};")
    out.append(f"  --shadow: {c['shadow']};")
    out.append(f"  --overlay: {c['overlay']};")
    out.append(f"  --font-primary: {_font_stack(primary_key)};")
    for name, v in fam.items():
        out.append(f"  --{name}: {v[fam_mode]};")
    for i, hex_ in enumerate(series, 1):
        out.append(f"  --series-{i}: {hex_};")
    # Sequential ramp: --seq-1 is always "near zero", so it flips on dark themes.
    seq = list(TOKENS["sequential"]["steps"].values())
    if mode in DARK_MODES:
        seq = seq[::-1]
    for i, hex_ in enumerate(seq, 1):
        out.append(f"  --seq-{i}: {hex_};")
    if mode == "polarize":
        ink = TOKENS["audioInk"]
        out.append(f"  --clay: {ink['clay']['value']};")
        out.append(f"  --clay-hover: {ink['clay']['hover']};")
        out.append(f"  --clay-press: {ink['clay']['press']};")
        out.append(f"  --clay-tint: {ink['clay']['tint']};")
        out.append(f"  --ochre: {ink['ochre']['value']};")
        out.append(f"  --ochre-tint: {ink['ochre']['tint']};")
        out.append(f"  --lichen: {ink['lichen']['value']};")
        out.append(f"  --lichen-text: {ink['lichen']['onTint']};")
        out.append(f"  --lichen-tint: {ink['lichen']['tint']};")
        out.append(f"  --line-row: {ink['line']['row']};")
        out.append(f"  --wash-hover: {ink['wash']['hover']};")
        out.append(f"  --wash-selection: {ink['wash']['selection']};")
    if indent != 2:
        pad = " " * indent
        out = [pad + line.lstrip() for line in out]
    return "\n".join(out)


def _static() -> str:
    t = TOKENS["type"]
    sp = TOKENS["space"]
    r = TOKENS["radius"]
    lay = TOKENS["layout"]
    m = TOKENS["motion"]
    sc = t["scale"]
    aud = TOKENS["audio"]
    pulse = aud["pulse"]

    scale_vars = "\n".join(f"  --text-{k}: {v};" for k, v in sc.items())
    space_vars = "\n".join(f"  --space-{k}: {v};" for k, v in sp.items())
    radius_vars = "\n".join(f"  --radius-{k}: {v};" for k, v in r.items())

    return f"""
:root {{
  --font-sans: {t['sans']};
  --font-mono: {t['mono']};
  --font-serif: {t['serif']};
  --font-display: {t['display']};
  --display-1: {t['display_scale']['1']};
  --display-2: {t['display_scale']['2']};
  --display-3: {t['display_scale']['3']};
{scale_vars}
  --leading-tight: {t['leading']['tight']};
  --leading-base: {t['leading']['base']};
{space_vars}
{radius_vars}
  --radius: {r['base']};
  --content-max: {lay['content-max']};
  --drawer-width: {lay['drawer-width']};
  --motion-fast: {m['fast']};
  --motion-base: {m['base']};
  --motion-slow: {m['slow']};
  --ease: {m['ease']};
}}

/* Self-hosted, not a CDN reference -- local files under design/fonts/, so
   projects still load with no network (earth-heart-beat's offline-PWA requirement and
   friends). Latin subset only (~131 KB total). Literata (TypeTogether/Google
   Fonts, OFL -- see fonts/LITERATA-OFL.txt), chosen over Source Serif 4
   specifically for its opsz (optical size) axis, 7-72pt: this is a UI
   typeface running text as small as 11px (--text-xs), and opsz is what
   keeps a serif legible that small instead of just scaling down a face
   drawn for headlines -- thicker strokes, more open counters and looser
   spacing at small sizes, without a second family or manual overrides.
   Browsers drive it automatically (font-optical-sizing: auto, the default)
   off the rendered font-size, so no CSS here references opsz directly.
   Weight 300-700 come from one variable-font file; italic is pinned to 400
   (the only italic weight actually used -- .ui-predicted) but keeps its own
   opsz range, since predicted values render at every text size too. Never
   synthesise oblique (Polarize principle 1). */
@font-face {{
  font-family: "Literata";
  font-style: normal;
  font-weight: 300 700;
  font-display: swap;
  src: url("fonts/literata-normal-variable.woff2") format("woff2");
}}
@font-face {{
  font-family: "Literata";
  font-style: italic;
  font-weight: 400;
  font-display: swap;
  src: url("fonts/literata-italic-400.woff2") format("woff2");
}}

/* The Instrument triad (2026-08-19). Also self-hosted, also no CDN: 76 KB for all three
   latin subsets, which is what made vendoring Inter finally reasonable -- the older note
   here declined it assuming 100 KB+, and the variable latin subset is 48 KB.
   INSTRUMENT SERIF IS A DISPLAY FACE. It has no optical-size axis and goes spindly below
   about 20px, so --font-display is for headings and .ui-display only; running text is Inter. */
@font-face {{
  font-family: "Instrument Serif";
  font-style: normal;
  font-weight: 400;
  font-display: swap;
  src: url("fonts/instrument-serif-400.woff2") format("woff2");
}}
@font-face {{
  font-family: "Inter";
  font-style: normal;
  font-weight: 100 900;
  font-display: swap;
  src: url("fonts/inter-variable.woff2") format("woff2");
}}
@font-face {{
  font-family: "IBM Plex Mono";
  font-style: normal;
  font-weight: 400 500;
  font-display: swap;
  src: url("fonts/ibm-plex-mono-400.woff2") format("woff2");
}}

/* ---------------------------------------------------------------- base ---- */

*, *::before, *::after {{ box-sizing: border-box; }}

body.ui {{
  margin: 0;
  background: var(--background);
  color: var(--foreground);
  font: var(--text-base)/var(--leading-base) var(--font-primary);
  -webkit-text-size-adjust: 100%;
}}

.ui-wrap {{ max-width: var(--content-max); margin: 0 auto; padding: var(--space-4); }}

.ui-header {{
  padding: var(--space-4) var(--space-4) var(--space-3);
  border-bottom: 1px solid var(--border);
  background: var(--background);
}}
.ui-header h1 {{ margin: 0; font-size: var(--text-lg); font-weight: 400; }}
.ui-header h1 em {{ font-style: normal; color: var(--accent); }}
.ui-lede {{ color: var(--muted-foreground); font-size: var(--text-sm); margin-top: var(--space-1);
  max-width: 72ch; }}

.ui-tabs {{
  display: flex; gap: 2px; overflow-x: auto;
  padding: var(--space-2) var(--space-4) 0;
  border-bottom: 1px solid var(--border);
  position: sticky; top: 0; z-index: 30; background: var(--background);
}}
.ui-tabs button {{
  background: none; border: 0; border-bottom: 2px solid transparent;
  color: var(--muted-foreground); padding: var(--space-2) var(--space-3);
  font: inherit; font-size: var(--text-sm); cursor: pointer; white-space: nowrap;
}}
.ui-tabs button[aria-selected="true"] {{ color: var(--foreground); border-bottom-color: var(--accent); }}
.ui-tabs button:focus-visible {{ outline: 2px solid var(--ring); outline-offset: -2px; }}

/* ---------------------------------------------------------- containers ---- */

/* THE SANS IS NEVER BOLD AND NEVER TRACKED (operator, 2026-08-20). Inter's regular weight is
   the design; hierarchy comes from size, face (serif display / mono label), colour and case.
   Browser defaults are the main leak -- plain headings at 700, <strong> at bold -- so they are
   reset here. <strong> keeps its semantics and is marked by full-strength ink instead of weight,
   which still reads as emphasis inside the muted body colour. Mono keeps its 500 (a label
   idiom, not running text); the display serif was already 400. */
h1, h2, h3, h4, h5, h6 {{ font-weight: 400; }}
b, strong {{ font-weight: 400; color: var(--foreground); }}

.ui-card {{
  background: var(--card); border: 1px solid var(--border);
  border-radius: var(--radius); padding: var(--space-4);
  margin: 0 0 var(--space-4);
}}
/* Uppercase section kicker for a plain h2. NOT for .ui-display headings: uppercase text is
   always mono in this system (an uppercased serif display face is the one combination the
   type rules forbid), so the display variant is excluded and keeps its own family and case. */
.ui-card > h2:not(.ui-display) {{
  margin: 0 0 var(--space-2); font-size: var(--text-sm);
  font-family: var(--font-mono); font-weight: 500;
  letter-spacing: .05em; text-transform: uppercase; color: var(--muted-foreground);
  display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap;
}}
.ui-card > h2.ui-display {{ margin: 0 0 var(--space-2); }}
.ui-card > h3, .ui-card h3 {{ margin: var(--space-4) 0 var(--space-1); font-size: var(--text-base); }}

.ui-row {{ display: flex; gap: var(--space-3); flex-wrap: wrap; align-items: center; }}
.ui-grid {{ display: grid; gap: var(--space-3);
  grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); }}
.ui-split {{ display: grid; grid-template-columns: 1fr 1fr; gap: var(--space-3); }}
@media (max-width: 560px) {{ .ui-split {{ grid-template-columns: 1fr; }} }}

/* ------------------------------------------------------------ controls ---- */

.ui-btn {{
  background: var(--muted); border: 1px solid var(--border); color: var(--foreground);
  border-radius: var(--radius-sm); padding: 9px 14px;
  font: inherit; font-size: var(--text-sm); cursor: pointer;
  transition: border-color var(--motion-fast) var(--ease), background var(--motion-fast) var(--ease);
}}
.ui-btn:hover {{ border-color: var(--border-strong); }}
.ui-btn:focus-visible {{ outline: 2px solid var(--ring); outline-offset: 2px; }}
.ui-btn--primary {{ background: var(--accent); border-color: var(--accent);
  color: var(--background); }}
.ui-btn--ghost {{ background: none; border-color: transparent; color: var(--muted-foreground); }}
.ui-btn[aria-pressed="true"] {{ background: var(--accent); border-color: var(--accent);
  color: var(--background); }}

.ui-field {{ display: flex; flex-direction: column; gap: var(--space-1);
  font-size: var(--text-xs); color: var(--muted-foreground); min-width: 130px; flex: 1; }}
.ui-field > select, .ui-field > input {{ font-size: var(--text-sm); }}

select, input[type="text"], input[type="number"] {{
  background: var(--muted); border: 1px solid var(--border); color: var(--foreground);
  border-radius: var(--radius-sm); padding: 7px 9px; font: inherit; font-size: var(--text-sm);
}}
input[type="range"] {{
  background: var(--muted); border: 1px solid var(--border);
  border-radius: var(--radius-sm); height: 26px; padding: 0; accent-color: var(--accent);
}}
select:focus-visible, input:focus-visible {{ outline: 2px solid var(--ring); outline-offset: 1px; }}

progress {{ width: 100%; height: 6px; appearance: none; border: 0;
  background: var(--muted); border-radius: 3px; }}
progress::-webkit-progress-bar {{ background: var(--muted); border-radius: 3px; }}
progress::-webkit-progress-value {{ background: var(--accent); border-radius: 3px; }}

/* --------------------------------------------------------------- text ----- */

.ui-note {{ color: var(--muted-foreground); font-size: var(--text-sm); }}
.ui-mono {{ font-family: var(--font-mono); font-size: var(--text-sm); }}

/* ---- the Instrument type primitives ---------------------------------------------------
   Three roles, and the split is the point: a display serif for headings, Inter for
   running text, uppercase mono for labels. A project gets these by using the classes;
   it does not have to adopt the instrument COLOUR theme to use them. */
.ui-display {{
  font-family: var(--font-display);
  font-weight: 400;
  line-height: 1.06;
  letter-spacing: -.015em;
  text-transform: none;   /* the serif is NEVER uppercased -- uppercase belongs to the mono */
  text-wrap: balance;
  margin: 0;
}}
.ui-display--1 {{ font-size: var(--display-1); }}
.ui-display--2 {{ font-size: var(--display-2); line-height: 1.15; }}
.ui-display--3 {{ font-size: var(--display-3); line-height: 1.25; }}

/* The uppercase mono label -- eyebrows, section kickers, data captions. The
   letter-spacing is not decoration: mono uppercase at 10.5px is unreadable without it. */
.ui-label {{
  font-family: var(--font-mono);
  font-size: var(--text-xs);
  font-weight: 500;
  letter-spacing: .12em;
  text-transform: uppercase;
  color: var(--faint-foreground);
  margin: 0;
}}
.ui-label--accent {{ color: var(--accent); }}

/* Standfirst / subtitle. Body size on purpose (2026-08-20) -- it differs from running text
   by colour and measure, not by being bigger. */
.ui-standfirst {{
  font-size: var(--text-base);
  line-height: 1.5;
  color: var(--muted-foreground);
  max-width: 34rem;
  text-wrap: pretty;
  margin: 0;
}}

/* Readout: figures that were measured, set in mono and aligned. */
.ui-readout {{
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(9.5rem, 1fr));
  gap: 1px;
  background: var(--border);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  overflow: hidden;
}}
.ui-readout > div {{ background: var(--surface); padding: var(--space-3) var(--space-4); }}
.ui-readout dt {{
  font-family: var(--font-mono); font-size: var(--text-xs); font-weight: 500;
  letter-spacing: .08em; text-transform: uppercase;
  color: var(--faint-foreground); margin: 0 0 var(--space-1);
}}
.ui-readout dd {{
  margin: 0; font-family: var(--font-mono); font-size: var(--text-lg); font-weight: 500;
  font-variant-numeric: tabular-nums; color: var(--foreground);
}}
.ui-readout dd small {{
  display: block; font-family: var(--font-sans); font-size: var(--text-sm);
  font-weight: 400; letter-spacing: 0; color: var(--muted-foreground);
  margin-top: var(--space-1);
}}
.ui-hero {{ font-size: var(--text-hero); line-height: var(--leading-tight); }}
.ui-stat {{ font-size: var(--text-xl); font-variant-numeric: tabular-nums; }}

/* The rule this whole system exists to protect: a MEASURED number and a
   PREDICTED one may never share styling, in any project, ever. */
.ui-measured {{ color: var(--measured); font-variant-numeric: tabular-nums; }}
.ui-predicted {{ color: var(--predicted); font-variant-numeric: tabular-nums; font-style: italic; }}

table.ui-table {{ width: 100%; border-collapse: collapse; font-size: var(--text-sm); }}
.ui-table th, .ui-table td {{ text-align: left; padding: 6px 8px;
  border-bottom: 1px solid var(--border); vertical-align: top; }}
.ui-table th {{ color: var(--muted-foreground); font-weight: 500; font-size: var(--text-xs);
  font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .05em; }}
.ui-scroll-x {{ overflow-x: auto; }}

a {{ color: var(--accent); }}

/* --------------------------------------------------------- epistemic ------ */

.ui-tier {{
  display: inline-flex; align-items: center; gap: 4px;
  font-size: var(--text-xs); letter-spacing: .05em; text-transform: uppercase;
  border: 1px solid currentColor; border-radius: var(--radius-pill);
  padding: 1px 8px; vertical-align: 1px; white-space: nowrap;
  background: none; font-family: var(--font-mono); cursor: help;
}}
.ui-tier__glyph {{ font-size: 9px; line-height: 1; }}
.ui-tier:focus-visible {{ outline: 2px solid var(--ring); outline-offset: 2px; }}
.ui-tier[data-family="measured"]  {{ color: var(--measured); }}
.ui-tier[data-family="predicted"] {{ color: var(--predicted); }}
.ui-tier[data-family="exploring"] {{ color: var(--exploring); }}
.ui-tier[data-family="spec"]      {{ color: var(--spec); }}
.ui-tier[data-family="refuted"]   {{ color: var(--refuted); }}

.ui-rule {{ border-left: 3px solid var(--border-strong); padding-left: var(--space-3); }}
.ui-rule--measured  {{ border-left-color: var(--measured); }}
.ui-rule--predicted {{ border-left-color: var(--predicted); }}
.ui-rule--exploring {{ border-left-color: var(--exploring); }}
.ui-rule--spec      {{ border-left-color: var(--spec); }}
.ui-rule--refuted   {{ border-left-color: var(--refuted); }}

.ui-pill {{ font-size: var(--text-xs); color: var(--muted-foreground);
  background: var(--muted); border-radius: var(--radius-pill); padding: 2px 8px; }}

/* ---------------------------------------------------- notes & tooltips ---- */

/* The inline marker left behind when an explanation moves into the drawer.
   Small, quiet, always reachable by keyboard. */
.ui-marker {{
  display: inline-flex; align-items: center; justify-content: center;
  width: 15px; height: 15px; margin-left: 4px; vertical-align: 1px;
  border: 1px solid var(--border-strong); border-radius: var(--radius-pill);
  color: var(--muted-foreground); background: none;
  font: 500 10px/1 var(--font-primary); cursor: pointer; padding: 0;
  transition: color var(--motion-fast) var(--ease), border-color var(--motion-fast) var(--ease);
}}
.ui-marker:hover, .ui-marker:focus-visible {{ color: var(--foreground); border-color: var(--ring); }}
.ui-marker:focus-visible {{ outline: 2px solid var(--ring); outline-offset: 2px; }}
.ui-marker[data-family="refuted"] {{ color: var(--refuted); border-color: var(--refuted); }}

.ui-tooltip {{
  position: fixed; z-index: 90; max-width: 340px;
  background: var(--popover); color: var(--foreground);
  border: 1px solid var(--border-strong); border-radius: var(--radius-sm);
  padding: var(--space-2) var(--space-3); font-size: var(--text-sm);
  box-shadow: 0 8px 28px var(--shadow); pointer-events: none;
  opacity: 0; transform: translateY(2px);
  transition: opacity var(--motion-fast) var(--ease), transform var(--motion-fast) var(--ease);
}}
.ui-tooltip[data-open="true"] {{ opacity: 1; transform: none; }}
.ui-tooltip__more {{ display: block; margin-top: var(--space-1);
  color: var(--faint-foreground); font-size: var(--text-xs); }}

/* ------------------------------------------------------------- drawer ----- */

.ui-docs-btn {{
  position: fixed; right: var(--space-4); bottom: var(--space-4); z-index: 60;
  display: inline-flex; align-items: center; gap: 6px;
}}

.ui-backdrop {{
  position: fixed; inset: 0; z-index: 70; background: var(--overlay);
  opacity: 0; pointer-events: none; transition: opacity var(--motion-base) var(--ease);
}}
.ui-backdrop[data-open="true"] {{ opacity: 1; pointer-events: auto; }}

.ui-drawer {{
  position: fixed; top: 0; right: 0; bottom: 0; z-index: 80;
  width: min(var(--drawer-width), 100vw);
  background: var(--card); border-left: 1px solid var(--border);
  box-shadow: -16px 0 48px var(--shadow);
  display: flex; flex-direction: column;
  transform: translateX(100%);
  transition: transform var(--motion-slow) var(--ease);
}}
.ui-drawer[data-open="true"] {{ transform: none; }}
@media (max-width: 560px) {{
  .ui-drawer {{ width: 100vw; }}
}}

.ui-drawer__head {{
  padding: var(--space-3) var(--space-4); border-bottom: 1px solid var(--border);
  display: flex; align-items: center; gap: var(--space-2);
}}
.ui-drawer__head h2 {{ margin: 0; font-size: var(--text-base); flex: 1; }}
.ui-drawer__body {{ overflow-y: auto; padding: var(--space-4); }}
.ui-drawer__toc {{ margin: 0 0 var(--space-4); padding: 0; list-style: none;
  font-size: var(--text-sm); }}
.ui-drawer__toc a {{ color: var(--muted-foreground); text-decoration: none; }}
.ui-drawer__toc a:hover {{ color: var(--foreground); }}
.ui-drawer__section {{ margin: 0 0 var(--space-2); font-size: var(--text-xs);
  font-family: var(--font-mono); text-transform: uppercase; letter-spacing: .06em;
  color: var(--faint-foreground); }}

.ui-entry {{ padding: var(--space-3) 0; border-bottom: 1px solid var(--border); }}
.ui-entry:last-child {{ border-bottom: 0; }}
.ui-entry__title {{ font-size: var(--text-base); margin: 0 0 var(--space-1);
  display: flex; align-items: center; gap: var(--space-2); flex-wrap: wrap; }}
.ui-entry__body {{ color: var(--muted-foreground); font-size: var(--text-sm); }}
.ui-entry__body p {{ margin: 0 0 var(--space-2); }}
.ui-entry[data-flash="true"] {{ animation: ui-flash 1.2s var(--ease); }}
@keyframes ui-flash {{ from {{ background: color-mix(in oklab, var(--ring) 22%, transparent); }}
  to {{ background: transparent; }} }}

/* ------------------------------------------------------ audio primitives --- */
/* Foundation + audio primitives only (2026-08-04) -- waveform, transport,
   region markers, spectrogram wrapper, icons, tags. Screen-specific layouts
   (corpus browser table, notebook citation block, mobile bezel) are
   documented patterns in CLAUDE.md, not built here yet: build them when a
   project actually needs them (tools/PROTOCOL.md P3-E1). */

.ui-eyebrow {{
  font-size: 10px; line-height: 1; font-weight: 500; letter-spacing: .20em;
  text-transform: uppercase; color: var(--faint-foreground); font-family: var(--font-mono);
}}

.ui-icon {{ width: 1em; height: 1em; display: inline-block; vertical-align: -0.125em;
  fill: currentColor; }}

/* Waveform: SVG path from a precomputed peaks array (never decode full audio
   to draw one -- see tokens.json audio.waveform). The played portion is the
   SAME path re-stroked in clay and clipped, not a second dataset. */
.ui-waveform {{
  background: var(--background); border-radius: var(--radius-md, 4px);
  padding-top: 18px; overflow: hidden; position: relative;
}}
.ui-waveform svg {{ display: block; width: 100%; }}
.ui-waveform path.ui-waveform__bg {{
  fill: none; stroke: var(--muted, {aud["waveform"]["inactive"]});
  stroke-width: {aud["waveform"]["strokeWidth"]["detail"]};
}}
.ui-waveform path.ui-waveform__played {{
  fill: none; stroke: var(--clay, {aud["waveform"]["active"]});
  stroke-width: {aud["waveform"]["strokeWidth"]["detail"]};
}}
.ui-waveform__playhead {{
  position: absolute; top: 0; bottom: 0; width: 1px; background: var(--foreground);
  pointer-events: none;
}}
.ui-waveform__playhead::before {{
  content: ""; position: absolute; top: -1px; left: 50%; transform: translateX(-50%);
  width: 9px; height: 9px; border-radius: 50%; background: var(--foreground);
}}

/* Region marker: overlay on a waveform/spectrogram, tint fill + left border in
   the label's colour, 10px label pinned top-left. Drag-resizable is a JS
   concern (position via left/width %); this is the visual shell only. */
.ui-region-marker {{
  position: absolute; top: 0; bottom: 0;
  border-left: 1px solid var(--ochre); background: var(--ochre-tint);
}}
.ui-region-marker[data-kind="attention"] {{ border-left-color: var(--clay); background: var(--clay-tint); }}
.ui-region-marker__label {{
  position: absolute; top: 2px; left: 4px; font-size: 10px; font-family: var(--font-primary);
  color: var(--ochre); white-space: nowrap;
}}
.ui-region-marker[data-kind="attention"] .ui-region-marker__label {{ color: var(--clay); }}

/* Spectrogram: <canvas>, six-stop ramp from tokens.json audio.spectrogram.ramp.
   This is just the well/frame -- drawing the ramp is a script concern. */
.ui-spectrogram {{
  background: var(--background); border-radius: var(--radius-md, 4px);
  overflow: hidden; position: relative;
}}
.ui-spectrogram canvas {{ display: block; width: 100%; }}

/* Transport: play/pause + skip/repeat row. Primary button size/shadow from
   tokens.json audio.transport; every control here clears the 44px touch
   target one way or another (padding on the smaller icon buttons). */
.ui-transport {{ display: flex; align-items: center; gap: var(--space-3); }}
.ui-transport__play {{
  width: {aud["transport"]["primary"]}px; height: {aud["transport"]["primary"]}px;
  border-radius: 50%; border: 0; background: var(--clay); color: var(--background);
  display: inline-flex; align-items: center; justify-content: center; cursor: pointer;
  box-shadow: 0 3px 12px var(--clay-tint);
  transition: background var(--motion-fast) var(--ease);
}}
.ui-transport__play:hover {{ background: var(--clay-hover); }}
.ui-transport__play:active {{ background: var(--clay-press); }}
.ui-transport__play:focus-visible {{ outline: 2px solid var(--ring); outline-offset: 2px; }}
.ui-transport__play--mobile {{
  width: {aud["transport"]["mobilePrimary"]}px; height: {aud["transport"]["mobilePrimary"]}px;
  box-shadow: 0 4px 18px var(--clay-tint);
}}
.ui-transport__btn {{
  background: none; border: 0; color: var(--muted-foreground); cursor: pointer;
  display: inline-flex; align-items: center; justify-content: center;
  min-width: {aud["transport"]["minTouchTarget"]}px; min-height: {aud["transport"]["minTouchTarget"]}px;
}}
.ui-transport__btn:hover {{ color: var(--foreground); }}
.ui-transport__btn[aria-pressed="true"] {{ color: var(--clay); }}
.ui-transport__btn:focus-visible {{ outline: 2px solid var(--ring); outline-offset: 2px; }}
.ui-transport__time {{ font-family: var(--font-primary); font-variant-numeric: tabular-nums;
  font-size: var(--text-sm); min-width: 104px; text-align: center; color: var(--foreground); }}

/* Live-recording indicator. Capped duration/easing so it can be globally
   disabled by prefers-reduced-motion (see bottom of this file) without a
   separate override. */
@keyframes {pulse["name"]} {{
  0%, 100% {{ opacity: .35; }}
  50% {{ opacity: 1; }}
}}
.ui-live-dot {{
  display: inline-flex; align-items: center; gap: 6px; color: var(--clay);
  font-size: var(--text-xs); font-family: var(--font-primary);
}}
.ui-live-dot::before {{
  content: ""; width: 7px; height: 7px; border-radius: 50%; background: currentColor;
  animation: {pulse["name"]} {pulse["duration"]} {pulse["easing"]} infinite;
}}

/* Tag/chip: audio-ink tinted variants, distinct from .ui-pill (which stays
   neutral/epistemic-safe). Never reuse these for tier/epistemic meaning. */
.ui-tag {{
  display: inline-flex; align-items: center; gap: 4px; font-size: var(--text-xs);
  font-family: var(--font-primary); border-radius: var(--radius-sm); padding: 3px 10px;
  border: 1px solid var(--border-strong); color: var(--muted-foreground); background: none;
}}
.ui-tag--clay {{ background: var(--clay-tint); border-color: transparent; color: var(--clay); }}
.ui-tag--ochre {{ background: var(--ochre-tint); border-color: transparent; color: var(--ochre); }}
.ui-tag--lichen {{ background: var(--lichen-tint); border-color: transparent; color: var(--lichen-text); }}

.ui-sr {{ position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
  overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; border: 0; }}

@media (prefers-reduced-motion: reduce) {{
  *, *::before, *::after {{ transition-duration: 1ms !important; animation-duration: 1ms !important; }}
}}
"""


def render() -> str:
    return (BANNER
            + "\n/* INSTRUMENT is the default as of 2026-08-19, at the operator's request that other\n"
            + " * projects adopt the attend-to-send briefing look. Three type roles -- Instrument\n"
            + " * Serif for headings, Inter for running text, uppercase IBM Plex Mono for labels --\n"
            + " * and a cool bench palette with ONE saturated accent.\n"
            + " *\n"
            + " * It is the first theme here with a real LIGHT AND DARK pair, so it follows the\n"
            + " * three-state rule properly: bare :root is the full light palette; the media query\n"
            + " * is guarded with :not([data-theme]) so an explicit stamp always beats the OS; and\n"
            + " * both stamps re-declare the tokens so a toggle wins in either direction. The\n"
            + " * un-stamped default-system state is the one most viewers are in and it is the one\n"
            + " * most often got wrong.\n"
            + " *\n"
            + " * A PROJECT KEEPS ITS OLD LOOK BY PINNING A THEME EXPLICITLY -- data-theme=\"polarize\"\n"
            + " * (the warm-dark 2026-08-04 default) or \"dark\" (the pre-Polarize slate). That is the\n"
            + " * same opt-out tuning-forks used through the Polarize migration and it still works. */\n"
            + ":root {\n" + _vars("instrument") + "\n  color-scheme: light;\n}\n\n"
            + "@media (prefers-color-scheme: dark) {\n"
            + "  :root:not([data-theme]) {\n" + _vars("instrument-dark", indent=4)
            + "\n    color-scheme: dark;\n  }\n}\n\n"
            + ":root[data-theme=\"instrument\"] {\n" + _vars("instrument") + "\n  color-scheme: light;\n}\n\n"
            + ":root[data-theme=\"instrument-dark\"] {\n" + _vars("instrument-dark") + "\n  color-scheme: dark;\n}\n\n"
            + "/* Previous defaults, kept as explicit opt-ins. */\n"
            + ":root[data-theme=\"polarize\"] {\n" + _vars("polarize") + "\n  color-scheme: dark;\n}\n\n"
            + ":root[data-theme=\"light\"] {\n" + _vars("light") + "\n  color-scheme: light;\n}\n\n"
            + ":root[data-theme=\"dark\"] {\n" + _vars("dark") + "\n  color-scheme: dark;\n}\n"
            + _static())


def main() -> int:
    css = render()
    if "--check" in sys.argv:
        if not OUT.exists():
            print("design.css is missing -- run build_css.py")
            return 1
        if OUT.read_text() != css:
            print("design.css is STALE -- run build_css.py")
            return 1
        print("design.css is up to date")
        return 0
    OUT.write_text(css)
    print(f"wrote {OUT} ({len(css)} bytes)")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
