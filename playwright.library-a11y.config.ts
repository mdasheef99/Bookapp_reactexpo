import { defineConfig, devices } from '@playwright/test';

const edgePath = 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe';

export default defineConfig({
  testDir: './e2e',
  testMatch: '**/library-a11y.spec.ts',
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: {
    timeout: 10_000,
  },
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8083',
    viewport: { width: 390, height: 844 },
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
  // The dev server needs a .env with EXPO_PUBLIC_SUPABASE_URL=https://ahntbtktjjmvfosgkmgn.supabase.co (the fixture host) and a placeholder anon key; all https requests are intercepted so no real credentials are used.
  webServer: {
    command: 'npx expo start --web --port 8083',
    url: 'http://localhost:8083',
    reuseExistingServer: true,
    timeout: 240_000,
  },
});
