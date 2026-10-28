import { test, expect, type TestInfo, type Page } from '@playwright/test';
import { readFile } from 'node:fs/promises';
import { assertDialogJourney, assertTabsJourney, assertFormErrorsJourney, JourneyAssertionError, type JourneyResult } from '../src/index.js';
import { dialogHtml, dialogContract } from '../tests/fixtures/dialog.js';
import { tabsHtml, tabsContract } from '../tests/fixtures/tabs.js';
import { formHtml, formContract } from '../tests/fixtures/form-errors.js';
import { nativeJourney, type Manifest } from './native-reference.js';

const pilot = process.env.KEYTRAIL_BENCHMARK_PILOT === '1';
const warmups = pilot ? 0 : 5, samples = pilot ? 1 : 30;
const cases = [
  { kind: 'dialog', html: (broken: boolean) => dialogHtml(broken ? 'wrong-initial' : 'ordinary'),
    run: (page: Page, info: TestInfo) => assertDialogJourney(page, info, dialogContract(page)), failure: 'D03.initial' },
  { kind: 'tabs', html: (broken: boolean) => tabsHtml({ activation: 'manual', defect: broken ? 'premature' : '' }),
    run: (page: Page, info: TestInfo) => assertTabsJourney(page, info, tabsContract(page, { activation: 'manual' })), failure: 'T05.forward.001.unchanged' },
  { kind: 'formErrors', html: (broken: boolean) => formHtml({ defect: broken ? 'wrong-focus' : '' }),
    run: (page: Page, info: TestInfo) => assertFormErrorsJourney(page, info, formContract(page)), failure: 'F04.focus' },
] as const;
function signature(result: JourneyResult) {
  return {
    outcome: result.outcome, coverage: result.coverage,
    checks: result.checks.map(c => { const observed = { ...c.observed }; delete observed.observationWindowMs; return { ...c, observed }; }),
    steps: result.steps.map(({ elapsedMs, observationWindowMs, ...step }) => step),
  };
}
for (const scenario of cases) test.describe(scenario.kind, () => {
  const executePair = async (context: import('@playwright/test').BrowserContext, testInfo: TestInfo, pair: number | null) => {
    const manifest: Manifest = JSON.parse(await readFile(`benchmarks/manifests/${scenario.kind}.json`, 'utf8'));
    const execute = async (arm: 'keytrail' | 'native', broken = false) => {
      const page = await context.newPage();
      try {
        await page.setContent(scenario.html(broken));
        const attachments: Buffer[] = [];
        const info = { testId: testInfo.testId, retry: 0,
          attach: async (name: string, attachment: { body: Buffer; contentType: string }) => {
            if (name !== 'journey-result.json' || attachment.contentType !== 'application/json') throw new Error('REPORT_ATTACHMENT_INVALID');
            attachments.push(attachment.body);
          } } as unknown as TestInfo;
        const start = performance.now();
        let result: JourneyResult;
        try { result = arm === 'keytrail' ? await scenario.run(page, info) : await nativeJourney(page, info, manifest); }
        catch (error) { if (!(error instanceof JourneyAssertionError)) throw error; result = error.result; }
        const durationMs = performance.now() - start;
        expect(attachments).toHaveLength(1);
        expect(JSON.parse(attachments[0]!.toString())).toEqual(result);
        return { result, durationMs };
      } finally { await page.close(); }
    };
    if (pair === null) {
      const broken = await execute('keytrail', true), nativeBroken = await execute('native', true);
      expect(broken.result.checks.find(c => c.status === 'fail')?.checkId).toBe(scenario.failure);
      expect(nativeBroken.result.checks.find(c => c.status === 'fail')?.checkId).toBe(scenario.failure);
      expect(signature(nativeBroken.result)).toEqual(signature(broken.result));
      await testInfo.attach('benchmark-control.json', { body: JSON.stringify({ kind: scenario.kind, failure: scenario.failure }), contentType: 'application/json' });
      return;
    }
    const order = pair % 2 === 0 ? ['keytrail', 'native'] as const : ['native', 'keytrail'] as const;
    const first = await execute(order[0]), second = await execute(order[1]);
    expect(first.result.outcome).toBe('passed'); expect(second.result.outcome).toBe('passed');
    expect(signature(first.result)).toEqual(signature(second.result));
    const keytrail = order[0] === 'keytrail' ? first : second, native = order[0] === 'native' ? first : second;
    const record = { kind: scenario.kind, pair, warmup: pair < 0, order: [...order], keytrailMs: keytrail.durationMs, nativeMs: native.durationMs,
      chromium: context.browser()!.version() };
    await testInfo.attach('benchmark-pair.json', { body: JSON.stringify(record), contentType: 'application/json' });
  };
  test('negative control', async ({ context }, info) => executePair(context, info, null));
  for (let pair = -warmups; pair < samples; pair++) test(`${pair < 0 ? 'warmup' : 'sample'} ${pair}`, async ({ context }, info) => executePair(context, info, pair));
});
