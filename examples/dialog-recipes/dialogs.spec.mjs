import { test, expect } from '@playwright/test';
import { assertDialogJourney, JourneyAssertionError } from 'keytrail';
const libraries = ['bootstrap', 'coreui', 'uikit', 'react-modal', 'vuetify', 'quasar', 'antvue', 'melt', 'ng-zorro'];
const limitations = {
  bootstrap: ['D04.forward.003', 'FOCUS_MISMATCH', 'body'],
  coreui: ['D04.forward.003', 'FOCUS_MISMATCH', 'body'],
  uikit: ['D04.forward.002', 'FOCUS_MISMATCH', 'body'],
  quasar: ['D04.forward.002', 'FOCUS_MISMATCH', 'body'],
  antvue: ['D02.modal', 'MODAL_MISMATCH'],
  'ng-zorro': ['D02.name', 'NAME_MISSING'],
};
function contract(page, library, wrong = false) {
  const trigger = { id: 'open', locator: page.getByRole('button', { name: 'Edit profile', exact: true }) };
  const dialog = { id: 'dialog', locator: page.getByRole('dialog') };
  const input = { id: 'name', locator: page.getByRole('textbox', { name: 'Display name' }) };
  const close = { id: 'close', locator: page.getByRole('button', { name: 'Close', exact: true }) };
  const initialFocus = ['bootstrap', 'coreui', 'react-modal', 'ng-zorro'].includes(library) ? dialog :
    library === 'vuetify' ? { id: 'content', locator: page.locator('.v-overlay__content') } :
    library === 'antvue' ? { id: 'sentinel', locator: page.locator('.ant-modal-content').locator('..') } : input;
  return { id: library.replace('-', '_'), trigger, dialog, initialFocus, tabOrder: [input, close], openKey: 'Enter', closeKey: 'Escape', returnFocus: wrong ? input : trigger };
}
async function reach(page, target) {
  for (let n = 0; n < 12; n++) { if (await target.evaluate(el => el === document.activeElement)) return; await page.keyboard.press('Tab'); }
  throw new Error('Cannot reach opening button by keyboard');
}
for (const library of libraries) {
  test(`${library}: native opening and Escape return`, async ({ page }) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/?library=${library}`); const c = contract(page, library);
    await expect(c.trigger.locator).toBeVisible(); await reach(page, c.trigger.locator); await page.keyboard.press('Enter');
    await expect(c.dialog.locator).toBeVisible();
    await expect.poll(() => c.dialog.locator.evaluate(el => el.contains(document.activeElement))).toBe(true);
    await page.keyboard.press('Escape'); await expect(c.dialog.locator).toBeHidden(); await expect(c.trigger.locator).toBeFocused();
    expect(errors).toEqual([]);
  });
  test(`${library}: declared contract or explicit compatibility result`, async ({ page }, info) => {
    const errors = []; page.on('pageerror', error => errors.push(error.message));
    await page.goto(`/?library=${library}`); await expect(contract(page, library).trigger.locator).toBeVisible();
    if (!limitations[library]) expect((await assertDialogJourney(page, info, contract(page, library))).outcome).toBe('passed');
    else {
      const [checkId, code, focus] = limitations[library];
      try { await assertDialogJourney(page, info, contract(page, library)); throw new Error('Unexpected SDK pass; inspect changed behavior'); }
      catch (error) {
        expect(error).toBeInstanceOf(JourneyAssertionError); expect(error.result.outcome).toBe('failed');
        const first = error.result.checks.find(c => c.status === 'fail' || c.status === 'blocked');
        expect(first.checkId).toBe(checkId); expect(first.messageCode).toBe(code);
        if (focus) expect(first.observed.focus).toBe(focus);
      }
    }
    expect(errors).toEqual([]);
  });
  if (!limitations[library]) test(`${library}: wrong return target is rejected`, async ({ page }, info) => {
    await page.goto(`/?library=${library}`); await expect(contract(page, library).trigger.locator).toBeVisible();
    try { await assertDialogJourney(page, info, contract(page, library, true)); throw new Error('Unexpected pass'); }
    catch (error) { expect(error).toBeInstanceOf(JourneyAssertionError); expect(error.result.outcome).toBe('failed'); expect(['FOCUS_MISMATCH', 'TARGET_NOT_FOUND']).toContain(error.code); }
  });
}
