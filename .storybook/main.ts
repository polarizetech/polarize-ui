import type { StorybookConfig } from "@storybook/react-vite";
import tailwindcss from "@tailwindcss/vite";
import { fileURLToPath } from "node:url";

const config: StorybookConfig = {
  stories: ["../stories/**/*.mdx", "../stories/**/*.stories.@(ts|tsx)"],
  addons: ["@storybook/addon-docs", "@storybook/addon-a11y", "@storybook/addon-mcp"],
  framework: { name: "@storybook/react-vite", options: {} },
  // The fonts, served to the manager UI (manager-head.html) as well as the preview.
  staticDirs: [{ from: "../fonts", to: "/fonts" }, { from: "./public", to: "/" }],
  core: { disableTelemetry: true, disableWhatsNewNotifications: true },
  features: { sidebarOnboardingChecklist: false, menuOnboardingChecklist: false },
  async viteFinal(cfg) {
    cfg.plugins = [...(cfg.plugins ?? []), tailwindcss()];
    cfg.resolve = {
      ...cfg.resolve,
      alias: { ...(cfg.resolve?.alias ?? {}), "@": fileURLToPath(new URL("../src", import.meta.url)) },
    };
    return cfg;
  },
};
export default config;
