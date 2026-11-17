import { test, expect, reach } from './fixtures.mjs';
import { readLayers, runLayers, layerSteps, validateLayerReport } from './layer-prototype.mjs';

async function begin(page, url) {
  await page.goto(url); const trigger = page.getByRole('button', { name: 'Open settings' });
  await expect(trigger).toBeVisible(); await reach(page, trigger);
}
test('native composed keyboard flow dismisses toast before dialog', async ({ page, appURL }) => {
  await begin(page, `${appURL}/?example=layers`); await page.keyboard.press('Enter');
  await expect(page.locator('#show-notice')).toBeFocused(); await page.keyboard.press('Enter');
  await expect(page.locator('[data-sonner-toast]')).toBeVisible(); await page.keyboard.press('Alt+t');
  expect((await readLayers(page)).focus).toBe('notice'); await page.keyboard.press('Escape');
  await expect(page.locator('#show-notice')).toBeFocused(); await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(page.locator('#layers-open')).toBeFocused();
});
test('experimental layer contract records complete bounded observations', async ({ page, appURL }, info) => {
  await begin(page, `${appURL}/?example=layers`);
  const result = await runLayers({ read: () => readLayers(page), press: key => page.keyboard.press(key) });
  await info.attach('layer-prototype.json', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
  expect(result.outcome).toBe('passed');
});
test('experimental layer contract detects the deliberate Escape ownership defect', async ({ page, appURL }, info) => {
  await begin(page, `${appURL}/?example=layers&defect=escape`);
  const result = await runLayers({ read: () => readLayers(page), press: key => page.keyboard.press(key) });
  await info.attach('layer-prototype.json', { body: JSON.stringify(result, null, 2), contentType: 'application/json' });
  expect(result.outcome).toBe('failed'); expect(result.steps.at(-1).id).toBe('step-4');
});
test('host expiry returns focus to the toast opener while keeping dialog open', async ({ page, appURL }) => {
  await begin(page, `${appURL}/?example=layers&expire=1`); await page.keyboard.press('Enter');
  await expect(page.locator('#show-notice')).toBeFocused(); await page.keyboard.press('Enter');
  await expect(page.locator('[data-sonner-toast]')).toBeVisible(); await page.keyboard.press('Alt+t');
  await expect(page.locator('[data-sonner-toast]:not([data-removed=true])')).toHaveCount(0);
  await expect(page.locator('#show-notice')).toBeFocused(); await expect(page.getByRole('dialog')).toBeVisible();
});
test('a transport delay blocks the prototype at the unchanged 100 ms threshold', async ({ page, appURL }) => {
  await begin(page, `${appURL}/?example=layers`); let reads = 0;
  const result = await runLayers({ read: async () => {
    if (++reads === 3) await new Promise(resolve => setTimeout(resolve, 120));
    return readLayers(page);
  }, press: key => page.keyboard.press(key) });
  expect(result.outcome).toBe('blocked'); expect(result.steps.at(-1).code).toBe('OBSERVATION_GAP');
  expect(result.steps.at(-1).samples.at(-1).gapMs).toBeGreaterThan(100);
});
test('wrong preflight focus sends no activation and unknown report fields reject', async () => {
  let presses = 0;
  const result = await runLayers({ read: async () => ({ focus: 'body', dialogs: 0, notices: 0 }),
    press: async () => { presses++; } }, layerSteps.slice(0, 1));
  expect(result.outcome).toBe('failed'); expect(presses).toBe(0);
  expect(() => validateLayerReport({ ...result, extra: true })).toThrow();
  expect(() => validateLayerReport({ ...result, outcome: 'passed' })).toThrow();
  expect(() => validateLayerReport({ ...result, limitMs: 200 })).toThrow();
});
