import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./apps/web/", import.meta.url)),
      "@anion/application": fileURLToPath(new URL("./packages/application/src/index.ts", import.meta.url)),
      "@anion/config": fileURLToPath(new URL("./packages/config/src/index.ts", import.meta.url)),
      "@anion/contracts": fileURLToPath(new URL("./packages/contracts/src/index.ts", import.meta.url)),
      "@anion/infrastructure": fileURLToPath(new URL("./packages/infrastructure/src/index.ts", import.meta.url)),
      "@anion/shared/command-artifacts": fileURLToPath(new URL("./packages/shared/src/command-artifacts.ts", import.meta.url)),
      "@anion/shared/utils": fileURLToPath(new URL("./packages/shared/src/utils.ts", import.meta.url)),
      "@anion/shared/visuals/renderers": fileURLToPath(new URL("./packages/shared/src/visuals/renderers.ts", import.meta.url)),
      "@anion/shared": fileURLToPath(new URL("./packages/shared/src/index.ts", import.meta.url)),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    server: {
      deps: {
        inline: [/^@anthropic-ai\/sdk(?:\/.*)?$/, /^next(?:\/.*)?$/],
      },
    },
  },
});
