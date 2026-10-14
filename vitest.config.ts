import path from "node:path"
import { defineConfig } from "vitest/config"

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname),
      // Next's "server-only" guard throws outside the react-server condition.
      "server-only": path.resolve(
        import.meta.dirname,
        "tests/support/empty.ts"
      ),
    },
  },
  test: {
    environment: "node",
    include: ["tests/unit/**/*.test.ts", "tests/integration/**/*.test.ts"],
    globalSetup: ["tests/support/global-setup.ts"],
    setupFiles: ["tests/support/setup-env.ts"],
    // Integration tests share one metadata database.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
})
