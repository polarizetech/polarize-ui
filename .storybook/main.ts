import type { StorybookConfig } from "@storybook/react-vite";

const config: StorybookConfig = {
  stories: ["../stories/**/*.mdx", "../stories/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y", "@storybook/addon-mcp"],
  framework: { name: "@storybook/react-vite", options: {} },
  // design.js fetches tokens.json and icons/ relative to its own URL, so the
  // raw files are served beside it rather than bundled.
  staticDirs: [{ from: "../.storybook/public", to: "/" }],
};
export default config;
