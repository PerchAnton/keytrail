import { test, expect } from '@playwright/test';
import { assertDialogJourney, JourneyAssertionError } from 'keytrail';
import { readFileSync } from 'node:fs';

for (const broken of [false, true]) {
  test(broken ? 'detects lost return focus' : 'passes the same corrected dialog', async ({ page }, testInfo) => {
    const html = readFileSync(new URL('./profile.html', import.meta.url), 'utf8');
    await page.setContent(broken ? html.replace('opener.focus();', '/* deliberately lose return focus */') : html);
    const trigger = { id: 'open-profile', locator: page.getByRole('button', { name: 'Edit profile' }) };
    const name = { id: 'display-name', locator: page.getByLabel('Display name') };
    const close = { id: 'close-profile', locator: page.getByRole('button', { name: 'Close' }) };
    const run = () => assertDialogJourney(page, testInfo, {
      id: 'profile-dialog', trigger,
      dialog: { id: 'profile', locator: page.getByRole('dialog') },
      openKey: 'Enter', initialFocus: name, tabOrder: [name, close],
      closeKey: 'Escape', returnFocus: trigger,
    });
    if (!broken) { expect((await run()).outcome).toBe('passed'); return; }
    // Catch only in this demonstration of the detector. In application tests let it throw.
    try { await run(); throw new Error('Broken fixture unexpectedly passed'); }
    catch (error) {
      expect(error).toBeInstanceOf(JourneyAssertionError);
      const failure = error as JourneyAssertionError;
      expect(failure.code).toBe('FOCUS_MISMATCH');
      expect(failure.result.checks.find(c => c.status === 'fail')?.checkId).toBe('D07.returned');
      expect(failure.message).toBe('D07 FOCUS_MISMATCH expected=open-profile observed=body');
    }
  });
}
