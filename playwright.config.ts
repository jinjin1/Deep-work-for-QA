import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [
    {
      name: 'chromium',
      use: { browserName: 'chromium' },
    },
  ],
  webServer: [
    {
      command: 'pnpm dev:api',
      url: 'http://localhost:3001/v1/bug-reports',
      reuseExistingServer: !process.env.CI,
      timeout: 15000,
    },
    {
      command: 'pnpm dev:web',
      url: 'http://localhost:3000',
      reuseExistingServer: !process.env.CI,
      timeout: 15000,
    },
  ],
});
