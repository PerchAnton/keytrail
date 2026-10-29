import { test, expect } from './fixtures.js';
import { assertDialogJourney, JourneyAssertionError } from 'keytrail';
import { profileContract } from './contract.js';

test('passes the corrected React portal dialog', async ({ page, appURL }, testInfo) => {
  await page.goto(appURL);
  // Prove that this fixture really mounts into a sibling DOM root.
  await page.keyboard.press('Tab'); await page.keyboard.press('Enter');
  await expect(page.locator('#portal-root > .backdrop > [role=dialog]')).toBeVisible();
  await expect(page.locator('#app [role=dialog]')).toHaveCount(0);
  await page.keyboard.press('Escape');
  await expect(page.getByRole('button', { name: 'Edit profile', exact: true })).toBeFocused();
  // Remount the portal using the same declared journey, under React StrictMode.
  const result = await assertDialogJourney(page, testInfo, profileContract(page));
  expect(result.outcome).toBe('passed');
  expect(result.coverage.complete).toBe(true);
  await expect(page.locator('#portal-root')).toBeEmpty();
  await expect(page.locator('#app')).not.toHaveAttribute('inert');
});

for (const defect of ['initial-focus', 'return-focus']) {
  test(`detects React ${defect}`, async ({ page, appURL }, testInfo) => {
    await page.goto(`${appURL}/?defect=${defect}`);
    try {
      await assertDialogJourney(page, testInfo, profileContract(page));
      throw new Error('Broken fixture unexpectedly passed');
    } catch (error) {
      // Catch only in detector demonstrations. Application tests must let it throw.
      expect(error).toBeInstanceOf(JourneyAssertionError);
      const failure = error as JourneyAssertionError;
      const checkId = defect === 'initial-focus' ? 'D03.initial' : 'D07.returned';
      expect(failure.code).toBe('FOCUS_MISMATCH');
      expect(failure.result.checks.find(c => c.status === 'fail')?.checkId).toBe(checkId);
      expect(failure.result.checks.find(c => c.checkId === checkId)?.observed.focus)
        .toBe(defect === 'initial-focus' ? 'close-profile' : 'body');
      if (defect === 'initial-focus') {
        expect(failure.result.coverage.complete).toBe(false);
        const unreached = failure.result.checks.filter(c => c.status === 'not_run');
        expect(unreached.length).toBeGreaterThan(0);
        expect(unreached.every(c => c.blockedBy === 'D03.initial')).toBe(true);
      }
    }
  });
}
