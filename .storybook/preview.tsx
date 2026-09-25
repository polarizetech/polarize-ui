import type { Preview } from "@storybook/react-vite";
import * as React from "react";
import "../src/index.css";
import "../src/fonts.css";
import { TooltipProvider } from "../src/components/ui/tooltip";
import { DocsProvider } from "../src/components/docs";

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
        ],
        dynamicTitle: true,
      },
    },
  },
  initialGlobals: { theme: "auto" },
  decorators: [
    (Story, ctx) => {
      const t = ctx.globals.theme;
      const dark = t === "dark" || (t !== "light" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.classList.toggle("dark", dark);
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
    backgrounds: { disable: true },
    a11y: { test: "todo" },
  },
};
export default preview;
