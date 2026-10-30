import os,json,datetime
P='project/'
def w(p,s):
    os.makedirs(os.path.dirname(P+p),exist_ok=True); open(P+p,'w').write(s)
w('README.md','''Polarize UI is a design system for interfaces that show scientific data honestly. Every measured, modelled or speculative value carries a label, and the label can never be hidden.

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
''')
def card(group,h,sub,body,css=''):
    return f'<!-- @dsCard group="{group}" height={h} subtitle="{sub}" -->\n<style>body{{padding:16px;margin:0}}{css}</style>\n<body class="ui">\n{body}\n</body>'
tier=lambda fam,g,l:f'<span class="ui-tier" data-family="{fam}"><span class="ui-tier__glyph" aria-hidden="true">{g}</span>{l}</span>'
tiers=''.join(tier(*a) for a in [('measured','◆','MEASURED'),('predicted','▲','PREDICTED'),('exploring','●','EXPLORATORY'),('spec','◇','TASTE'),('refuted','✕','REFUTED')])
comps={
'Tier':('Evidence','Evidence badge: glyph + word + colour, never collapsible',150,f'''<div class="ui-row">{tiers}</div>
<p style="margin-top:16px"><span class="ui-measured">12.4 Hz</span> measured &nbsp; <span class="ui-predicted">13.1 Hz</span> predicted</p>''',
'''A tier badge states how much to trust a claim. It always shows a glyph, a word and a colour, and it cannot be hidden or shortened.

Use `<ui-tier tier="MEASURED">` (from `design.js`) or the markup `<span class="ui-tier" data-family="measured"><span class="ui-tier__glyph">◆</span>MEASURED</span>`. Tier ids: A, B, C, SPEC, MEASURED, PHYSICS, PREDICTED, MODELLED, EXPLORATORY, ADDED, TASTE, REFUTED.

The consumer provides the tier id and puts the explanation in a `ui-note`.

- Do render values with `.ui-measured` (upright) or `.ui-predicted` (italic).
- Do not add a compact, icon-only or hide-label variant.
- Do not reuse a tier colour for a chart series or a status.'''),
'Button':('Actions','Default, primary, ghost, pressed, focus',110,'''<div class="ui-row"><button class="ui-btn">Default</button><button class="ui-btn ui-btn--primary">Primary</button><button class="ui-btn ui-btn--ghost">Ghost</button><button class="ui-btn" aria-pressed="true">Pressed</button></div>''',
'''Buttons are `.ui-btn` with `--primary` or `--ghost`; a toggle sets `aria-pressed="true"`. Use one primary button per view, because `accent` is the single dominant colour. Labels are short verbs in regular weight. Focus shows a 2px `ring` outline. The consumer provides the label and click handler.'''),
'Card':('Layout','Hairline card with display heading',200,'''<div class="ui-card"><h2 class="ui-display ui-display--3">Auditory brainstem response</h2><p>Wave V latency at 80 dB nHL.</p><div class="ui-row"><span class="ui-tier" data-family="measured"><span class="ui-tier__glyph">◆</span>MEASURED</span><span class="ui-pill">n = 24</span></div></div>''',
'''`.ui-card` is a surface with a hairline border and `radius-base`. A plain `h2` becomes a mono uppercase kicker; give a `.ui-display` heading to get the serif instead. Never add a shadow or a coloured side border to a card; use `.ui-rule--<family>` only to mark a claim's tier in running text.'''),
'Tag':('Evidence','Neutral pill and audio-ink tags',110,'''<div class="ui-row"><span class="ui-pill">neutral</span><span class="ui-tag ui-tag--clay">signal</span><span class="ui-tag ui-tag--ochre">annotation</span><span class="ui-tag ui-tag--lichen">verified</span></div>''',
'''`.ui-pill` is a neutral chip. `.ui-tag--clay` marks signal or action, `--ochre` marks a human annotation, `--lichen` marks machine state; each ink has exactly one job. Tags are for metadata, not evidence quality; use Tier for that.'''),
'Table':('Data','Data table with units and tiers',210,'''<table class="ui-table"><thead><tr><th>Wave</th><th>Latency (ms)</th><th>Basis</th></tr></thead><tbody><tr><td>I</td><td class="ui-measured">1.6</td><td>'''+tier('measured','◆','MEASURED')+'''</td></tr><tr><td>III</td><td class="ui-predicted">3.7</td><td>'''+tier('predicted','▲','MODELLED')+'''</td></tr><tr><td>V</td><td class="ui-predicted">5.6</td><td>'''+tier('spec','◇','TASTE')+'''</td></tr></tbody></table>''',
'''`.ui-table` has mono uppercase headers and hairline rows. Put units in the header and the tier in its own column. Wrap a wide table in `.ui-scroll-x`. Numeric cells use tabular figures via `.ui-measured` / `.ui-predicted`.'''),
'Tabs':('Navigation','Underline tabs',90,'''<div class="ui-tabs" role="tablist"><button role="tab" aria-selected="true">Waveform</button><button role="tab" aria-selected="false">Spectrum</button><button role="tab" aria-selected="false">Notes</button></div>''',
'''`.ui-tabs` holds buttons with `role="tab"` and `aria-selected`. The active tab gets an `accent` underline. Provide the panels and keyboard handling yourself; the CSS carries only the look.'''),
'Readout':('Data','Labelled numeric readout grid',140,'''<dl class="ui-readout"><div><dt>Peak latency</dt><dd class="ui-measured">5.6 <small>ms</small></dd></div><div><dt>Amplitude</dt><dd class="ui-measured">0.42 <small>µV</small></dd></div><div><dt>Model fit</dt><dd class="ui-predicted">r = 0.91</dd></div></dl>''',
'''`.ui-readout` is a definition list of value cells separated by hairlines. Always give a unit in `<small>` and style the value as measured or predicted. Provide `dt` / `dd` pairs wrapped in a `div`.'''),
'Field':('Forms','Labelled select and input',120,'''<div class="ui-row"><label class="ui-field"><span class="ui-label">Stimulus</span><select><option>Click</option><option>Tone burst</option></select></label><label class="ui-field"><span class="ui-label">Level (dB)</span><input value="80"></label></div>''',
'''`.ui-field` stacks a `.ui-label` over a native `select` or `input`. Keep the native control so keyboard and screen-reader support stay intact. The consumer provides the options and value handling.'''),
}
for n,(g,sub,h,body,readme) in comps.items():
    w(f'components/{n}/preview.html',card(g,h,sub,body)); w(f'components/{n}/README.md',readme)
