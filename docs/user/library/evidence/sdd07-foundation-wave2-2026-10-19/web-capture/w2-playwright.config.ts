import { defineConfig } from '@playwright/test';
import path from 'path';

// QA capture config for the library screen audit. No webServer block: the dev
// server is started separately (Browser pane preview "library-web" on 8083).
export default defineConfig({
  testDir: '.',
  testMatch: 'w2-capture.pw.ts',
  workers: 1,
  timeout: 60000,
  outputDir: path.join(__dirname, 'test-output'),
  reporter: [
    ['list'],
    ['json', { outputFile: path.join(__dirname, 'results.json') }],
  ],
  use: {
    baseURL: 'http://localhost:8084',
    viewport: { width: 390, height: 844 },
    browserName: 'chromium',
    launchOptions: {
      executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    },
  },
});
