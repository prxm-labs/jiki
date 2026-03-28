// @ts-check
import { defineConfig, fontProviders } from "astro/config";
import react from "@astrojs/react";
import mdx from "@astrojs/mdx";
import sitemap from "@astrojs/sitemap";
import remarkDirective from "remark-directive";
import { remarkCallouts } from "./src/plugins/remark-callouts.mjs";
import jikiTheme from "./src/themes/jiki-dark.json";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  site: "https://jiki.sh",
  integrations: [react(), mdx(), sitemap()],
  prefetch: {
    defaultStrategy: "viewport",
    prefetchAll: true,
  },
  fonts: [
    {
      provider: fontProviders.fontsource(),
      name: "JetBrains Mono",
      cssVariable: "--font-jetbrains-mono",
      subsets: ["latin", "latin-ext"],
      fallbacks: ["monospace"],
      display: "swap",
    },
    {
      provider: fontProviders.fontsource(),
      name: "Instrument Serif",
      cssVariable: "--font-instrument-serif",
      weights: [400],
      styles: ["normal", "italic"],
      subsets: ["latin"],
      fallbacks: ["Georgia", "serif"],
      display: "swap",
    },
  ],
  markdown: {
    remarkPlugins: [remarkDirective, remarkCallouts],
    shikiConfig: {
      theme: jikiTheme,
    },
  },
  vite: {
    resolve: {
      alias: {
        "@run0/jiki": path.resolve(__dirname, "../../packages/jiki/src/index.ts"),
        "@run0/jiki-ui": path.resolve(
          __dirname,
          "../../packages/jiki-ui/src/index.ts",
        ),
      },
    },
    server: {
      proxy: {
        "/api/mistral": {
          target: "https://codestral.mistral.ai",
          changeOrigin: true,
          secure: false,
          rewrite: p => p.replace(/^\/api\/mistral/, ""),
        },
      },
    },
  },
});
