import { defineConfig, devices } from "@playwright/test";

const PORT = Number(process.env.PORT ?? 3100);

export default defineConfig({
  testDir: "e2e",
  timeout: 30_000,
  use: { baseURL: `http://localhost:${PORT}`, trace: "off" },
  projects: [
    {
      name: "chromium",
      use: {
        ...devices["Desktop Chrome"],
        // permite usar um Chromium já instalado (ex.: PW_CHROMIUM_PATH=/opt/pw-browsers/chromium)
        launchOptions: process.env.PW_CHROMIUM_PATH ? { executablePath: process.env.PW_CHROMIUM_PATH } : {},
      },
    },
  ],
  webServer: {
    command: `npx next start -p ${PORT}`,
    port: PORT,
    reuseExistingServer: true,
    timeout: 60_000,
  },
});
