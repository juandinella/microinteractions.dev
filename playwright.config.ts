import { createHash } from 'node:crypto';
import { defineConfig, devices } from '@playwright/test';

// One port per checkout, so worktrees can run the suite at the same time. Two runs in the same checkout still stop
// with a port error: they would overwrite each other's dist/.
const port = 20_000 + (createHash('sha1').update(import.meta.dirname).digest().readUInt16BE() % 10_000);
const baseURL = `http://127.0.0.1:${port}`;

export default defineConfig({
  testDir: './tests',
  fullyParallel: true,
  // One retry in CI: a test that passes on retry is reported as flaky instead of failing the run.
  retries: process.env.CI ? 1 : 0,
  workers: 2,
  timeout: 20_000,
  expect: { timeout: 5_000 },
  use: {
    baseURL,
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: `pnpm run build && pnpm exec wrangler dev --local --ip 127.0.0.1 --port ${port} --inspector-port ${port + 10_000}`,
    url: baseURL,
    reuseExistingServer: false,
    timeout: 60_000,
  },
});