# cover
w('components/Cover/preview.html','''<!-- @dsCard height=300 -->
<!-- blocks: accent(instrument teal) 192x240 radius-lg, foreground slab 96x144 radius-base, measured 96x96, predicted 96x96, spec 96x48; arrangement: staggered stack right of x=480
 pattern: hairline baseline rules (editorial, "hairlines not boxes") 4 rules at border-strong; steps space-6, radii radius-base/lg -->
<style>html,body{margin:0}body{background:var(--background);font-family:var(--font-display,"Instrument Serif",Georgia,serif)}svg{display:block}
.a{fill:var(--accent)}.f{fill:var(--foreground)}.m{fill:var(--measured)}.p{fill:var(--predicted)}.s{fill:var(--spec)}.h{stroke:var(--border-strong);stroke-width:1}
.n{font:400 96px/0.95 "Instrument Serif",Georgia,serif;fill:var(--foreground)}.t{font:400 13px Inter,system-ui,sans-serif;fill:var(--muted-foreground)}</style>
<svg width="960" height="300" viewBox="0 0 960 300">
<line class="h" x1="480" x2="960" y1="60" y2="60"/><line class="h" x1="480" x2="960" y1="120" y2="120"/><line class="h" x1="480" x2="960" y1="180" y2="180"/><line class="h" x1="480" x2="960" y1="240" y2="240"/>
<rect class="a" x="528" y="36" width="192" height="228" rx="14"/>
<rect class="f" x="720" y="108" width="96" height="144" rx="10"/>
<rect class="m" x="816" y="36" width="96" height="96" rx="10"/>
<rect class="p" x="816" y="132" width="96" height="96" rx="10"/>
<rect class="s" x="432" y="204" width="0" height="0"/>
<text class="n" x="32" y="214">Polarize</text><text class="n" x="32" y="272">UI</text>
<text class="t" x="32" y="292" style="display:none">x</text>
</svg>''')
now=datetime.datetime.utcnow().strftime('%Y-%m-%dT%H:%M:%SZ')
w('design-system.json',json.dumps({"v":3,"layout":"files","createdOnFiles":{"v":1,"at":now},"title":"Polarize UI","namespace":"PolarizeUI","libraries":[],"sections":{},"groups":[],"assetGroups":{},"blobs":{},"docs":{"readme":"project/README.md","sections":[]},"lastChange":{"by":"Joshua Anderton","at":now,"via":"Claude Code","note":"Imported from polarizetech/polarize-ui v0.6.2"}},indent=1))
