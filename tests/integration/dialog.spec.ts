import { test, expect, type TestInfo, type Page } from '@playwright/test';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import { assertDialogJourney, JourneyAssertionError, type JourneyResult } from '../../src/index.js';
import { dialogHtml, dialogContract, type Variant } from '../fixtures/dialog.js';

const validate = new Ajv2020({ strict: true }).compile(JSON.parse(readFileSync('schema/journey-result.v1.json', 'utf8')));
function verifyResult(result: JourneyResult, info: TestInfo) {
  expect(validate(result), JSON.stringify(validate.errors)).toBe(true);
  const c = result.coverage;
  expect(c.planned).toBe(c.passed + c.failed + c.blocked + c.notRun);
  expect(c.planned).toBe(result.checks.length);
  expect(new Set(result.checks.map(c => c.checkId)).size).toBe(c.planned);
  const attachments = info.attachments.filter(a => a.name === 'journey-result.json');
  expect(attachments).toHaveLength(1);
  expect(JSON.parse(attachments[0]!.body!.toString())).toEqual(result);
}
async function failure(page: Page, info: TestInfo, contract = dialogContract(page)): Promise<JourneyAssertionError> {
  try { await assertDialogJourney(page, info, contract); }
  catch (error) { expect(error).toBeInstanceOf(JourneyAssertionError); verifyResult((error as JourneyAssertionError).result, info); return error as JourneyAssertionError; }
  throw new Error('Expected the fixture to fail');
}
for (const variant of ['ordinary', 'single', 'heading', 'alternate', 'delayed', 'rerender'] as const) {
  test(`passes ${variant}`, async ({ page }, info) => {
    await page.setContent(dialogHtml(variant));
    const result = await assertDialogJourney(page, info, dialogContract(page, variant));
    verifyResult(result, info);
    expect(result.outcome).toBe('passed');
    expect(result.coverage.complete).toBe(true);
    expect(result.checks.every(c => c.status === 'pass')).toBe(true);
    expect(result.checks.find(c => c.checkId === 'D07.returned')?.observed.focus).toBe(variant === 'alternate' ? 'alternative' : 'open');
    expect(result.steps.filter(s => s.key === 'Escape')).toHaveLength(1);
    expect(result.steps.filter(s => s.key === 'Shift+Tab')).toHaveLength(variant === 'single' ? 1 : 3);
    expect(result.steps.filter(s => s.key === 'Tab')).toHaveLength(variant === 'heading' ? 5 : variant === 'single' ? 2 : 4);
  });
}
const defects: [Variant, string, string][] = [
  ['wrong-initial', 'D03.initial', 'FOCUS_MISMATCH'],
  ['escape-focus', 'D04.forward.003', 'FOCUS_MISMATCH'],
  ['bad-reverse', 'D04.backward.001', 'FOCUS_MISMATCH'],
  ['no-close', 'D06.closed', 'EXPECTATION_TIMEOUT'],
  ['no-return', 'D07.returned', 'FOCUS_MISMATCH'],
  ['no-name', 'D02.name', 'NAME_MISSING'],
];
for (const [variant, id, code] of defects) {
  test(`detects ${variant}`, async ({ page }, info) => {
    await page.setContent(dialogHtml(variant));
    const error = await failure(page, info, dialogContract(page, variant));
    expect(error.code).toBe(code);
    expect(error.result.checks.find(c => c.checkId === id)?.status).toBe('fail');
    expect(error.result.outcome).toBe('failed');
    if (variant !== 'no-return') {
      expect(error.result.coverage.complete).toBe(false);
      expect(error.result.checks.find(c => c.checkId === 'D07.returned')?.blockedBy).toBe(id);
    } else expect(error.message).toBe('D07 FOCUS_MISMATCH expected=open observed=body');
    if (variant === 'escape-focus') {
      expect(error.result.checks.find(c => c.checkId === 'D05.forward.003')?.status).toBe('fail');
      expect(error.result.steps.some(s => s.key === 'Escape')).toBe(false);
    }
    const before = await page.evaluate(() => (window as any).keytrailKeys.length);
    await page.waitForTimeout(100);
    expect(await page.evaluate(() => (window as any).keytrailKeys.length)).toBe(before);
  });
}
test('Space activation and already-focused entry', async ({ page }, info) => {
  await page.setContent(dialogHtml());
  await page.keyboard.press('Tab');
  const result = await assertDialogJourney(page, info, { ...dialogContract(page), openKey: 'Space' });
  verifyResult(result, info);
  expect(result.coverage.entryEvidence).toBe('already_focused');
  expect(result.steps[0]?.key).toBe('Space');
});
test('an observed escape cannot be hidden by a later focus return', async ({ page }, info) => {
  await page.setContent(dialogHtml('escape-return'));
  const error = await failure(page, info, dialogContract(page));
  expect(error.result.checks.find(c => c.checkId === 'D05.forward.003')?.status).toBe('fail');
  expect(error.result.steps.some(s => s.key === 'Escape')).toBe(false);
});
test('ambiguous target blocks before keyboard input', async ({ page }, info) => {
  await page.setContent(dialogHtml());
  const contract = dialogContract(page);
  const trigger = { id: 'ambiguous', locator: page.getByRole('button') };
  const error = await failure(page, info, { ...contract, trigger, returnFocus: trigger });
  expect(error.code).toBe('TARGET_AMBIGUOUS');
  expect(error.result.steps).toHaveLength(0);
});
test('same DOM node with different ids is blocked', async ({ page }, info) => {
  await page.setContent(dialogHtml());
  const contract = dialogContract(page);
  const error = await failure(page, info, { ...contract, returnFocus: { id: 'alias', locator: contract.trigger.locator } });
  expect(error.code).toBe('TARGET_ALIAS');
  expect(error.result.steps).toHaveLength(0);
});
test('entry limit preserves unreached observations', async ({ page }, info) => {
  await page.setContent(dialogHtml());
  const contract = dialogContract(page);
  const trigger = { id: 'missing', locator: page.locator('#missing') };
  const error = await failure(page, info, { ...contract, trigger, returnFocus: trigger, entry: { maxTabs: 1 } });
  expect(error.code).toBe('ENTRY_LIMIT');
  expect(error.result.coverage.entryEvidence).toBe('unreached');
  expect(error.result.steps).toHaveLength(1);
  expect(error.result.checks.slice(1).every(c => c.status === 'not_run' && c.blockedBy === 'D01.entry')).toBe(true);
});
for (const [variant, code] of [['navigation', 'NAVIGATION'], ['popup', 'POPUP'], ['native-alert', 'UNSUPPORTED_DIALOG']] as const) {
  test(`blocks ${variant}`, async ({ page }, info) => {
    await page.setContent(dialogHtml(variant));
    const error = await failure(page, info);
    expect(error.code).toBe(code);
    expect(error.result.outcome).toBe('blocked');
    expect(error.result.steps.at(-1)?.key).toBe('Enter');
  });
}
test('foreign Page target is blocked', async ({ page, context }, info) => {
  await page.setContent(dialogHtml());
  const other = await context.newPage();
  await other.setContent('<button>Other</button>');
  const contract = dialogContract(page);
  const error = await failure(page, info, { ...contract, returnFocus: { id: 'other', locator: other.locator('button') } });
  expect(error.code).toBe('UNSUPPORTED_CONTEXT');
  await other.close();
});
test('iframe target is blocked', async ({ page }, info) => {
  await page.setContent(dialogHtml()+'<iframe srcdoc="<button>Inner</button>"></iframe>');
  const contract = dialogContract(page);
  await expect(page.frameLocator('iframe').locator('button')).toBeVisible();
  const error = await failure(page, info, { ...contract, returnFocus: { id: 'inner', locator: page.frameLocator('iframe').locator('button') } });
  expect(error.code).toBe('UNSUPPORTED_CONTEXT');
});
test('ShadowRoot target is blocked', async ({ page }, info) => {
  await page.setContent(dialogHtml()+'<div id="host"></div>');
  await page.locator('#host').evaluate(el => { el.attachShadow({ mode: 'open' }).innerHTML = '<button id="shadow">Shadow</button>'; });
  const contract = dialogContract(page);
  const error = await failure(page, info, { ...contract, returnFocus: { id: 'shadow', locator: page.locator('#shadow') } });
  expect(error.code).toBe('UNSUPPORTED_CONTEXT');
});
test('native HTML dialog is blocked', async ({ page }, info) => {
  await page.setContent('<dialog open><button id="open">Open</button></dialog>');
  const error = await failure(page, info);
  expect(error.code).toBe('UNSUPPORTED_DIALOG');
});
test('closed Page is blocked with an attached result', async ({ page }, info) => {
  const contract = dialogContract(page);
  await page.close();
  const error = await failure(page, info, contract);
  expect(error.code).toBe('PAGE_CLOSED');
});
test('invalid contract never serializes arbitrary fields', async ({ page }, info) => {
  const secret = 'CANARY_config_7bcda';
  const contract = { ...dialogContract(page), id: secret+' / invalid', unknown: secret };
  const error = await failure(page, info, contract);
  expect(error.code).toBe('CONFIG_INVALID');
  expect(error.result.checks).toHaveLength(1);
  expect(JSON.stringify(error.result)+error.message).not.toContain(secret);
});
test('scenario budget dominates a longer assertion timeout', async ({ page }, info) => {
  await page.setContent(dialogHtml('no-name'));
  const error = await failure(page, info, { ...dialogContract(page), timeoutMs: 2000, scenarioTimeoutMs: 1000 });
  expect(error.code).toBe('SCENARIO_TIMEOUT');
  expect(error.result.outcome).toBe('blocked');
  expect(error.result.run.durationMs).toBeLessThan(2500);
});
test('own report excludes DOM, names, values and URL', async ({ page }, info) => {
  const canaries = ['CANARY_value_1', 'CANARY_text_2', 'CANARY_name_3', 'CANARY_url_4'];
  await page.goto('about:blank#'+canaries[3]);
  await page.setContent(dialogHtml('no-return').replace('value="Example"', `value="${canaries[0]}"`)
    .replace('Edit profile</h2>', `${canaries[2]}</h2>`)+`<p>${canaries[1]}</p>`);
  const error = await failure(page, info);
  for (const value of canaries) expect(JSON.stringify(error.result)+error.message).not.toContain(value);
});
test('raw browser errors are replaced with a safe code', async ({ page }, info) => {
  await page.setContent(dialogHtml());
  const original = page.keyboard.press.bind(page.keyboard);
  page.keyboard.press = async (key, options) => {
    if (key === 'Enter') throw new Error('CANARY_raw_browser_5 selector=#secret value=private');
    await original(key, options);
  };
  const error = await failure(page, info);
  expect(error.code).toBe('BROWSER_ERROR');
  expect(JSON.stringify(error.result)+error.message).not.toContain('CANARY_raw_browser_5');
  expect(error.result.checks[0]?.stepId).toBe('step-002');
});
test('missing dialog is a failed expectation, not an empty pass', async ({ page }, info) => {
  await page.setContent(dialogHtml());
  await page.locator('#open').evaluate(el => el.replaceWith(el.cloneNode(true)));
  await page.locator('#dialog').evaluate(el => el.remove());
  const error = await failure(page, info);
  expect(error.result.checks.find(c => c.status === 'fail')?.checkId).toBe('D02.visible');
  expect(error.code).toBe('EXPECTATION_TIMEOUT');
});
test('visible nested dialog is unsupported', async ({ page }, info) => {
  await page.setContent(dialogHtml());
  await page.locator('#dialog').evaluate(el => el.insertAdjacentHTML('beforeend', '<div role="dialog" aria-label="Inner">Inner</div>'));
  const error = await failure(page, info);
  expect(error.code).toBe('UNSUPPORTED_DIALOG');
});
test('an unregistered focus target is represented as unknown', async ({ page }, info) => {
  await page.setContent(dialogHtml());
  await page.evaluate(() => document.addEventListener('keydown', e => {
    if (e.key === 'Escape') document.getElementById('outside')!.focus();
  }));
  const error = await failure(page, info);
  expect(error.result.checks.find(c => c.checkId === 'D07.returned')?.observed.focus).toBe('unknown');
  expect(error.message).not.toContain('Outside');
});
test('report-write error preserves the original primary failure', async ({ page }, info) => {
  await page.setContent(dialogHtml('no-return'));
  const original = info.attach.bind(info);
  info.attach = async (...args) => { await original(...args); throw new Error('CANARY_raw_attach_35'); };
  const error = await failure(page, info);
  expect(error.code).toBe('REPORT_WRITE_FAILED');
  expect(error.result.checks.find(c => c.status === 'fail')?.checkId).toBe('D07.returned');
  expect(error.message).not.toContain('CANARY_raw_attach_35');
});

