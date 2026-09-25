# Specimen icons — prompt and style guide

The specimen icons live in `src/specimens.ts` (the markup and labels), `specimens.css` (the drawing classes) and `src/components/specimen.tsx` (the `<Specimen>` React component). Browse them in Storybook under **Specimens**.

To draw more, paste everything below the line into a new session, then ask for the icons you want, for example: *"Draw specimens for: tuning fork, jellyfish, EMG electrode."* Paste the entries it returns into `SPECIMENS`, the labels into `SPECIMEN_LABELS`, and add the keys to "Existing keys" at the bottom of this file.

---

## Your task

You are drawing **specimen icons** for polarize-ui, a design system for scientific and research interfaces. Each icon is a small scientific-catalogue illustration: a single subject drawn with clean outlines, flat grey fills and a few faint detail lines, like a plate in a field guide or a lab supply catalogue. Every icon must look like it came from the same hand as the existing set.

For each subject I ask for, return one TypeScript object entry that I can paste into the `SPECIMENS` object:

```js
keyname:`<svg inner markup only>`,
```

- The key is lowercase and a single word (`tuningfork`, `jellyfish`), and must not clash with an existing key (list at the bottom).
- Return only the **inner markup**. The wrapper `<svg class="ui-specimen" viewBox="0 0 200 200">` is added by the `<Specimen>` component.
- After the code, give me a one-line label for each icon in Title Case (for example "Tuning Fork"), as a `SPECIMEN_LABELS` entry: `tuningfork: "Tuning Fork",`.

## The canvas

- The canvas is **200 × 200** units.
- Keep all drawing inside **12–188** on both axes. Thin decoration such as field lines or motion marks may run to 4–196.
- The subject should fill about **65–80 %** of the canvas on its longest side, with its visual centre at roughly (100, 100). Long subjects such as tools, fish, cables or eels run diagonally or horizontally and use the full width.
- Pick the view that makes the subject most recognisable: front view, side profile, or top-down plan (crabs and bees are top-down, sharks are side-on, heads are front-on). Don't use perspective or three-quarter views, except for a slight tilt on flat objects such as paper.

## The six drawing classes — use nothing else

Colour is never written into the drawing. Every shape uses one of these classes, which `specimens.css` maps to the theme's surface tokens so light and dark mode both work.

| Class | Looks like | Use for |
|---|---|---|
| `a` | White fill, 2px dark outline | The main body or silhouette, and any "empty" surface |
| `b` | Grey fill, 2px dark outline | Secondary parts, organelles, handles, fins, anything that should read as a different material |
| `l` | Line only, 2px | Structure: limbs, dendrites, stems, cables, contour lines |
| `t` | Faint thin line (1.25px, 55 % opacity) | Texture and minor detail: gyri, barbs, grid lines, ribs, field lines, grain |
| `d` | Grey fill, no outline | Shading patches, stripes, spots, text-block bars, small dots |
| `k` | Solid dark fill | Tiny accents only: eyes, a keyhole, a stinger tip, rivets. Keep them under ~5 % of the icon's area |

`specimens.css` sets `stroke-linecap:round` and `stroke-linejoin:round` on everything, so don't add them yourself.

**Allowed exceptions.** These are the only times you may write an inline style or colour:
- `style="stroke-width:N"` on an `l` path, to thicken a limb or cable, with N between 2.5 and 6.
- The **tube technique** for thick outlined bands such as a headband, padlock shackle or eel body. Draw the same path twice:
  ```html
  <path d="…" fill="none" stroke="var(--specimen-stroke)" stroke-width="16"/>
  <path d="…" fill="none" stroke="var(--specimen-tile)"   stroke-width="12"/>
  ```
  The outer width minus the inner width must equal 4, which gives a 2px outline on each side. You may add a third pass in `var(--specimen-fill)` for a grey core or a dashed pattern.
- `stroke-dasharray` on `t` lines, for fields, auras or motion.
- `<clipPath>` for stripes inside a body, as on the bee. Give it a unique id prefixed with the key (for example `jellyfishBell`).
- Only if a letter is essential (N/S on a magnet): `<text>` with `font-family="Inter,Arial,sans-serif"`, 12–16px, weight 600, `fill="var(--specimen-stroke)"`.

No gradients, shadows, filters, opacity tricks (other than `t`), images, emoji or hard-coded hex colours.

## Style rules

