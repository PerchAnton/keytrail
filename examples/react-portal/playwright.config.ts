import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: '*.journey.spec.ts', timeout: 45000, retries: 0,
  forbidOnly: !!process.env.CI, workers: 1,
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'reports/teaching/html' }],
    ['junit', { outputFile: 'reports/teaching/junit.xml' }], ['json', { outputFile: 'reports/teaching/results.json' }]],
  use: { browserName: 'chromium', trace: 'off', screenshot: 'off', video: 'off' },
});
