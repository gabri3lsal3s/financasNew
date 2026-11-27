import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["scripts/cloudflare/sessions/**/*.test.ts"],
    environment: "node",
  },
});
