import type { Preview } from "@storybook/react-vite";
import "../src/index.css";
import "../src/fonts.css";
import { TooltipProvider } from "../src/components/ui/tooltip";
import { DocsProvider } from "../src/science/evidence/docs";

const preview: Preview = {
  // One theme: Polarize warm dark (2026-11-24). No toolbar switch, nothing follows the OS.
  decorators: [
    (Story) => {
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