test('a declared target named unsupported is a valid focus target', async ({ page }, info) => {
  await page.setContent(dialogHtml());
  const contract = dialogContract(page);
  const trigger = { ...contract.trigger, id: 'unsupported' };
  const result = await assertDialogJourney(page, info, { ...contract, trigger, returnFocus: trigger });
  verifyResult(result, info);
  expect(result.outcome).toBe('passed');
  expect(result.checks.at(-1)?.observed.focus).toBe('unsupported');
});
for (const kind of ['shadow', 'iframe'] as const) {
  test(`declared ${kind} host cannot mask unsupported return focus`, async ({ page }, info) => {
    await page.setContent(dialogHtml() + (kind === 'shadow' ? '<div id="host"></div>' : '<iframe id="host" srcdoc="<input>"></iframe>'));
    if (kind === 'iframe') await expect(page.frameLocator('#host').locator('input')).toBeVisible();
    await page.evaluate(kind => {
      const host = document.getElementById('host')!;
      if (kind === 'shadow') host.attachShadow({ mode: 'open' }).innerHTML = '<input>';
      document.addEventListener('keydown', e => {
        if (e.key !== 'Escape') return;
        const root = kind === 'shadow' ? host.shadowRoot! : (host as HTMLIFrameElement).contentDocument!;
        root.querySelector('input')!.focus();
      });
    }, kind);
    const contract = { ...dialogContract(page), returnFocus: { id: 'host', locator: page.locator('#host') } };
    const error = await failure(page, info, contract);
    expect(error.code).toBe('UNSUPPORTED_CONTEXT');
    expect(error.result.steps.at(-1)?.key).toBe('Escape');
    expect(error.result.checks.at(-1)?.status).toBe('not_run');
  });
}
test('visible nested dialog with role fallback tokens is unsupported', async ({ page }, info) => {
  await page.setContent(dialogHtml());
  await page.locator('#dialog').evaluate(el => el.insertAdjacentHTML('beforeend', '<div role="dialog region" aria-label="Inner">Inner</div>'));
  const error = await failure(page, info);
  expect(error.code).toBe('UNSUPPORTED_DIALOG');
});
test('a region with a dialog fallback is not a second dialog', async ({ page }, info) => {
  await page.setContent(dialogHtml());
  await page.locator('#dialog').evaluate(el => el.insertAdjacentHTML('beforeend', '<div role="region dialog" aria-label="Details">Details</div>'));
  const result = await assertDialogJourney(page, info, dialogContract(page));
  verifyResult(result, info);
  expect(result.outcome).toBe('passed');
});
test('an unrelated hidden shadow dialog does not block the main-document journey', async ({ page }, info) => {
  await page.setContent(dialogHtml() + '<div id="host" hidden></div>');
  await page.locator('#host').evaluate(el => {
    el.attachShadow({ mode: 'open' }).innerHTML = '<div role="dialog" aria-label="Other">Other</div>';
  });
  const result = await assertDialogJourney(page, info, dialogContract(page));
  verifyResult(result, info);
  expect(result.outcome).toBe('passed');
});

