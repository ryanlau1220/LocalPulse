import { defineConfig, devices } from '@playwright/test';
import { existsSync } from 'node:fs';

// Use a dedicated port and fresh browser contexts so the tests never touch the
// user's running workspace or its localStorage.
const executablePath = process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE ||
  (existsSync('/usr/bin/google-chrome') ? '/usr/bin/google-chrome' : undefined);

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  workers: 2,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3100',
    launchOptions: executablePath ? { executablePath } : {},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'desktop', use: { ...devices['Desktop Chrome'] } },
    { name: 'mobile', use: { ...devices['Pixel 7'] } },
  ],

});
