import { addons } from "storybook/manager-api";
import { create } from "storybook/theming";
import tokens from "../tokens.json";
import pkg from "../package.json";

// The Storybook UI, white-labelled with the same tokens as the components.
// Light or dark follows the viewer's system setting, like the sites built on this.
type Palette = Record<string, string>;
const light = tokens.color["instrument"] as Palette;
const dark = tokens.color["instrument-dark"] as Palette;

const brandTitle = (accent: string, ink: string) => `
  <span style="display:inline-flex;align-items:center;gap:10px">
    <span style="width:10px;height:18px;border-radius:2px;background:${accent}"></span>
    <span style="font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:12px;letter-spacing:.18em;text-transform:uppercase;color:${ink}">Polarize UI</span>
    <span style="font-family:'IBM Plex Mono',ui-monospace,monospace;font-size:10px;letter-spacing:.06em;color:${ink};opacity:.55">v${pkg.version}</span>
  </span>`;

function theme(base: "light" | "dark", c: Palette) {
  return create({
    base,
    brandTitle: brandTitle(c.accent, c.foreground),
    brandUrl: "https://github.com/polarizetech/polarize-ui",
    brandTarget: "_blank",

    colorPrimary: c.accent,
    // Selected sidebar rows put white text on this, so it is the deep teal in both themes.
    colorSecondary: light.accent,

    appBg: c.background,
    appContentBg: c.background,
    appPreviewBg: c.background,
    appBorderColor: c.border,
    appBorderRadius: 6,

    fontBase: tokens.type.sans,
    fontCode: tokens.type.mono,

    textColor: c.foreground,
    textInverseColor: c.background,
    textMutedColor: c["muted-foreground"],

    barTextColor: c["muted-foreground"],
    barHoverColor: c.accent,
    barSelectedColor: c.accent,
    barBg: c.surface,

    buttonBg: c["surface-2"],
    buttonBorder: c.border,
    booleanBg: c["surface-2"],
    booleanSelectedBg: c.surface,

    inputBg: c.surface,
    inputBorder: c.border,
    inputTextColor: c.foreground,
    inputBorderRadius: 6,
  });
}

const prefersDark = window.matchMedia?.("(prefers-color-scheme: dark)").matches;
addons.setConfig({
  theme: prefersDark ? theme("dark", dark) : theme("light", light),
  sidebar: { showRoots: true },
});
