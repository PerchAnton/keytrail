import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import { assertTabsJourney, JourneyAssertionError, type JourneyResult, type TabsContract } from '../../src/index.js';
import { tabsHtml, tabsContract, type TabsOptions } from '../fixtures/tabs.js';

const schema = new Ajv2020({ strict: true }).compile(JSON.parse(readFileSync('schema/journey-result.v1.json', 'utf8')));
function verify(result: JourneyResult, info: TestInfo) {
  expect(schema(result), JSON.stringify(schema.errors)).toBe(true);
  expect(result.scenario.kind).toBe('tabs');
  expect(result.coverage.planned).toBe(result.coverage.passed + result.coverage.failed + result.coverage.blocked + result.coverage.notRun);
  expect(result.coverage.planned).toBe(result.checks.length);
  expect(new Set(result.checks.map(c => c.checkId)).size).toBe(result.checks.length);
  const attachments = info.attachments.filter(a => a.name === 'journey-result.json');
  expect(attachments).toHaveLength(1);
  expect(JSON.parse(attachments[0]!.body!.toString())).toEqual(result);
}
async function failure(page: Page, info: TestInfo, contract: TabsContract) {
  try { await assertTabsJourney(page, info, contract); }
  catch (e) { expect(e).toBeInstanceOf(JourneyAssertionError); const error = e as JourneyAssertionError; verify(error.result, info); return error; }
  throw new Error('Expected the tabs fixture to fail');
}
const correct: [string, TabsOptions][] = [
  ['horizontal automatic', {}], ['vertical automatic', { orientation: 'vertical' }],
  ['manual Enter', { activation: 'manual' }], ['manual Space', { activation: 'manual', activationKey: 'Space' }],
  ['automatic Home End', { homeEnd: true }], ['manual Home End', { activation: 'manual', homeEnd: true }],
  ['vertical manual Home End', { activation: 'manual', activationKey: 'Space', orientation: 'vertical', homeEnd: true }],
  ['initial last Home End', { homeEnd: true, initial: 2 }],
  ['rerendered tabs', { defect: 'rerender' }], ['delayed activation', { defect: 'delayed' }],
  ['delayed manual activation', { activation: 'manual', defect: 'delayed' }],
];
for (const [name, options] of correct) test(`tabs pass ${name}`, async ({ page }, info) => {
  await page.setContent(tabsHtml(options));
  const result = await assertTabsJourney(page, info, tabsContract(page, options));
  verify(result, info);
  expect(result.outcome).toBe('passed'); expect(result.coverage.complete).toBe(true);
  expect(result.checks.at(-1)?.observed.focus).toBe(`panel-${options.initial ?? 1}`);
  expect(result.steps.filter(s => s.key === 'Home' || s.key === 'End')).toHaveLength(options.homeEnd ? 2 : 0);
  expect(result.steps.filter(s => s.key === 'Tab')).toHaveLength(2);
  if (options.activation === 'manual') {
    const moves = result.steps.filter(s => s.key?.startsWith('Arrow') || s.key === 'Home' || s.key === 'End');
    expect(moves.every(s => s.observationWindowMs >= result.config.observationWindowMs)).toBe(true);
    expect(result.steps.filter(s => s.key === (options.activationKey ?? 'Enter'))).toHaveLength(moves.length);
    expect(result.checks.some(c => c.checkId.endsWith('.unchanged') && c.expected.selected !== result.steps.find(s => s.stepId === c.stepId)?.afterFocus)).toBe(true);
  }
});
const defects: [string, string, string, TabsOptions?][] = [
  ['wrong-arrow', 'T03.forward.001', 'FOCUS_MISMATCH'], ['no-wrap', 'T03.forward.002', 'FOCUS_MISMATCH'],
  ['premature', 'T05.forward.001.unchanged', 'PREMATURE_ACTIVATION', { activation: 'manual' }],
  ['late-premature', 'T05.forward.001.unchanged', 'PREMATURE_ACTIVATION', { activation: 'manual' }],
  ['transient-premature', 'T05.forward.001.unchanged', 'PREMATURE_ACTIVATION', { activation: 'manual' }],
  ['focus-drift', 'T05.forward.001.unchanged', 'FOCUS_MISMATCH', { activation: 'manual' }],
  ['focus-drift-before-roving', 'T05.forward.001.unchanged', 'FOCUS_MISMATCH', { activation: 'manual' }],
  ['multiple-selected', 'T06.initial', 'SELECTION_MISMATCH'], ['multiple-panels', 'T06.initial', 'SELECTION_MISMATCH'],
  ['idref', 'T02.item.001.controls', 'IDREF_MISMATCH'], ['labelledby', 'T02.item.001.labelledby', 'IDREF_MISMATCH'],
  ['duplicate-id', 'T02.item.001.controls', 'IDREF_MISMATCH'], ['exit', 'T07.exit', 'FOCUS_MISMATCH'],
  ['roving', 'T06.forward.001.roving', 'ROVING_MISMATCH'],
  ['no-activation', 'T05.forward.001.activated', 'SELECTION_MISMATCH', { activation: 'manual' }],
  ['no-name', 'T02.name', 'NAME_MISSING'], ['orientation', 'T02.orientation', 'ORIENTATION_MISMATCH'],
  ['extra-tab', 'T02.structure', 'STRUCTURE_MISMATCH'], ['missing-panel', 'T02.structure', 'STRUCTURE_MISMATCH'],
  ['panel-role', 'T02.item.001.panel-role', 'ROLE_MISMATCH'], ['no-home', 'T08.home', 'FOCUS_MISMATCH', { homeEnd: true }],
];
for (const [defect, check, code, base] of defects) test(`tabs detect ${defect}`, async ({ page }, info) => {
  const options = { ...base, defect };
  await page.setContent(tabsHtml(options));
  const contract = tabsContract(page, options);
  const observationWindowMs = defect.startsWith('focus-drift') ? 1500 : ['late-premature', 'transient-premature'].includes(defect) ? 500 : 200;
  const error = await failure(page, info, { ...contract, observationWindowMs });
  expect(error.code).toBe(code);
  expect(error.result.checks.find(c => c.checkId === check)?.status).toBe('fail');
  if (code === 'PREMATURE_ACTIVATION') expect(error.message).toBe('T05 PREMATURE_ACTIVATION expected-selected=tab-1 observed-selected=tab-2');
  const keys = await page.evaluate(() => (window as any).keytrailKeys.length);
  await page.waitForTimeout(220);
  expect(await page.evaluate(() => (window as any).keytrailKeys.length)).toBe(keys);
  if (code === 'PREMATURE_ACTIVATION' || defect.startsWith('focus-drift')) expect(error.result.steps.some(s => s.key === 'Enter' || s.key === 'Space')).toBe(false);
});
for (const [defect, code] of [['rtl', 'UNSUPPORTED_TABS'], ['disabled', 'UNSUPPORTED_TABS'],
  ['activedescendant', 'UNSUPPORTED_TABS'], ['dynamic', 'UNSUPPORTED_TABS'], ['popup', 'POPUP'], ['navigation', 'NAVIGATION']] as const) {
  test(`tabs block ${defect}`, async ({ page }, info) => {
    await page.setContent(tabsHtml({ defect }));
    const error = await failure(page, info, tabsContract(page));
    expect(error.code).toBe(code); expect(error.result.outcome).toBe('blocked');
    if (['rtl', 'disabled', 'activedescendant'].includes(defect)) expect(error.result.steps).toHaveLength(0);
  });
}
test('tabs already-focused entry preserves the initial state', async ({ page }, info) => {
  await page.setContent(tabsHtml()); await page.keyboard.press('Tab');
  const result = await assertTabsJourney(page, info, tabsContract(page)); verify(result, info);
  expect(result.coverage.entryEvidence).toBe('already_focused'); expect(result.steps[0]?.key).toBe('ArrowRight');
});
test('tabs invalid contract blocks without actions or private input', async ({ page }, info) => {
  await page.setContent(tabsHtml());
  const contract = { ...tabsContract(page), id: 'CANARY_config invalid' };
  const error = await failure(page, info, contract);
  expect(error.code).toBe('CONFIG_INVALID'); expect(error.result.steps).toHaveLength(0);
  expect(JSON.stringify(error.result)).not.toContain('CANARY');
});
test('tabs report omits DOM IDs, labels, page text and URL', async ({ page }, info) => {
  await page.goto('about:blank#CANARY_url');
  await page.setContent(tabsHtml({ defect: 'idref' }).replace('Account sections', 'CANARY_name').replace('Panel 1', 'CANARY_text'));
  await page.locator('#tab-0').evaluate(el => el.setAttribute('aria-controls', 'CANARY_dom_id'));
  const error = await failure(page, info, tabsContract(page));
  expect(error.code).toBe('IDREF_MISMATCH'); expect(JSON.stringify(error.result) + error.message).not.toContain('CANARY');
});
test('tabs manual observation cannot outlive the scenario budget', async ({ page }, info) => {
  const options = { activation: 'manual' as const };
  await page.setContent(tabsHtml(options));
  const error = await failure(page, info, { ...tabsContract(page, options), observationWindowMs: 1500, scenarioTimeoutMs: 1000 });
  expect(error.code).toBe('SCENARIO_TIMEOUT'); expect(error.result.steps.some(s => s.key === 'Enter')).toBe(false);
});
test('tabs target aliases are blocked before keyboard input', async ({ page }, info) => {
  await page.setContent(tabsHtml());
  const contract = tabsContract(page);
  const error = await failure(page, info, { ...contract, nextTabStop: { id: 'alias', locator: contract.items[0]!.tab.locator } });
  expect(error.code).toBe('TARGET_ALIAS'); expect(error.result.steps).toHaveLength(0);
});
test('tabs missing entry reaches its declared limit without arrow input', async ({ page }, info) => {
  await page.setContent(tabsHtml());
  await page.locator('#tab-1').evaluate(el => { (el as HTMLElement).tabIndex = -1; });
  const error = await failure(page, info, { ...tabsContract(page), entry: { maxTabs: 2 } });
  expect(error.code).toBe('ENTRY_LIMIT'); expect(error.result.steps.map(s => s.key)).toEqual(['Tab', 'Tab']);
});
test('tabs closed page still attaches a blocked result', async ({ page }, info) => {
  const contract = tabsContract(page); await page.close();
  const error = await failure(page, info, contract);
  expect(error.code).toBe('PAGE_CLOSED'); expect(error.result.steps).toHaveLength(0);
});
test('tabs attachment failure preserves the detected defect', async ({ page }, info) => {
  await page.setContent(tabsHtml({ defect: 'idref' }));
  const attach = info.attach.bind(info);
  info.attach = async (...args) => { await attach(...args); throw new Error('CANARY_attachment'); };
  const error = await failure(page, info, tabsContract(page));
  expect(error.code).toBe('REPORT_WRITE_FAILED');
  expect(error.result.checks.find(c => c.status === 'fail')?.messageCode).toBe('IDREF_MISMATCH');
  expect(error.message).not.toContain('CANARY');
});

