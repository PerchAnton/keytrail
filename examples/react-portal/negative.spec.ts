import { test } from './fixtures.js';
import { assertDialogJourney } from 'keytrail';
import { profileContract } from './contract.js';

// Excluded from the teaching suite; the release check expects this process to fail.
test('rejects wrong initial focus without swallowing the assertion', async ({ page, appURL }, testInfo) => {
  await page.goto(`${appURL}/?defect=initial-focus`);
  await assertDialogJourney(page, testInfo, profileContract(page));
});
