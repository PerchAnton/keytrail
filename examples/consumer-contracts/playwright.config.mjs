import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: '.', testMatch: '*.spec.mjs', workers: 1,
  fullyParallel: true, retries: 0, forbidOnly: !!process.env.CI, timeout: 45000,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'artifacts/html' }],
    ['json', { outputFile: 'artifacts/results.json' }]],
  use: { browserName: 'chromium', trace: 'off', screenshot: 'off', video: 'off' } });
