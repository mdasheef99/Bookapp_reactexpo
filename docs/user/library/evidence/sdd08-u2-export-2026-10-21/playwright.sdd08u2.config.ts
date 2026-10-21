import { defineConfig } from '@playwright/test';

// SDD-08 U2 export web verification. Expo web must already run on port 8086 from the sdd08/export worktree.
export default defineConfig({
  testDir: '.',
  testMatch: '**/*.pw.ts',
  workers: 1,
  timeout: 300000,
  outputDir: 'C:/Users/LEGION/AppData/Local/Temp/claude/sdd08u2-pw-output',
  reporter: [['list']],
  use: {
    baseURL: 'http://localhost:8086',
    viewport: { width: 390, height: 844 },
    browserName: 'chromium',
    launchOptions: {
      executablePath: 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
    },
  },
});
