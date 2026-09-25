import type { Preview } from "@storybook/react-vite";
import "../design.css";

// Loaded as a plain module from the static dir so its import.meta.url-relative
// fetches (tokens.json, icons/) resolve in dev and in the static build alike.
const s = document.createElement("script");
s.type = "module";
s.src = new URL("design/design.js", document.baseURI).href;
document.head.appendChild(s);
document.body.classList.add("ui");

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "data-theme on <html>",
      toolbar: {
        title: "Theme",
        icon: "paintbrush",
        items: [
          { value: "auto", title: "instrument (follows OS)" },
          { value: "instrument", title: "instrument light" },
          { value: "instrument-dark", title: "instrument dark" },
          { value: "polarize", title: "polarize" },
          { value: "light", title: "classic light" },
          { value: "dark", title: "classic dark" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "auto" },
  decorators: [
    (Story, ctx) => {
      const t = ctx.globals.theme;
      if (!t || t === "auto") document.documentElement.removeAttribute("data-theme");
      else document.documentElement.setAttribute("data-theme", t);
      return Story();
    },
  ],
  parameters: {
    backgrounds: { disable: true },
    a11y: { test: "todo" },
  },
};
export default preview;
