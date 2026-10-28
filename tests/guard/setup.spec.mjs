import { test } from '@playwright/test';
test('dependency without journey attachment', async () => {
  if (process.env.KEYTRAIL_GUARD_CASE === 'dependency-failure') throw new Error('synthetic dependency failure');
});
