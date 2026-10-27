import type { Preview } from "@storybook/react-vite";
import "../src/index.css";
import "../src/fonts.css";
import { TooltipProvider } from "../src/components/ui/tooltip";
import { DocsProvider } from "../src/science/evidence/docs";

const preview: Preview = {
  globalTypes: {
    theme: {
      description: "Light / dark",
      toolbar: {
        title: "Theme",
        icon: "mirror",
        items: [
          { value: "auto", title: "follow OS" },
          { value: "light", title: "light" },
          { value: "dark", title: "dark" },
          { value: "polarize", title: "polarize (warm dark)" },
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "auto" },
  decorators: [
    (Story, ctx) => {
      const t = ctx.globals.theme;
      const dark = t === "dark" || t === "polarize" || (t !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", dark);
      // Polarize is a dark theme with its own block (clay brand, audio inks): stamp both.
      if (t === "polarize") document.documentElement.dataset.theme = "polarize";
      else delete document.documentElement.dataset.theme;
      return (
        <TooltipProvider>
          <DocsProvider>
            <div className="p-2">
              <Story />
            </div>
          </DocsProvider>
        </TooltipProvider>
      );
    },
  ],
  parameters: {
    layout: "padded",
    // Science first: the charts and analysis views are what this library is for.
    options: {
      storySort: {
        order: [
          "Introduction",
          "Science", ["Charts", "Signals", "Statistics", "Evidence"],
          "General UI", ["Foundations", "Components", "Controls", "Layouts", "Landing", "Docs", "Illustrations"],
        ],
      },
    },
    backgrounds: { disable: true },
    a11y: { test: "todo" },
  },
};
export default preview;