for (const openKey of ['Enter', 'Space'] as const) test(`dialog rejects focus drift before ${openKey} activation`, async ({ page }, info) => {
  await page.setContent(dialogHtml());
  await page.evaluate(() => document.getElementById('outside')!.addEventListener('click', () => document.getElementById('open')!.click()));
  await page.keyboard.press('Tab');
  const contract = { ...dialogContract(page), openKey };
  const locator = contract.trigger.locator, evaluateAll = locator.evaluateAll;
  let observations = 0;
  locator.evaluateAll = (async (...args: Parameters<typeof evaluateAll>) => {
    const value = await evaluateAll.apply(locator, args);
    // First read establishes entry; the next is the action's own preflight snapshot.
    if (++observations === 2) await page.locator('#outside').focus();
    return value;
  }) as typeof evaluateAll;
  const error = await failure(page, info, contract);
  expect(observations).toBe(2);
  expect(error.code).toBe('FOCUS_MISMATCH'); expect(error.result.outcome).toBe('failed');
  expect(error.result.checks[0]).toMatchObject({ status: 'fail', observed: { focus: 'unknown' } });
  expect(error.result.steps).toHaveLength(0);
  expect(error.result.checks.slice(1).every(c => c.status === 'not_run' && c.blockedBy === 'D01.entry')).toBe(true);
  expect(await page.evaluate(() => (window as any).keytrailKeys)).toEqual(['Tab']);
  await expect(page.locator('#dialog')).not.toBeVisible();
});
