import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      jiki: path.resolve(__dirname, "../../packages/jiki/src/index.ts"),
      "@run0/jiki-ui": path.resolve(__dirname, "../../packages/jiki-ui/src/index.ts"),
    },
  },
  server: {
    port: 5180,
  },
});
