/**
 * Specimen icons: small scientific-catalogue illustrations on a 200×200 canvas.
 * Each entry is the SVG's inner markup; <Specimen> adds the wrapper.
 *
 * Drawing classes (styled by specimens.css under .ui-specimen):
 *   a = outline on the tile colour, b = outline on grey, l = line only,
 *   t = faint line, d = grey fill, k = dark fill.
 * To draw more, follow SPECIMEN-ICONS.md and add the key to its "Existing keys" list.
 */
export const SPECIMENS = {
  prism: `<path class="l" d="M10 116 L84 104"/>
    <path class="b" d="M122 98 L194 58 L194 74 Z"/><path class="a" d="M123 100 L194 74 L194 92 Z"/>
    <path class="b" d="M124 102 L194 92 L194 110 Z"/><path class="a" d="M124 104 L194 110 L194 128 Z"/>
    <path class="b" d="M124 106 L194 128 L194 146 Z"/>
    <path class="a" d="M100 36 L150 154 L50 154 Z"/><path class="t" d="M100 36 L108 154"/>
    <path class="d" d="M100 58 L106 146 L135 146 Z" opacity=".6"/>`,
  mic: `<path class="l" d="M52 84 v12 a48 48 0 0 0 96 0 v-12" style="stroke-width:3"/>
    <rect class="a" x="70" y="28" width="60" height="96" rx="30"/>
    <path class="t" d="M76 50h48M72 62h56M72 74h56M72 86h56M76 38h48"/>
    <rect class="b" x="70" y="96" width="60" height="12"/>
    <path class="l" d="M100 144 v24"/><rect class="b" x="68" y="166" width="64" height="10" rx="5"/>
    <path class="l" d="M148 36 c8-12 24-4 16 8 s6 20 18 8"/><circle class="d" cx="40" cy="44" r="5"/><circle class="a" cx="30" cy="62" r="3"/>`,
  paper: `<rect class="a" x="40" y="38" width="118" height="140" rx="3" transform="rotate(-6 100 108)"/>
    <rect class="a" x="46" y="30" width="116" height="144" rx="3"/>
    <rect class="d" x="58" y="42" width="92" height="14" rx="2"/>
    <path class="t" d="M58 62h92"/>
    <rect class="b" x="58" y="70" width="42" height="36" rx="2"/>
    <path class="l" d="M108 72h42M108 80h42M108 88h30M108 96h42M108 104h36"/>
    <path class="t" d="M58 118h40M58 126h40M58 134h40M58 142h30M58 150h40M58 158h36M108 118h42M108 126h42M108 134h28M108 142h42M108 150h42M108 158h24"/>
    <path class="t" d="M104 116v48"/>`,
  iron: `<g transform="rotate(-32 100 100)">
    <path class="l" d="M30 101 C12 101 12 140 -10 150"/>
    <rect class="b" x="30" y="89" width="78" height="24" rx="12"/>
    <path class="t" d="M50 90v22M58 90v22M66 90v22M74 90v22"/>
    <rect class="a" x="106" y="95" width="52" height="12" rx="2"/>
    <path class="b" d="M158 95 L186 101 L158 107 Z"/></g>
    <path class="t" d="M150 52 c4-8 -4-12 0-20M162 58 c4-8 -4-12 0-20"/>`,
  scope: `<rect class="a" x="24" y="46" width="152" height="108" rx="12"/>
    <rect class="a" x="38" y="60" width="94" height="68" rx="6"/>
    <path class="t" d="M38 94h94M85 60v68"/>
    <path class="l" style="stroke-width:3" d="M42 94 C52 64 62 64 72 94 S92 124 102 94 S118 70 128 88"/>
    <circle class="b" cx="154" cy="78" r="10"/><path class="l" d="M154 78 l5-5"/>
    <circle class="a" cx="154" cy="110" r="10"/><path class="l" d="M154 110 l-6 3"/>
    <rect class="d" x="38" y="136" width="18" height="8" rx="2"/><rect class="d" x="62" y="136" width="18" height="8" rx="2"/><rect class="b" x="86" y="136" width="18" height="8" rx="2"/>
    <circle class="k" cx="160" cy="140" r="3"/>`,
  plug: `<path class="l" style="stroke-width:3" d="M34 100 C14 100 20 150 4 170"/>
    <rect class="b" x="34" y="84" width="68" height="32" rx="10"/>
    <path class="t" d="M46 85v30M54 85v30M62 85v30"/>
    <rect class="a" x="102" y="91" width="22" height="18" rx="2"/>
    <rect class="a" x="124" y="93" width="16" height="14"/><rect class="d" x="140" y="94" width="3" height="12"/>
    <rect class="a" x="143" y="93" width="14" height="14"/><rect class="d" x="157" y="94" width="3" height="12"/>
    <rect class="a" x="160" y="93" width="12" height="14"/><rect class="d" x="172" y="94" width="3" height="12"/>
    <path class="b" d="M175 93 h6 a7 7 0 0 1 0 14 h-6 z"/>`,
  guitar: `<rect class="b" x="94" y="16" width="12" height="62"/><path class="t" d="M94 30h12M94 42h12M94 54h12M94 66h12"/>
    <rect class="a" x="89" y="4" width="22" height="18" rx="4"/>
    <circle class="k" cx="94" cy="10" r="1.8"/><circle class="k" cx="106" cy="10" r="1.8"/><circle class="k" cx="94" cy="17" r="1.8"/><circle class="k" cx="106" cy="17" r="1.8"/>
    <path class="a" d="M100 70 c22 0 32 14 28 30 c-3 10 8 14 12 28 c8 30 -16 54 -40 54 s-48 -24 -40 -54 c4 -14 15 -18 12 -28 c-4 -16 6 -30 28 -30z"/>
    <circle class="b" cx="100" cy="122" r="14"/>
    <rect class="d" x="86" y="152" width="28" height="7" rx="2"/>
    <path class="t" d="M97 20v134M103 20v134"/>`,
  pencil: `<path class="l" style="stroke-width:2.5" d="M24 164 c14-22 30 8 44-10 s10-26 26-18"/>
    <g transform="rotate(-40 110 100)">
    <rect class="b" x="56" y="88" width="96" height="24"/>
    <path class="t" d="M56 96h96M56 104h96"/>
    <rect class="a" x="36" y="88" width="20" height="24" rx="6"/><rect class="d" x="52" y="88" width="8" height="24"/>
    <path class="a" d="M152 88 L184 100 L152 112 Z"/><path class="k" d="M176 97 L184 100 L176 103 Z"/></g>
    <circle class="d" cx="150" cy="160" r="6"/><circle class="a" cx="168" cy="146" r="3"/>`,
  desk: `<rect class="a" x="42" y="42" width="116" height="78" rx="6"/>
    <rect class="a" x="50" y="50" width="100" height="62" rx="3"/>
    <rect class="d" x="58" y="58" width="26" height="6" rx="3"/><rect class="b" x="90" y="58" width="40" height="6" rx="3"/>
    <rect class="d" x="66" y="70" width="44" height="6" rx="3"/><rect class="d" x="66" y="82" width="30" height="6" rx="3"/>
    <rect class="b" x="58" y="94" width="20" height="6" rx="3"/><rect class="d" x="84" y="94" width="50" height="6" rx="3"/>
    <path class="b" d="M30 124 h140 l-10 18 h-120 z"/><path class="t" d="M86 131h28"/>`,
  lock: `<path d="M72 96 V70 a28 28 0 0 1 56 0 V96" fill="none" stroke="var(--specimen-stroke)" stroke-width="16"/>
    <path d="M72 96 V70 a28 28 0 0 1 56 0 V96" fill="none" stroke="var(--specimen-tile)" stroke-width="12"/>
    <rect class="b" x="54" y="92" width="92" height="80" rx="10"/>
    <circle class="k" cx="100" cy="124" r="8"/><rect class="k" x="97" y="124" width="6" height="22" rx="2"/>
    <circle class="a" cx="66" cy="104" r="3"/><circle class="a" cx="134" cy="104" r="3"/><circle class="a" cx="66" cy="160" r="3"/><circle class="a" cx="134" cy="160" r="3"/>`,
  bee: `<ellipse class="a" cx="72" cy="76" rx="30" ry="15" transform="rotate(-28 72 76)"/><ellipse class="a" cx="128" cy="76" rx="30" ry="15" transform="rotate(28 128 76)"/>
    <ellipse class="t" cx="78" cy="96" rx="20" ry="10" transform="rotate(-10 78 96)"/><ellipse class="t" cx="122" cy="96" rx="20" ry="10" transform="rotate(10 122 96)"/>
    <path class="l" d="M84 96 l-20 6 l-8 14 M84 110 l-18 16 l-4 14 M86 124 l-10 22 l2 14 M116 96 l20 6 l8 14 M116 110 l18 16 l4 14 M114 124 l10 22 l-2 14"/>
    <path class="l" d="M94 48 c-6-12 -14-16 -22-16 M106 48 c6-12 14-16 22-16"/>
    <defs><clipPath id="beeAb"><ellipse cx="100" cy="136" rx="24" ry="32"/></clipPath></defs>
    <ellipse class="a" cx="100" cy="136" rx="24" ry="32"/>
    <g clip-path="url(#beeAb)"><rect class="d" x="70" y="116" width="60" height="12"/><rect class="d" x="70" y="140" width="60" height="12"/></g>
    <ellipse class="l" cx="100" cy="136" rx="24" ry="32"/><path class="k" d="M96 166 L100 178 L104 166 Z"/>
    <circle class="b" cx="100" cy="92" r="19"/><circle class="a" cx="100" cy="60" r="13"/>
    <circle class="k" cx="93" cy="58" r="2.5"/><circle class="k" cx="107" cy="58" r="2.5"/>`,
} as const

export type SpecimenKey = keyof typeof SPECIMENS

/** Title Case label for each specimen, for captions and alt text. */
export const SPECIMEN_LABELS: Record<SpecimenKey, string> = {
  prism: "Prism",
  mic: "Vocal Mic",
  paper: "Paper",
  iron: "Soldering Iron",
  scope: "Function Generator",
  plug: "TRRS Plug",
  guitar: "Acoustic Guitar",
  pencil: "Pencil",
  desk: "Workstation",
  lock: "Padlock",
  bee: "Bumblebee",
}

export function isSpecimenKey(key: unknown): key is SpecimenKey {
  return typeof key === "string" && key in SPECIMENS
}
