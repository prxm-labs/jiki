import { defineConfig } from "vite";
import { resolve } from "path";

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/index.ts"),
      formats: ["es", "cjs"],
      fileName: format => `index.${format === "es" ? "mjs" : "cjs"}`,
    },
    rollupOptions: {
      external: [
        "acorn",
        "acorn-jsx",
        "esbuild-wasm",
        "pako",
        "resolve.exports",
      ],
    },
    target: "es2022",
    sourcemap: true,
    minify: false,
  },
});
