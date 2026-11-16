import { test, expect, reach } from './fixtures.mjs';
import { assertDialogJourney, JourneyAssertionError } from './artifacts/keytrail/index.js';

function contract(page, returnElsewhere = false) {
  const trigger = { id: 'reka-open', locator: page.getByRole('button', { name: 'Edit profile', exact: true }) };
  const name = { id: 'profile-name', locator: page.getByLabel('Display name') };
  const close = { id: 'reka-close', locator: page.getByRole('button', { name: 'Close', exact: true }) };
  return { id: 'reka-profile', trigger, dialog: { id: 'profile', locator: page.getByRole('dialog', { name: 'Edit profile' }) },
    openKey: 'Enter', initialFocus: name, tabOrder: [name, close], closeKey: 'Escape',
    returnFocus: returnElsewhere ? { id: 'other-field', locator: page.getByLabel('Other field') } : trigger };
}
test('application Ctrl/Meta+K opening returns to its declared trigger', async ({ page, appURL }) => {
  await page.goto(`${appURL}/?example=reka`);
  const other = page.getByLabel('Other field'); await expect(other).toBeVisible(); await reach(page, other);
  await page.keyboard.press('ControlOrMeta+k'); await expect(page.getByLabel('Display name')).toBeFocused();
  await page.keyboard.press('Escape'); await expect(contract(page).trigger.locator).toBeFocused();
});
test('the pinned Reka default restores the prior field for shortcut opening', async ({ page, appURL }) => {
  await page.goto(`${appURL}/?example=reka&return=native`);
  const other = page.getByLabel('Other field'); await expect(other).toBeVisible(); await reach(page, other);
  await page.keyboard.press('ControlOrMeta+k'); await expect(page.getByLabel('Display name')).toBeFocused();
  await page.keyboard.press('Escape'); await expect(other).toBeFocused();
});
test('Reka Enter journey passes the existing KeyTrail API', async ({ page, appURL }, info) => {
  await page.goto(`${appURL}/?example=reka`); await expect(contract(page).trigger.locator).toBeVisible();
  expect((await assertDialogJourney(page, info, contract(page))).outcome).toBe('passed');
});
test('KeyTrail detects a return target that contradicts the contract', async ({ page, appURL }, info) => {
  await page.goto(`${appURL}/?example=reka&return=other`); await expect(contract(page).trigger.locator).toBeVisible();
  try { await assertDialogJourney(page, info, contract(page)); throw new Error('unexpected pass'); }
  catch (error) {
    expect(error).toBeInstanceOf(JourneyAssertionError); expect(error.code).toBe('FOCUS_MISMATCH');
    expect(error.result.checks.find(check => check.status === 'fail')?.checkId).toBe('D07.returned');
  }
});
test('an explicitly declared application return override can pass', async ({ page, appURL }, info) => {
  await page.goto(`${appURL}/?example=reka&return=other`); await expect(contract(page).trigger.locator).toBeVisible();
  expect((await assertDialogJourney(page, info, contract(page, true))).outcome).toBe('passed');
});