1. **Grey balance.** About 20–40 % of the drawn area is grey (`b` or `d`). An all-white icon looks unfinished, and an all-grey icon looks heavy. The main silhouette is usually `a` with `b` parts inside it; for a smaller subject, flip that around.
2. **One level of detail.** Give the subject a readable silhouette, then 3–8 interior details, then optional `t` texture. Stop there. Every icon has to read at 64px wide.
3. **Draw back to front.** Put background elements first (cables, wings, far limbs, tails), then the body, then details on top. Use overlap to show depth, never shading gradients.
4. **Everything is round.** Use rounded rects (`rx`) for man-made parts, and smooth cubic curves (`C`/`S`) for organic forms. No sharp miter corners, except on genuinely pointed things such as tips, fins and teeth.
5. **Symmetry where nature has it.** Mirror bilateral subjects such as crabs, bees and faces exactly around x = 100.
6. **Slightly friendly, never cartoonish.** Faces, where unavoidable, get two `k` dot eyes and one `l` smile at most. Nothing else is anthropomorphised.
7. **Science first.** Get the anatomy recognisably right: the correct number of legs, the right number of rings on a TRRS plug, a pyramidal soma that is actually triangular with one apical dendrite.
8. **One small flourish is allowed** where it tells the story: a squiggle beside a pencil, electroreceptor dots on a shark's snout, dashed field lines around an eel, a steam wisp on a soldering iron. One per icon at most.
9. **No backgrounds or frames.** The subject floats on the tile.

## Reference examples (real icons from the set)

**Function generator.** A man-made object, all rounded rects, with grey controls, a `t` graticule and a thick `l` signal:
```js
scope:`<rect class="a" x="24" y="46" width="152" height="108" rx="12"/>
  <rect class="a" x="38" y="60" width="94" height="68" rx="6"/>
  <path class="t" d="M38 94h94M85 60v68"/>
  <path class="l" style="stroke-width:3" d="M42 94 C52 64 62 64 72 94 S92 124 102 94 S118 70 128 88"/>
  <circle class="b" cx="154" cy="78" r="10"/><path class="l" d="M154 78 l5-5"/>
  <circle class="a" cx="154" cy="110" r="10"/><path class="l" d="M154 110 l-6 3"/>
  <rect class="d" x="38" y="136" width="18" height="8" rx="2"/><rect class="d" x="62" y="136" width="18" height="8" rx="2"/><rect class="b" x="86" y="136" width="18" height="8" rx="2"/>
  <circle class="k" cx="160" cy="140" r="3"/>`,
```

**Padlock.** Uses the tube technique for the shackle, with a `k` keyhole:
```js
lock:`<path d="M72 96 V70 a28 28 0 0 1 56 0 V96" fill="none" stroke="var(--specimen-stroke)" stroke-width="16"/>
  <path d="M72 96 V70 a28 28 0 0 1 56 0 V96" fill="none" stroke="var(--specimen-tile)" stroke-width="12"/>
  <rect class="b" x="54" y="92" width="92" height="80" rx="10"/>
  <circle class="k" cx="100" cy="124" r="8"/><rect class="k" x="97" y="124" width="6" height="22" rx="2"/>
  <circle class="a" cx="66" cy="104" r="3"/><circle class="a" cx="134" cy="104" r="3"/><circle class="a" cx="66" cy="160" r="3"/><circle class="a" cx="134" cy="160" r="3"/>`,
```

**Bumblebee.** Organic, top-down and symmetrical, with clip-path stripes, back-to-front layering and `k` eyes:
```js
bee:`<ellipse class="a" cx="72" cy="76" rx="30" ry="15" transform="rotate(-28 72 76)"/><ellipse class="a" cx="128" cy="76" rx="30" ry="15" transform="rotate(28 128 76)"/>
  <ellipse class="t" cx="78" cy="96" rx="20" ry="10" transform="rotate(-10 78 96)"/><ellipse class="t" cx="122" cy="96" rx="20" ry="10" transform="rotate(10 122 96)"/>
  <path class="l" d="M84 96 l-20 6 l-8 14 M84 110 l-18 16 l-4 14 M86 124 l-10 22 l2 14 M116 96 l20 6 l8 14 M116 110 l18 16 l4 14 M114 124 l10 22 l-2 14"/>
  <path class="l" d="M94 48 c-6-12 -14-16 -22-16 M106 48 c6-12 14-16 22-16"/>
  <defs><clipPath id="beeAb"><ellipse cx="100" cy="136" rx="24" ry="32"/></clipPath></defs>
  <ellipse class="a" cx="100" cy="136" rx="24" ry="32"/>
  <g clip-path="url(#beeAb)"><rect class="d" x="70" y="116" width="60" height="12"/><rect class="d" x="70" y="140" width="60" height="12"/></g>
  <ellipse class="l" cx="100" cy="136" rx="24" ry="32"/><path class="k" d="M96 166 L100 178 L104 166 Z"/>
  <circle class="b" cx="100" cy="92" r="19"/><circle class="a" cx="100" cy="60" r="13"/>
  <circle class="k" cx="93" cy="58" r="2.5"/><circle class="k" cx="107" cy="58" r="2.5"/>`,
```

