import { defineConfig } from '@playwright/test';
export default defineConfig({ testDir: '.', testMatch: 'dialogs.spec.mjs', workers: 1, retries: 0, timeout: 20000,
  reporter: [['list'], ['json', { outputFile: process.env.KEYTRAIL_RECIPE_REPORT || 'artifacts/results.json' }], ['html', { outputFolder: 'artifacts/html', open: 'never' }]],
  use: { baseURL: 'http://127.0.0.1:5198', launchOptions: { executablePath: process.env.KEYTRAIL_TEST_CHROME } },
  webServer: { command: `node node_modules/vite/bin/vite.js ${process.env.KEYTRAIL_RECIPE_PREVIEW ? 'preview' : ''} --host 127.0.0.1 --port 5198`, url: 'http://127.0.0.1:5198', reuseExistingServer: false } });
