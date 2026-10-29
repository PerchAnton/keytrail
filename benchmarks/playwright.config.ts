import { defineConfig } from '@playwright/test';
export default defineConfig({
  testDir: '.', testMatch: 'performance.spec.ts', workers: 1, fullyParallel: false,
  timeout: 120000, retries: 0, forbidOnly: true,
  reporter: [['list'], ['./reporter.mjs'], ['json', { outputFile: '../artifacts/benchmark-results.json' }]],
  outputDir: '../artifacts/benchmark-output',
  use: { browserName: 'chromium', trace: 'off', video: 'off', screenshot: 'off' },
});
