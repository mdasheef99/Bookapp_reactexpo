import { defineConfig } from '@playwright/test';
import path from 'path';

// Overflow diagnosis config. Dev server must already be running on port 8084 from the fu1a worktree.
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.pw.ts',
  workers: 1,
  timeout: 90000,
  outputDir: path.join(__dirname, 'test-output'),
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8084',
    viewport: { width: 390, height: 844 },
    browserName: 'chromium',
    launchOptions: {
      executablePath: 'C:\\Program Files (x86)\\Microsoft\\Edge\\Application\\msedge.exe',
    },
  },
});
