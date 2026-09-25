# INTEGRATION.md — wiring a project into `design/`

Two files to link, one server route to add, then write markup against the
classes. No build step, no npm, no network.

The worked example is **`tuning-forks/`** — copy from there.

---

## 1. Serve the folder

Same allow-list pattern as `sound-fx` (never a directory mount):

```python
DESIGN = (APP_DIR.parent / "design").resolve()
DESIGN_PUBLIC = {
    "/design/design.css":  DESIGN / "design.css",
    "/design/design.js":   DESIGN / "design.js",
    "/design/tokens.json": DESIGN / "tokens.json",
    # The UI font is a SYSTEM STACK -- nothing to serve. These two are the
    # optional serif (Literata), needed only if your project asks for
    # var(--font-serif). Serve them or don't; design.css degrades to Georgia.
    "/design/fonts/literata-normal-variable.woff2": DESIGN / "fonts" / "literata-normal-variable.woff2",
    "/design/fonts/literata-italic-400.woff2":      DESIGN / "fonts" / "literata-italic-400.woff2",
    "/design/icons/polarize-icons.svg": DESIGN / "icons" / "polarize-icons.svg",
}

def translate_path(self, path):
    clean = path.split("?", 1)[0].split("#", 1)[0]
    for prefix in ("/my-app", ""):            # tailscale may or may not strip the mount
        key = clean[len(prefix):] if prefix and clean.startswith(prefix) else clean
        if key in DESIGN_PUBLIC:
            return str(DESIGN_PUBLIC[key])
    return super().translate_path(path)
```

Treat it as an optional sibling — someone may have checked your project out
alone. If `design.css` 404s the app must still work, just unstyled. The two
font files and the icon sprite are only fetched when `design.css` actually
needs them (a `@font-face` `src`, or your own `<use href="design/icons/...">`)
— they don't need special-casing beyond being in the allow-list above.

## 2. Link it

```html
<link rel="stylesheet" href="design/design.css">
<script type="module" src="design/design.js"></script>
...
<body class="ui">
```

`design.js` is a module and is safe to load in `<head>`; it defines the elements
and creates the drawer on demand.

**Theme.** Nothing else needed — a new project is **Polarize** (warm-dark,
serif) automatically. To keep the older gold-accent-on-slate look instead
(e.g. an existing project migrating in that doesn't want to change its
palette this trip), set it explicitly:

```html
<html data-theme="dark">   <!-- pre-2026-08-04 look, opt-in only -->
```

## 3. Markup

```html
<header class="ui-header">
  <h1>Tuning <em>Forks</em> — what this is</h1>
  <div class="ui-lede">One sentence. The paragraph goes in a note.</div>
</header>

<nav class="ui-tabs" id="tabs">
  <button data-tab="one" aria-selected="true">One</button>
</nav>

<main class="ui-wrap">
  <section class="ui-card">
    <h2>Panel title</h2>
    <div class="ui-row">
      <label class="ui-field">Distance<input type="range"></label>
      <button class="ui-btn ui-btn--primary">Play</button>
    </div>
  </section>
</main>
```

| Need | Use |
|---|---|
| panel | `.ui-card` (+ `<h2>`) |
| horizontal controls | `.ui-row`, `.ui-field` |
| buttons | `.ui-btn`, `+ --primary`, `+ --ghost`, `aria-pressed` for toggles |
| tables | `table.ui-table`, wrapped in `.ui-scroll-x` if wide |
| small print | `.ui-note` |
| numbers | `.ui-mono`, `.ui-stat`, `.ui-hero` |
| a measured value | `.ui-measured` |
| a modelled value | `.ui-predicted` |
| coloured left rule | `.ui-rule .ui-rule--refuted` (or `--measured`, `--spec`, …) |
| section label | `.ui-eyebrow` |
| icon | `<svg class="ui-icon"><use href="#ph-play"/></svg>` — a LOCAL fragment; `design.js` inlines the sprite into the document for you, so never point `href` at the file path (cross-document SVG `<use>` is unreliable, verified) |
| waveform | `.ui-waveform` (see `tokens.json` `audio.waveform` for the SVG-path convention) |
| spectrogram | `.ui-spectrogram` (canvas well; you draw the ramp) |
| region marker | `.ui-region-marker` (+ `data-kind="attention"` for the clay variant) |
| transport row | `.ui-transport` → `.ui-transport__play`, `__btn`, `__time` |
| live-recording dot | `.ui-live-dot` |
| audio-ink tag | `.ui-tag--clay` / `--ochre` / `--lichen` (never a tier colour — see CLAUDE.md) |