Repetitive structures such as honeycombs, spider webs and feather barbs may be generated with a short loop. Deliver the **final expanded markup**, not the generator.

## Checklist before you answer

- [ ] Only classes `a b l t d k`, plus the allowed exceptions. There are no hex colours.
- [ ] Everything is inside 12–188, with the subject centred and filling 65–80 %.
- [ ] Grey is 20–40 % of the drawing, and `k` is used for tiny accents only.
- [ ] It is recognisable as a silhouette at 64px.
- [ ] The key is unique, and any clipPath ids are prefixed with it.
- [ ] Elements are drawn back to front.
- [ ] You've given a one-line Title Case label.

## Test harness (to preview icons)

Save this as `preview.html`, paste the entries into `SPECIMENS`, and open it. Use the Dark button to check both themes.

```html
<!doctype html><meta charset="utf-8"><title>Specimen preview</title>
<style>
:root{--specimen-tile:#fff;--specimen-stroke:#3A3A3A;--specimen-fill:#D8D8D8;--bg:#C4C4C4;--ink:#1B1B1B}
.dark{--specimen-tile:#222;--specimen-stroke:#CFCFCF;--specimen-fill:#474747;--bg:#0E0E0E;--ink:#EDEDED}
body{margin:0;background:var(--bg);font:14px Inter,Arial,sans-serif;color:var(--ink);padding:24px}
.g{display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:1px;background:var(--specimen-fill)}
.c{background:var(--specimen-tile);padding:12px;text-align:center}.c.s svg{width:64px;height:64px}
.ui-specimen{width:100%;aspect-ratio:1;display:block}.ui-specimen *{stroke-linecap:round;stroke-linejoin:round}
.ui-specimen .a{fill:var(--specimen-tile);stroke:var(--specimen-stroke);stroke-width:2}.ui-specimen .b{fill:var(--specimen-fill);stroke:var(--specimen-stroke);stroke-width:2}
.ui-specimen .l{fill:none;stroke:var(--specimen-stroke);stroke-width:2}.ui-specimen .t{fill:none;stroke:var(--specimen-stroke);stroke-width:1.25;opacity:.55}
.ui-specimen .d{fill:var(--specimen-fill);stroke:none}.ui-specimen .k{fill:var(--specimen-stroke);stroke:none}
</style>
<button onclick="document.documentElement.classList.toggle('dark')">Dark</button>
<div class="g" id="g"></div>
<script>
const SPECIMENS = {
  // paste entries here
};
const svg = k => `<svg class="ui-specimen" viewBox="0 0 200 200">${SPECIMENS[k]}</svg>`;
g.innerHTML = Object.keys(SPECIMENS).map(k => `<div class="c">${svg(k)}<div>${k}</div></div><div class="c s">${svg(k)}<div>${k} @64</div></div>`).join("");
</script>
```

## Existing keys (don't reuse)

`prism` `mic` `paper` `iron` `scope` `plug` `guitar` `pencil` `desk` `lock` `bee`

Add each new key to this list once it is in `src/specimens.ts`.

## Ideas queue

Drawn for an earlier site but never kept, so free to draw again: pyramidal neuron, brain, heart, bacterium, EEG trace, bone, crab, feather, shark, eel, swallow, honeycomb, spider web, magnet, wave, catalogue card.

Other subjects that fit the set: tuning fork, jellyfish, electric ray, platypus bill, octopus, axolotl, planarian flatworm, frog embryo, neuromuscular junction, ion channel, synapse, Purkinje cell, cochlea, retina / eye, spinal cord, DNA helix, fluxgate core, Helmholtz coil, op-amp triangle, BNC connector, electrode pad, breadboard, multimeter, compass, magnifying glass, petri dish, test tube rack, microscope, turntable, reel-to-reel, speaker cone, waveform envelope.
