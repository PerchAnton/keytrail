import { defineConfig } from '@playwright/test';
const mode = process.env.KEYTRAIL_GUARD_CASE;
const dependency = mode.startsWith('dependency');
export default defineConfig({
  testDir: '.', testMatch: 'fixture.spec.mjs', timeout: 10000, workers: 1,
  retries: mode.startsWith('retry') ? 1 : 0,
  globalTimeout: mode === 'global-timeout' ? 4000 : 20000,
  outputDir: '../../artifacts/guard-output',
  reporter: [
    ['./fault-reporter.mjs'],
    ['../../dist/ci-guard.js', { projectName: mode === 'wrong-project' ? 'absent' : mode === 'invalid-options' ? '' : 'journey' }],
  ],
  projects: [
    ...(dependency ? [{ name: 'setup', testMatch: 'setup.spec.mjs' }] : []),
    { name: 'journey', testMatch: 'fixture.spec.mjs', ...(dependency ? { dependencies: ['setup'] } : {}) },
  ],
});
