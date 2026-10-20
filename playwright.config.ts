import { defineConfig, devices } from '@playwright/test';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

export default defineConfig({
  testDir: './e2e',
  // library-a11y.spec.ts needs its own dev-server config and fixtures, so the default suite never runs it.
  testIgnore: '**/library-a11y.spec.ts',
  timeout: 30_000,
  expect: {
    timeout: 10_000,
  },
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:8084',
    trace: 'on-first-retry',
    viewport: { width: 1440, height: 960 },
  },
  webServer: {
    command: 'node _serve.js',
    url: 'http://127.0.0.1:8084',
    reuseExistingServer: false,
    timeout: 30_000,
  },
  projects: [
    {
      name: 'edge',
      use: {
        ...devices['Desktop Chrome'],
        browserName: 'chromium',
        launchOptions: {
          executablePath: edgePath,
        },
      },
    },
  ],
});
