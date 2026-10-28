import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.', testMatch: '*.journey.spec.ts', timeout: 45000, retries: 0,
  forbidOnly: !!process.env.CI,
  reporter: [['list'], ['html', { open: 'never' }]],
  use: { browserName: 'chromium', trace: 'off', screenshot: 'off', video: 'off' },
});
