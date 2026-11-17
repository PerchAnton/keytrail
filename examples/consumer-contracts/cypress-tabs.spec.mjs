import { test, expect } from './fixtures.mjs';
import { assertTabsJourney } from './artifacts/keytrail/index.js';
for (const framework of ['react', 'vue']) {
  test(`${framework}: missing activeId skips every tab (native reproduction)`, async ({ page, appURL }) => {
    await page.goto(`${appURL}?example=cypress-${framework}`);
    await expect(page.getByRole('tab')).toHaveCount(3);
    await page.keyboard.press('Tab');
    await expect(page.locator('#before')).toBeFocused();
    await page.keyboard.press('Tab');
    await expect(page.locator('#after')).toBeFocused();
    expect(await page.getByRole('tab').evaluateAll(nodes => nodes.map(n => n.tabIndex))).toEqual([-1, -1, -1]);
  });
  test(`${framework}: explicit activeId enables the native arrow cycle`, async ({ page, appURL }) => {
    await page.goto(`${appURL}?example=cypress-${framework}&mode=corrected`);
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    await expect(page.locator('#one')).toBeFocused();
    await page.keyboard.press('ArrowRight');
    await expect(page.locator('#two')).toBeFocused();
    await expect(page.locator('#two')).toHaveAttribute('aria-selected', 'true');
    await expect(page.locator('#two-panel')).toBeVisible();
  });
  test(`${framework}: the same KeyTrail contract checks the explicit consumer`, async ({ page, appURL }, info) => {
    await page.goto(`${appURL}?example=cypress-${framework}&mode=corrected`);
    const items = ['one', 'two', 'three'].map(id => ({
      tab: { id, locator: page.locator(`#${id}`) },
      panel: { id: `${id}-panel`, locator: page.locator(`#${id}-panel`) },
    }));
    await assertTabsJourney(page, info, { id: `cypress-${framework}`, tablist: { id: 'tabs', locator: page.getByRole('tablist') },
      items, initialTabId: 'one', orientation: 'horizontal', activation: 'automatic', homeEnd: false, nextTabStop: items[0].panel });
  });
}
