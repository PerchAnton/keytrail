import { defineConfig } from '@playwright/test';

export default defineConfig({
  // Leave setup and attachment time beyond the default 30-second journey budget.
  testDir: './tests/integration', timeout: 45000, expect: { timeout: 1000 },
  retries: 0, forbidOnly: !!process.env.CI, fullyParallel: true, workers: 4,
  reporter: [['list'], ['html', { open: 'never' }], ['json', { outputFile: 'artifacts/browser-results.json' }]],
  use: { browserName: 'chromium', trace: 'off', screenshot: 'off', video: 'off' },
});
