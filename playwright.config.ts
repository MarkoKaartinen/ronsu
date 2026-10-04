import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  use: { baseURL: 'http://localhost:4173', channel: 'chrome', locale: 'en-US', viewport: { width: 420, height: 800 } },
  webServer: {
    command: 'python3 -m http.server 4173 -d public',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
  },
});
