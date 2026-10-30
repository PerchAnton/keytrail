import { test, expect, type Page, type JSHandle } from '@playwright/test';
import { Driver } from '../../src/browser/driver.js';
import { DEFAULTS } from '../../src/contracts/dialog.js';
import { tabsHtml, tabsContract } from '../fixtures/tabs.js';

function trackStores(page: Page) {
  const original = page.evaluateHandle, issued: JSHandle[] = [];
  page.evaluateHandle = (async (...args: Parameters<typeof original>) => {
    const handle: JSHandle = await Reflect.apply(original, page, args); issued.push(handle); return handle;
  }) as typeof original;
  return { issued, restore: () => { page.evaluateHandle = original; } };
}
async function expectCleared(stores: JSHandle[]) {
  expect(stores).toHaveLength(1);
  expect(await stores[0]!.evaluate(store => (store as Map<number, Element[]>).size)).toBe(0);
}
async function expectDisposed(stores: JSHandle[]) {
  for (const store of stores) await expect(store.evaluate(value => !!value)).rejects.toThrow();
}

test('a focus observation cannot combine two different instants', async ({ page }) => {
  await page.setContent('<section id="dialog"><button id="a">A</button><button id="b">B</button></section>');
  const a = { id: 'a', locator: page.locator('#a') }, b = { id: 'b', locator: page.locator('#b') };
  const dialog = { id: 'dialog', locator: page.locator('#dialog') };
  await a.locator.focus();
  const move = () => b.locator.focus();
  // Move focus after one locator has populated its slot, before the atomic read.
  const evaluateAll = a.locator.evaluateAll;
  a.locator.evaluateAll = (async (...args: Parameters<typeof evaluateAll>) => {
    const value = await evaluateAll.apply(a.locator, args); await move(); return value;
  }) as typeof evaluateAll;
  const driver = new Driver(page, [a, b, dialog], dialog, { ...DEFAULTS }, performance.now());
  try {
    const state = await driver.snapshot();
    expect([...state.focused]).toEqual(['b']);
    expect(state.focus).toBe('b');
    expect(state.inside).toBe(true);
    expect(driver.steps).toHaveLength(0);
  } finally { await driver.dispose(); }
});

test('interaction observations re-resolve replaced tabs without inventing metadata', async ({ page }) => {
  await page.setContent(tabsHtml({ activation: 'manual' }));
  const contract = tabsContract(page, { activation: 'manual' });
  const driver = new Driver(page, [contract.tablist, ...contract.items.flatMap(i => [i.tab, i.panel])],
    contract.tablist, { ...DEFAULTS }, performance.now(), contract);
  try {
    const full = await driver.snapshot();
    expect(full.tabs).toMatchObject({ role: true, named: true, orientation: true });
    expect(full.tabs?.items).toHaveLength(3);
    await page.evaluate(() => {
      const old = document.querySelector('#tab-2')!, replacement = old.cloneNode(true) as HTMLElement;
      old.replaceWith(replacement);
      for (const tab of document.querySelectorAll<HTMLElement>('[role=tab]')) {
        tab.setAttribute('aria-selected', String(tab === replacement)); tab.tabIndex = tab === replacement ? 0 : -1;
      }
      for (const panel of document.querySelectorAll<HTMLElement>('[role=tabpanel]')) panel.hidden = panel.id !== 'panel-2';
      replacement.focus();
    });
    const state = await driver.snapshot('interaction');
    expect(state.focus).toBe('tab-2');
    expect(state.tabs).toEqual({ structure: true, selected: ['tab-2'], visiblePanels: ['panel-2'], selectionValid: true, roving: true });
    expect(driver.steps).toHaveLength(0);
  } finally { await driver.dispose(); }
});

test('interaction observations detect an added tab with fallback role tokens', async ({ page }) => {
  await page.setContent(tabsHtml({ activation: 'manual' }));
  const contract = tabsContract(page, { activation: 'manual' });
  const driver = new Driver(page, [contract.tablist, ...contract.items.flatMap(i => [i.tab, i.panel])],
    contract.tablist, { ...DEFAULTS }, performance.now(), contract);
  try {
    expect((await driver.snapshot('interaction')).tabs?.structure).toBe(true);
    await page.locator('#tabs').evaluate(root => root.insertAdjacentHTML('beforeend', '<button role="invalid tab" tabindex="-1">Extra</button>'));
    expect((await driver.snapshot('interaction')).tabs?.structure).toBe(false);
    expect(driver.steps).toHaveLength(0);
  } finally { await driver.dispose(); }
});

test('replacement during observation is re-resolved and stored nodes are cleared', async ({ page }) => {
  await page.setContent('<section id="dialog"><button id="a">A</button></section>');
  const a = { id: 'a', locator: page.locator('#a') }, dialog = { id: 'dialog', locator: page.locator('#dialog') };
  const stores = trackStores(page), evaluateAll = a.locator.evaluateAll;
  let resolutions = 0;
  a.locator.evaluateAll = (async (...args: Parameters<typeof evaluateAll>) => {
    const value = await evaluateAll.apply(a.locator, args);
    if (++resolutions === 1) {
      await a.locator.evaluate(el => el.replaceWith(el.cloneNode(true)));
      await a.locator.focus();
    }
    return value;
  }) as typeof evaluateAll;
  const driver = new Driver(page, [a, dialog], dialog, { ...DEFAULTS }, performance.now());
  try {
    const state = await driver.snapshot();
    expect([...state.focused]).toEqual(['a']); expect(state.inside).toBe(true);
    expect(resolutions).toBeGreaterThan(1);
    await expectCleared(stores.issued); expect(driver.steps).toHaveLength(0);
  } finally { await driver.dispose(); stores.restore(); }
  await expectDisposed(stores.issued);
});

