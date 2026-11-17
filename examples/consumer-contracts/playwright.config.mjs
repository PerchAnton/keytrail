import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: '.', testMatch: '*.spec.mjs', workers: 1,
  fullyParallel: true, retries: 0, forbidOnly: !!process.env.CI, timeout: 45000,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'artifacts/html' }],
    ['json', { outputFile: 'artifacts/results.json' }]],
  use: { browserName: 'chromium', launchOptions: { executablePath: process.env.KEYTRAIL_TEST_CHROME }, trace: 'off', screenshot: 'off', video: 'off' } });
