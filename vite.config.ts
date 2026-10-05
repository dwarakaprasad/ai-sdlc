import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  root: "src/client",
  plugins: [react()],
  build: { outDir: "../../dist/client", emptyOutDir: true },
  server: { proxy: { "/api": "http://localhost:3000" } },
  test: { root: ".", include: ["test/**/*.test.ts"] },
});
