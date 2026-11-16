import { test, expect, reach } from './fixtures.mjs';
import { assertDialogJourney, assertTabsJourney, JourneyAssertionError } from './artifacts/keytrail/index.js';

function dialogContract(page) {
  const trigger = { id: 'authorize', locator: page.locator('button.authorize').first() };
  const modal = page.locator('.modal-ux');
  const top = { id: 'close-top', locator: modal.locator('button.close-modal') };
  return { id: 'swagger-authorization', trigger, dialog: { id: 'authorization', locator: modal },
    openKey: 'Enter', initialFocus: top, tabOrder: [top,
      { id: 'api-key', locator: modal.locator('input') },
      { id: 'confirm', locator: modal.getByRole('button', { name: 'Apply credentials', exact: true }) },
      { id: 'close-bottom', locator: modal.getByRole('button', { name: 'Close', exact: true }) }],
    closeKey: 'Escape', returnFocus: trigger };
}

test('native baseline exposes the missing dialog focus/semantics', async ({ page, appURL }) => {
  await page.goto(appURL); const contract = dialogContract(page);
  await expect(contract.trigger.locator).toBeVisible(); await reach(page, contract.trigger.locator);
  await page.keyboard.press('Enter'); await expect(contract.dialog.locator).toBeVisible();
  await expect(contract.dialog.locator).not.toHaveAttribute('role', 'dialog');
  let escaped = false;
  for (let index = 0; index < 8; index++) {
    await page.keyboard.press('Tab');
    if (!await contract.dialog.locator.evaluate(element => element.contains(document.activeElement))) { escaped = true; break; }
  }
  expect(escaped).toBe(true);
});

test('KeyTrail reports the unmodified Swagger dialog honestly', async ({ page, appURL }, info) => {
  await page.goto(appURL); await expect(page.locator('button.authorize').first()).toBeVisible();
  try { await assertDialogJourney(page, info, dialogContract(page)); throw new Error('unexpected pass'); }
  catch (error) { expect(error).toBeInstanceOf(JourneyAssertionError); expect(error.code).toBe('ROLE_MISMATCH'); }
});

test('corrected Swagger dialog passes native keyboard assertions', async ({ page, appURL }) => {
  await page.goto(`${appURL}/?mode=corrected`); const c = dialogContract(page);
  await expect(c.trigger.locator).toBeVisible(); await reach(page, c.trigger.locator);
  await page.keyboard.press('Enter'); await expect(c.initialFocus.locator).toBeFocused();
  for (const target of [...c.tabOrder.slice(1), c.tabOrder[0]]) {
    await page.keyboard.press('Tab'); await expect(target.locator).toBeFocused();
  }
  await page.keyboard.press('Shift+Tab'); await expect(c.tabOrder.at(-1).locator).toBeFocused();
  await page.keyboard.press('Escape'); await expect(c.dialog.locator).toHaveCount(0);
  await expect(c.trigger.locator).toBeFocused();
});

test('corrected real Swagger dialog passes the KeyTrail contract', async ({ page, appURL }, info) => {
  await page.goto(`${appURL}/?mode=corrected`); await expect(page.locator('button.authorize').first()).toBeVisible();
  const result = await assertDialogJourney(page, info, dialogContract(page));
  expect(result.outcome).toBe('passed'); expect(result.coverage.complete).toBe(true);
});

test('semantics alone do not conceal the untrapped focus regression', async ({ page, appURL }, info) => {
  await page.goto(`${appURL}/?mode=semantics`); await expect(page.locator('button.authorize').first()).toBeVisible();
  try { await assertDialogJourney(page, info, dialogContract(page)); throw new Error('unexpected pass'); }
  catch (error) { expect(error).toBeInstanceOf(JourneyAssertionError); expect(error.code).toBe('FOCUS_MISMATCH'); }
});

function tabsContract(page) {
  const list = page.getByRole('tablist').first();
  const example = list.locator('[role=tab][data-name=example]');
  const model = list.locator('[role=tab][data-name=model]');
  const panel = name => page.locator(`[role=tabpanel][data-name=${name}Panel]`).first();
  const examplePanel = { id: 'example-panel', locator: panel('example') };
  return { id: 'swagger-response-tabs', tablist: { id: 'schema-tabs', locator: list },
    items: [{ tab: { id: 'example', locator: example }, panel: examplePanel },
      { tab: { id: 'model', locator: model }, panel: { id: 'model-panel', locator: panel('model') } }],
    initialTabId: 'example', orientation: 'horizontal', activation: 'automatic', homeEnd: true,
    nextTabStop: examplePanel };
}

test('Swagger tabs native baseline misses arrow navigation', async ({ page, appURL }) => {
  await page.goto(appURL); const c = tabsContract(page);
  await expect(c.tablist.locator).toBeVisible(); await reach(page, c.items[0].tab.locator);
  await page.keyboard.press('ArrowRight'); await expect(c.items[0].tab.locator).toBeFocused();
  await expect(c.items[0].tab.locator).toHaveAttribute('aria-selected', 'true');
});

test('native corrected tabs support arrows and Home/End with lazy panels', async ({ page, appURL }) => {
  await page.goto(`${appURL}/?mode=corrected`); await expect(page.getByRole('tablist').first()).toBeVisible();
  const c = tabsContract(page); await reach(page, c.items[0].tab.locator);
  for (const [key, index] of [['ArrowRight', 1], ['ArrowLeft', 0], ['End', 1], ['Home', 0]]) {
    await page.keyboard.press(key); await expect(c.items[index].tab.locator).toBeFocused();
    await expect(c.items[index].tab.locator).toHaveAttribute('aria-selected', 'true');
    await expect(c.items[index].panel.locator).toBeVisible();
    await expect(c.items[1 - index].tab.locator).toHaveAttribute('tabindex', '-1');
  }
  await page.keyboard.press('Tab'); await expect(c.nextTabStop.locator).toBeFocused();
});

test('KeyTrail does not pass lazy panels outside its mounted-panel contract', async ({ page, appURL }, info) => {
  await page.goto(`${appURL}/?mode=corrected`); await expect(page.getByRole('tablist').first()).toBeVisible();
  try { await assertTabsJourney(page, info, tabsContract(page)); throw new Error('unexpected pass'); }
  catch (error) {
    expect(error).toBeInstanceOf(JourneyAssertionError); expect(error.code).toBe('STRUCTURE_MISMATCH');
    expect(error.result.coverage.complete).toBe(false);
  }
});
