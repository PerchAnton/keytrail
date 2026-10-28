import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './tests/integration', timeout: 20000, expect: { timeout: 1000 },
  retries: 0, forbidOnly: !!process.env.CI, fullyParallel: true, workers: 4,
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'artifacts/browser-results.json' }]],
  use: { browserName: 'chromium', trace: 'off', screenshot: 'off', video: 'off' },
});
