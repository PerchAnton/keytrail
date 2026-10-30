import { test, expect } from '@playwright/test';
import { Driver } from '../../src/browser/driver.js';
import { DEFAULTS } from '../../src/contracts/dialog.js';
import { tabsHtml, tabsContract } from '../fixtures/tabs.js';

test('a focus observation cannot combine two different instants', async ({ page }) => {
  await page.setContent('<section id="dialog"><button id="a">A</button><button id="b">B</button></section>');
  const a = { id: 'a', locator: page.locator('#a') }, b = { id: 'b', locator: page.locator('#b') };
  const dialog = { id: 'dialog', locator: page.locator('#dialog') };
  await a.locator.focus();
  const move = () => b.locator.focus();
  // Move focus after the first target read in either observation strategy.
  const evaluate = a.locator.evaluate.bind(a.locator);
  a.locator.evaluate = new Proxy(evaluate, {
    async apply(target, receiver, args) {
      const value = await Reflect.apply(target, receiver, args); await move(); return value;
    },
  });
  const elements = a.locator.elementHandles.bind(a.locator);
  a.locator.elementHandles = async () => {
    const value = await elements(); await move(); return value;
  };
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

test('replacement during observation is re-resolved and temporary handles are released', async ({ page }) => {
  await page.setContent('<section id="dialog"><button id="a">A</button></section>');
  const a = { id: 'a', locator: page.locator('#a') }, dialog = { id: 'dialog', locator: page.locator('#dialog') };
  const elements = a.locator.elementHandles.bind(a.locator);
  const issued: Awaited<ReturnType<typeof elements>> = [];
  let replaced = false;
  a.locator.elementHandles = async () => {
    const nodes = await elements();
    issued.push(...nodes);
    if (!replaced) {
      replaced = true;
      await a.locator.evaluate(el => el.replaceWith(el.cloneNode(true)));
      await a.locator.focus();
    }
    return nodes;
  };
  const driver = new Driver(page, [a, dialog], dialog, { ...DEFAULTS }, performance.now());
  try {
    const state = await driver.snapshot();
    expect([...state.focused]).toEqual(['a']);
    expect(state.inside).toBe(true);
    expect(issued.length).toBeGreaterThan(1);
    for (const node of issued) await expect(node.evaluate(el => el.isConnected)).rejects.toThrow();
    expect(driver.steps).toHaveLength(0);
  } finally { await driver.dispose(); }
});

test('an early resolution error awaits and disposes slower sibling handles', async ({ page }) => {
  await page.setContent('<section id="dialog"><button>A</button><button>B</button></section>');
  const ambiguous = { id: 'ambiguous', locator: page.locator('button') };
  const slow = { id: 'slow', locator: page.locator('#dialog') };
  const elements = slow.locator.elementHandles.bind(slow.locator);
  const issued: Awaited<ReturnType<typeof elements>> = [];
  let completed = false;
  slow.locator.elementHandles = async () => {
    await new Promise(resolve => setTimeout(resolve, 30));
    const nodes = await elements(); issued.push(...nodes); completed = true; return nodes;
  };
  const driver = new Driver(page, [ambiguous, slow], slow, { ...DEFAULTS }, performance.now());
  try {
    await expect(driver.snapshot()).rejects.toMatchObject({ code: 'TARGET_AMBIGUOUS' });
    expect(completed).toBe(true); expect(issued).toHaveLength(1);
    for (const node of issued) await expect(node.evaluate(el => el.isConnected)).rejects.toThrow();
    expect(driver.steps).toHaveLength(0);
  } finally { await driver.dispose(); }
});

for (const context of ['main', 'iframe'] as const) test(`a rejected ${context} observation preserves its context diagnosis and releases handles`, async ({ page }) => {
  await page.setContent('<button id="main">Main</button><iframe srcdoc="<button>Inner</button>"></iframe>');
  await expect(page.frameLocator('iframe').locator('button')).toBeVisible();
  const target = { id: 'target', locator: context === 'main' ? page.locator('#main') : page.frameLocator('iframe').locator('button') };
  const elements = target.locator.elementHandles.bind(target.locator);
  const issued: Awaited<ReturnType<typeof elements>> = [];
  target.locator.elementHandles = async () => { const nodes = await elements(); issued.push(...nodes); return nodes; };
  // A transport/context-adoption failure can prevent the atomic DOM read itself.
  // It must not turn a foreign target into a generic browser error, or invent a
  // foreign context for an ordinary browser error in the main document.
  const evaluate = page.evaluate;
  page.evaluate = async () => { throw new Error('CANARY_transport'); };
  const driver = new Driver(page, [target], target, { ...DEFAULTS }, performance.now());
  try {
    await expect(driver.snapshot()).rejects.toMatchObject({ code: context === 'iframe' ? 'UNSUPPORTED_CONTEXT' : 'BROWSER_ERROR' });
    expect(issued).toHaveLength(1);
    for (const node of issued) await expect(node.evaluate(el => el.isConnected)).rejects.toThrow();
    expect(driver.steps).toHaveLength(0);
  } finally { page.evaluate = evaluate; await driver.dispose(); }
});