Audio-ink colours (`--clay`, `--ochre`, `--lichen`, and their tint/hover/press
steps) are only defined under the Polarize theme — they're absent if a project
opts into `data-theme="dark"` or `="light"`. Don't reference them from a
project that might run under the classic theme.

## 4. The part that matters: hide the prose

**Before** — the pattern to stop writing:

```html
<p class="note">MODELLED, not measured. Real tines are never identical and a
struck fork audibly warbles; 0.0009 gives about 0.23 Hz of beating on a 256 Hz
fork. The number was chosen by ear. DO NOT read this as the cause of the big
wah-wah you get waving a fork past your ear — that is the quadrupole lobe
pattern, it is tier A, and it is modelled separately.</p>
```

**After** — the badge stays, the essay moves:

```html
Tine mistune <ui-tier tier="MODELLED"></ui-tier>
<ui-note title="Tine mistune" section="Realism layers" tier="MODELLED">
  <p>Real tines are never identical and a struck fork audibly warbles; 0.0009
  gives about 0.23 Hz of beating on a 256 Hz fork. The number was chosen by ear.</p>
  <p>Do <b>not</b> read this as the cause of the big wah-wah you get waving a fork
  past your ear — that is the quadrupole lobe pattern, it is tier A, and it is
  modelled separately.</p>
</ui-note>
```

That renders as `Tine mistune ◇MODELLED ⓘ`. The badge is unmissable; the marker
opens the drawer at that entry.

> **Never wrap a `<ui-note>` in a `<p>`.** The HTML parser auto-closes a `<p>` the
> moment a block element appears inside it, so the note's `<p>` children are
> hoisted *out* of the component before it can collapse them — and the
> disclaimer renders in full, which is the one failure this system exists to
> prevent. Use a `<div>`. This bit us once, in a header lede, on 2026-08-01; the
> project's own `dev_check.py` now greps for it.

- `section` groups entries in the drawer and builds its table of contents. Use a
  few stable sections, not one per note.
- `tier` is optional and repeats the badge inside the drawer entry.
- Body is ordinary HTML.

**A one-line hint on any element** — no drawer entry, tooltip only:

```html
<span data-doc="kr &lt; 1 means the near field: four lobes, not two.">near field</span>
```

**From script**, for text that arrives from an API:

```js
import { addDoc, marker } from './design/design.js';
const a = addDoc({ title: r.id, section: 'Refuted', tier: 'REFUTED', body: `<p>${r.reason}</p>` });
el.appendChild(marker(a, { family: 'refuted' }));
```

## 5. Charts

```js
import { seriesColors } from './design/design.js';
```

Fixed order, never cycled. **Cap at three** for scatter / bubble / small
multiples — only the first three slots clear the all-pairs colour-blindness
floors; past three, fold to "Other" or facet. Never use a tier colour for a
series, or a series colour for a tier.

## 6. Check it

```bash
python3 design/dev_check.py
```

And in your project's own `dev_check.py`, assert the two rules that travel with
the design system rather than with any one app:

```python
html = (HERE / "index.html").read_text()
ok("no inline :root palette -- the tokens are the source",
   ":root{" not in html.replace(" ", ""))
ok("measured and predicted never share styling",
   "ui-measured" in html or "ui-measured" in (HERE / "ui.js").read_text())
```

---

## The rule, once more

**A label may never be hidden. Its explanation must be.**

If you find yourself putting a tier badge inside a `<ui-note>`, stop — that is
backwards, and it is the one way to use this system that makes a project less
honest than it was before.

---

## The Instrument type roles (2026-08-19 default)

Three roles, and keeping them separate is the whole point. Use the classes; you do not have to
adopt the colour theme to get the type.

```html
<p class="ui-label ui-label--accent">DIY bench · n-of-1 · not yet run</p>
<h1 class="ui-display ui-display--1">Attend to Send</h1>
<p class="ui-standfirst">One sentence saying what this page is for.</p>
<p>Running text. Inter, 14px, at a comfortable measure.</p>

<h2 class="ui-display ui-display--2">A section</h2>
<p class="ui-label">An uppercase mono kicker under it</p>
```

