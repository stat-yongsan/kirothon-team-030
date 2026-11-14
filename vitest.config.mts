import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": path.resolve(import.meta.dirname, "src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    // 테스트가 없으면 실패해야 한다(--passWithNoTests 사용 안 함).
    passWithNoTests: false,
  },
});