for (const latency of ['before', 'after'] as const) test(`manual tabs block a browser observation gap ${latency} evaluation`, async ({ page }, info) => {
  await page.setContent(tabsHtml({ activation: 'manual' }));
  const original = page.evaluate.bind(page);
  page.evaluate = (async (...args: Parameters<typeof original>) => {
    if (latency === 'before') await new Promise(resolve => setTimeout(resolve, 150));
    const value = await original(...args);
    if (latency === 'after') await new Promise(resolve => setTimeout(resolve, 150));
    return value;
  }) as typeof page.evaluate;
  const error = await failure(page, info, { ...tabsContract(page, { activation: 'manual' }), observationWindowMs: 50 });
  expect(error.code).toBe('OBSERVATION_GAP'); expect(error.result.outcome).toBe('blocked');
  const check = error.result.checks.find(c => c.status === 'blocked')!;
  expect(check.checkId).toBe('T05.forward.001.unchanged');
  expect(check.observed.observationCount).toBe(2);
  expect(check.observed.observationIntervalsMs).toHaveLength(1);
  expect(check.observed.maxObservationGapMs).toBeGreaterThan(100);
  expect(error.result.steps.some(s => s.key === 'Enter' || s.key === 'Space')).toBe(false);
  expect(error.result.checks.filter(c => c.status === 'not_run').every(c => c.blockedBy === check.checkId)).toBe(true);
});

test('manual tabs record initial and final observations even for a short window', async ({ page }, info) => {
  await page.setContent(tabsHtml({ activation: 'manual' }));
  const result = await assertTabsJourney(page, info, { ...tabsContract(page, { activation: 'manual' }), observationWindowMs: 50 });
  verify(result, info);
  for (const check of result.checks.filter(c => c.checkId.endsWith('.unchanged'))) {
    const observed = check.observed;
    expect(observed.observationCount).toBeGreaterThanOrEqual(2);
    expect(observed.observationIntervalsMs!.length).toBe(observed.observationCount! - 1);
    expect(observed.observationWindowMs).toBeGreaterThanOrEqual(50);
    expect(observed.maxObservationGapMs).toBeLessThanOrEqual(100);
  }
});
