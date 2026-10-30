A tier badge states how much to trust a claim. It always shows a glyph, a word and a colour, and it cannot be hidden or shortened.

Use `<ui-tier tier="MEASURED">` (from `design.js`) or the markup `<span class="ui-tier" data-family="measured"><span class="ui-tier__glyph">◆</span>MEASURED</span>`. Tier ids: A, B, C, SPEC, MEASURED, PHYSICS, PREDICTED, MODELLED, EXPLORATORY, ADDED, TASTE, REFUTED.

The consumer provides the tier id and puts the explanation in a `ui-note`.

- Do render values with `.ui-measured` (upright) or `.ui-predicted` (italic).
- Do not add a compact, icon-only or hide-label variant.
- Do not reuse a tier colour for a chart series or a status.