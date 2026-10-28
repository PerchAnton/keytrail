import { test, expect } from '@playwright/test';
import { assertTabsJourney, JourneyAssertionError } from 'keytrail';
import { readFileSync } from 'node:fs';

for (const broken of [false, true]) test(broken ? 'detects premature manual activation' : 'passes manual tabs with Home and End', async ({ page }, info) => {
  const html = readFileSync(new URL('./tabs.html', import.meta.url), 'utf8');
  await page.setContent(broken ? html.replace('// Manual activation leaves the selected panel unchanged here.', 'select(focused);') : html);
  const items = ['general', 'privacy'].map(id => ({
    tab: { id: `${id}-tab`, locator: page.locator(`#${id}-tab`) },
    panel: { id: `${id}-panel`, locator: page.locator(`#${id}-panel`) },
  }));
  const run = () => assertTabsJourney(page, info, {
    id: 'preferences-tabs', tablist: { id: 'preferences', locator: page.getByRole('tablist') }, items,
    initialTabId: 'general-tab', orientation: 'horizontal', activation: 'manual', activationKey: 'Enter',
    homeEnd: true, nextTabStop: items[0]!.panel,
  });
  if (!broken) { expect((await run()).outcome).toBe('passed'); return; }
  // This teaching test catches the expected defect. Application tests should let it throw.
  try { await run(); throw new Error('Broken fixture unexpectedly passed'); }
  catch (error) {
    expect(error).toBeInstanceOf(JourneyAssertionError);
    expect((error as JourneyAssertionError).code).toBe('PREMATURE_ACTIVATION');
    expect((error as JourneyAssertionError).result.steps.some(step => step.key === 'Enter')).toBe(false);
  }
});
