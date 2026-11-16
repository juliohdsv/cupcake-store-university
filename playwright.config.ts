import { defineConfig, devices } from "@playwright/test";
import { resolve } from "node:path";

const databasePath = resolve("Model/data/e2e.sqlite");

export default defineConfig({
  testDir: "./tests/e2e",
  workers: 1,
  retries: 0,
  timeout: 45_000,
  globalTeardown: "./tests/e2e/teardown.ts",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: "http://127.0.0.1:3100",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: {
    command: "node tests/e2e/prepare-db.mjs && npm run start:combined",
    url: "http://127.0.0.1:3100/api/v1/health",
    env: {
      DATABASE_PATH: databasePath,
      ADMIN_PASSWORD: "12345678",
      OFFICIAL_ADMIN_USERNAME: "engenheiro",
      OFFICIAL_ADMIN_PASSWORD: "senha-oficial-e2e",
      NEXT_PUBLIC_DEMO_ADMIN_PASSWORD: "12345678",
      ADMIN_SESSION_KEY: "chave-exclusiva-dos-testes-e2e-2026",
      PORT: "3100",
      HOST: "127.0.0.1",
      NODE_ENV: "production",
    },
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
