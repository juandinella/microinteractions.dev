import { defineConfig, devices } from '@playwright/test';

// The prerendered build checks server rendering and hydration; the dev server runs Strict Mode effects twice.
// Uncommon ports, so a dev server left running elsewhere doesn't block the check.
const built = 'http://localhost:4791';
const dev = 'http://localhost:4792';

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  // One retry in CI: a test that passes on retry is reported as flaky instead of failing the run.
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  timeout: 20_000,
  expect: { timeout: 5_000 },
  use: { trace: 'retain-on-failure' },
  projects: [
    { name: 'chromium', testIgnore: /strict-mode/, use: { ...devices['Desktop Chrome'], baseURL: built } },
    { name: 'webkit', testIgnore: /strict-mode/, use: { ...devices['Desktop Safari'], baseURL: built } },
    { name: 'strict-chromium', testMatch: /strict-mode/, use: { ...devices['Desktop Chrome'], baseURL: dev } },
    { name: 'strict-webkit', testMatch: /strict-mode/, use: { ...devices['Desktop Safari'], baseURL: dev } },
  ],
  webServer: [
    { command: 'npm run preview -- --port 4791 --strictPort', url: built, reuseExistingServer: false },
    { command: 'npm run dev -- --port 4792 --strictPort', url: dev, reuseExistingServer: false },
  ],
});
