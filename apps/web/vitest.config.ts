import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({ esbuild: { jsx: "automatic" }, test: { globals: true, environment: "jsdom", setupFiles: ["./vitest.setup.ts"] }, resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } } });
