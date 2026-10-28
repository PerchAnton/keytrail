import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: '.', testMatch: '*.journey.spec.ts', timeout: 45000, retries: 0,
  forbidOnly: !!process.env.CI,
  // Teaching files also contain intentionally broken fixtures. Only corrected examples belong here.
  projects: [{ name: 'journey', grep: /passes / }],
  reporter: [['list'], ['keytrail/ci-guard', { projectName: 'journey' }]],
  use: { browserName: 'chromium', trace: 'off', screenshot: 'off', video: 'off' },
});