| Class | Role |
|---|---|
| `.ui-display--1` | page title — fluid, `clamp(2.3rem, 6vw, 3.4rem)` |
| `.ui-display--2` | section heading |
| `.ui-display--3` | sub-section |
| `.ui-label` | uppercase mono eyebrow/kicker; `--accent` modifier tints it |
| `.ui-standfirst` | the subtitle — one step above body, **not** a second heading |
| `.ui-readout` | measured figures in tabular mono, with a caption under each |

**Do not set `--font-display` on body copy.** Instrument Serif has no optical-size axis and goes
spindly below ~20px. If you want a serif for *running* text, that is `--font-serif` (Literata,
which does have an opsz axis).

### Measured figures

```html
<dl class="ui-readout">
  <div><dt>Sample rate</dt><dd>250.0 Hz<small>measured from timestamps</small></dd></div>
  <div><dt>Mains pickup</dt><dd>+32.2 dB<small>60 Hz, p = 2e-26</small></dd></div>
</dl>
```

Values are mono and `tabular-nums`, so columns of digits line up. The `<small>` says where the
number came from — which is the repo's standing habit, not decoration.

### Keeping an older look

```html
<html data-theme="polarize">   <!-- warm-dark, the 2026-08-04 default -->
<html data-theme="dark">       <!-- the pre-Polarize slate -->
```

---

## Two things that bit every project on 2026-08-19 — copy this, do not hand-roll it

### 1. Serve `fonts/` by PREFIX, never by name

The original snippet listed Literata's two files literally. The moment the shared system gained the
Instrument triad, every project 404'd the new faces and **silently fell back to a system font** —
invisible until you look at a screenshot and wonder why the headings are wrong.

```python
def _design_font(key):
    """Any self-hosted face under design/fonts/. Constrained, not a directory mount:
    one fixed directory, .woff2 only, basename only — no traversal."""
    name = key[len("/design/fonts/"):]
    if "/" in name or ".." in name or not name.endswith(".woff2"):
        return None
    f = (DESIGN / "fonts" / name).resolve()
    return str(f) if f.is_file() and f.parent == (DESIGN / "fonts").resolve() else None

# inside translate_path, after the DESIGN_PUBLIC lookup:
if key.startswith("/design/fonts/"):
    hit = _design_font(key)
    if hit:
        return hit
```

A new face in the shared system then reaches every project with no per-project edit, which is the
entire point of a shared system.

### 2. Serve design assets `no-store`

Without this the browser holds the previous `design.css` indefinitely, so **a change in
`tools/design` reaches no project until someone hard-reloads** — and the failure is invisible: the
page renders with the old rules and the new classes simply do nothing.

```python
def end_headers(self):
    path = self.path.split("?", 1)[0]
    if path.startswith("/design/") or path.endswith((".css", ".js", ".html")):
        self.send_header("Cache-Control", "no-store")
    super().end_headers()
```

### 3. Keep `app.css` to LAYOUT only

The reference implementation is `falsify/attention-at-a-site/app.css`, whose rule is: **no hex colours,
no `font-family`, no `font-size` literals.** Everything takes a token. That is what lets a change
here reach a project without touching it — and a project whose own CSS sets `h1 { font-family: … }`
will silently override the shared display face.

### 4. Style `body.ui`, not `body`

`design.css` styles **`body.ui`** — specificity (0,1,1), which beats a bare `body` (0,0,1)
*regardless of file order*. A project that writes

```css
body { max-width: 62rem; margin: 0 auto; padding: 2rem; }   /* ← margin is IGNORED */
```

loses the centring to the shared `body.ui { margin: 0 }` and ends up pinned to the left edge.
Match the specificity:

```css
body.ui { max-width: var(--content-max); margin: 0 auto; padding: var(--space-6) var(--space-5); }
```

### 5. An undefined token is SILENT, and takes its whole declaration with it

```css
padding: var(--space-6) var(--space-5) var(--space-9);   /* --space-9 did not exist */
```

That is not "two-thirds of a padding" — an unresolvable `var()` invalidates the **entire**
declaration at computed-value time, so the element got **no padding at all**, and nothing was
reported anywhere. `tools/dev_check.py` now scans every project's CSS for tokens that
`design.css` does not define and that have no fallback, and fails on them. If you genuinely want a
value the system does not have, either add it to `tokens.json` (preferred — other projects will
want it too) or give it a fallback: `var(--space-9, 96px)`.

The scale currently runs `--space-1` (4px) through `--space-9` (96px). 8 and 9 were added on
2026-08-19 precisely because a consumer reached for them and got silence.
