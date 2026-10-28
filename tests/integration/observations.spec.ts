import { test, expect } from '@playwright/test';
import { Driver } from '../../src/browser/driver.js';
import { DEFAULTS } from '../../src/contracts/dialog.js';

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