test('an early resolution error awaits slower sibling reads before clearing stored nodes', async ({ page }) => {
  await page.setContent('<section id="dialog"><button>A</button><button>B</button></section>');
  const ambiguous = { id: 'ambiguous', locator: page.locator('button') };
  const slow = { id: 'slow', locator: page.locator('#dialog') };
  const stores = trackStores(page), evaluateAll = slow.locator.evaluateAll;
  let completed = false;
  slow.locator.evaluateAll = (async (...args: Parameters<typeof evaluateAll>) => {
    await new Promise(resolve => setTimeout(resolve, 30));
    const value = await evaluateAll.apply(slow.locator, args); completed = true; return value;
  }) as typeof evaluateAll;
  const driver = new Driver(page, [ambiguous, slow], slow, { ...DEFAULTS }, performance.now());
  try {
    await expect(driver.snapshot()).rejects.toMatchObject({ code: 'TARGET_AMBIGUOUS' });
    expect(completed).toBe(true); await expectCleared(stores.issued);
    await new Promise(resolve => setTimeout(resolve, 50)); await expectCleared(stores.issued);
    expect(driver.steps).toHaveLength(0);
  } finally { await driver.dispose(); stores.restore(); }
  await expectDisposed(stores.issued);
});

for (const context of ['main', 'iframe'] as const) test(`a rejected ${context} observation preserves its context diagnosis and releases handles`, async ({ page }) => {
  await page.setContent('<button id="main">Main</button><iframe srcdoc="<button>Inner</button>"></iframe>');
  await expect(page.frameLocator('iframe').locator('button')).toBeVisible();
  const target = { id: 'target', locator: context === 'main' ? page.locator('#main') : page.frameLocator('iframe').locator('button') };
  const stores = trackStores(page);
  // A failed atomic read stays a browser error. A foreign context is rejected
  // during registration, before this read, without returning element handles.
  const evaluate = page.evaluate;
  page.evaluate = async () => { throw new Error('CANARY_transport'); };
  const driver = new Driver(page, [target], target, { ...DEFAULTS }, performance.now());
  try {
    await expect(driver.snapshot()).rejects.toMatchObject({ code: context === 'iframe' ? 'UNSUPPORTED_CONTEXT' : 'BROWSER_ERROR' });
    await expectCleared(stores.issued); expect(driver.steps).toHaveLength(0);
  } finally { page.evaluate = evaluate; await driver.dispose(); stores.restore(); }
  await expectDisposed(stores.issued);
});

test('live locator bindings change even when the previous element remains connected', async ({ page }) => {
  await page.setContent('<section><button id="a" data-current>A</button><button id="b">B</button></section>');
  const target = { id: 'current', locator: page.locator('[data-current]') }, root = { id: 'root', locator: page.locator('section') };
  const stores = trackStores(page), driver = new Driver(page, [target, root], root, { ...DEFAULTS }, performance.now());
  try {
    await page.locator('#a').focus(); expect((await driver.snapshot()).focus).toBe('current');
    await page.evaluate(() => { document.querySelector('#a')!.removeAttribute('data-current'); document.querySelector('#b')!.setAttribute('data-current', ''); });
    expect((await driver.snapshot()).focus).toBe('unknown');
    await page.locator('#b').focus(); expect((await driver.snapshot()).focus).toBe('current');
    await page.locator('#b').evaluate(el => el.removeAttribute('data-current'));
    expect((await driver.snapshot()).present.has('current')).toBe(false);
    await expectCleared(stores.issued); expect(driver.steps).toHaveLength(0);
  } finally { await driver.dispose(); stores.restore(); }
  await expectDisposed(stores.issued);
});

test('an absent foreign target cannot reuse a main-document binding', async ({ page }) => {
  await page.setContent('<button id="main">Main</button><iframe srcdoc="<p>Empty</p>"></iframe>');
  const target = { id: 'target', locator: page.locator('#main') };
  const stores = trackStores(page), driver = new Driver(page, [target], target, { ...DEFAULTS }, performance.now());
  try {
    expect((await driver.snapshot()).present.has('target')).toBe(true);
    // Playwright can evaluate an empty frame-locator result in the main context.
    // No foreign element exists to classify; the result must remain unresolved.
    target.locator = page.frameLocator('iframe').locator('button');
    const state = await driver.snapshot();
    expect(state.present.size).toBe(0); expect(state.inside).toBe(false);
    await expectCleared(stores.issued); expect(driver.steps).toHaveLength(0);
  } finally { await driver.dispose(); stores.restore(); }
  await expectDisposed(stores.issued);
});
