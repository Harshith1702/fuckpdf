import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@pdf-editor/core": path.resolve(__dirname, "../../packages/core/src"),
      "@pdf-editor/engine": path.resolve(__dirname, "../../packages/engine/src"),
    },
  },
  server: {
    port: 3000,
    open: false,
  },
  build: {
    target: "esnext",
  },
  assetsInclude: ["**/*.wasm"],
  optimizeDeps: {
    exclude: ["mupdf"],
  },
});
