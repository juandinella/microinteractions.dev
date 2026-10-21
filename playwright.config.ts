import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  workers: 2,
  timeout: 20_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL: 'http://127.0.0.1:8791',
    trace: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'pnpm run build && pnpm exec wrangler dev --local --ip 127.0.0.1 --port 8791 --inspector-port 9259',
    url: 'http://127.0.0.1:8791',
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
