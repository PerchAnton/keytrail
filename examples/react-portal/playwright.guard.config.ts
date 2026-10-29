import { defineConfig } from '@playwright/test';
const negative = process.env.KEYTRAIL_NEGATIVE_CONTROL === '1';
const output = negative ? 'reports/negative' : 'reports/guarded';
export default defineConfig({
  testDir: '.', testMatch: negative ? 'negative.spec.ts' : '*.journey.spec.ts',
  timeout: 45000, retries: 0, workers: 1, forbidOnly: !!process.env.CI,
  projects: [{ name: 'journey', ...(negative ? {} : { grep: /passes / }) }],
  reporter: [['list'], ['html', { open: 'never', outputFolder: `${output}/html` }],
    ['junit', { outputFile: `${output}/junit.xml` }], ['json', { outputFile: `${output}/results.json` }],
    ['keytrail/ci-guard', { projectName: 'journey' }]],
  use: { browserName: 'chromium', trace: 'off', screenshot: 'off', video: 'off' },
});
