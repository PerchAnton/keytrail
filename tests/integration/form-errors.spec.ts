import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { Ajv2020 } from 'ajv/dist/2020.js';
import { readFileSync } from 'node:fs';
import { assertFormErrorsJourney, JourneyAssertionError, type FormErrorsContract, type JourneyResult } from '../../src/index.js';
import { formHtml, formContract, type FormOptions } from '../fixtures/form-errors.js';

const schema = new Ajv2020({ strict: true }).compile(JSON.parse(readFileSync('schema/journey-result.v1.json', 'utf8')));
function verify(result: JourneyResult, info: TestInfo) {
  expect(schema(result), JSON.stringify(schema.errors)).toBe(true);
  expect(result.scenario.kind).toBe('formErrors');
  expect(result.coverage.planned).toBe(result.checks.length);
  const count = (status: string) => result.checks.filter(c => c.status === status).length;
  expect(result.coverage).toMatchObject({ passed: count('pass'), failed: count('fail'), blocked: count('blocked'), notRun: count('not_run') });
  expect(new Set(result.checks.map(c => c.checkId)).size).toBe(result.checks.length);
  const first = result.checks.find(c => c.status === 'fail' || c.status === 'blocked');
  expect(result.checks.filter(c => c.status === 'not_run').every(c => c.blockedBy === first?.checkId)).toBe(true);
  const attachments = info.attachments.filter(a => a.name === 'journey-result.json');
  expect(attachments).toHaveLength(1);
  expect(JSON.parse(attachments[0]!.body!.toString())).toEqual(result);
}
async function failure(page: Page, info: TestInfo, contract: FormErrorsContract) {
  try { await assertFormErrorsJourney(page, info, contract); }
  catch (e) { expect(e).toBeInstanceOf(JourneyAssertionError); const error = e as JourneyAssertionError; verify(error.result, info); return error; }
  throw new Error('Expected the form fixture to fail');
}
const correct: [string, FormOptions][] = [
  ['firstInvalid live', {}], ['summary resubmit and links', { policy: 'summary', mode: 'resubmit', links: true }],
  ['stay', { policy: 'stay' }], ['manual submit Space', { submitKey: 'Space', mode: 'resubmit' }],
  ['errormessage and external messages', { via: 'aria-errormessage', external: true }],
  ['delayed errors', { defect: 'delayed' }], ['rerendered fields', { defect: 'rerender' }],
  ['removed messages', { defect: 'removed-message' }], ['empty correction', { values: ['', 'sample-two'] }],
  ['unicode correction', { values: ['🧭'.repeat(256), 'café'] }], ['textarea', { fieldType: 'textarea' }],
  ...['email', 'search', 'tel', 'url', 'password'].map(type => [type, { fieldType: type }] as [string, FormOptions]),
];
for (const [name, options] of correct) test(`forms pass ${name}`, async ({ page }, info) => {
  await page.setContent(formHtml(options));
  const result = await assertFormErrorsJourney(page, info, formContract(page, options)); verify(result, info);
  expect(result.outcome).toBe('passed'); expect(result.coverage.complete).toBe(true);
  expect(result.checks.every(c => c.status === 'pass' && c.messageCode === 'OK')).toBe(true);
  expect(await page.evaluate(() => (window as any).keytrailSubmits)).toBe(options.mode === 'resubmit' ? 2 : 1);
  expect(result.steps.filter(s => s.key === 'ControlOrMeta+A')).toHaveLength(2);
  expect(result.steps.filter(s => s.actionKind === 'insertText').every(s => s.key === null)).toBe(true);
});
const defects: [string, string, string, FormOptions?][] = [
  ['empty-text', 'F02.message.001', 'TEXT_MISMATCH'], ['wrong-text', 'F02.message.001', 'TEXT_MISMATCH'],
  ['hidden-text', 'F02.message.001', 'TEXT_MISMATCH'], ['idref', 'F03.field.001.idref', 'IDREF_MISMATCH'],
  ['extra-message-idref', 'F03.field.001.idref', 'IDREF_MISMATCH'], ['no-invalid', 'F03.field.001.invalid', 'INVALID_STATE_MISMATCH'],
  ['wrong-focus', 'F04.focus', 'FOCUS_MISMATCH'], ['wrong-link', 'F05.link.001.focus', 'FOCUS_MISMATCH', { policy: 'summary', links: true }],
  ['not-cleared', 'F06.clear.001', 'ERROR_NOT_CLEARED'], ['reappeared-error', 'F06.clear.001', 'ERROR_NOT_CLEARED'], ['stale-invalid', 'F06.clear.001', 'ERROR_NOT_CLEARED'],
  ['value-transform', 'F06.field.001.value', 'VALUE_MISMATCH'], ['select-prevented', 'F06.field.001.value', 'VALUE_MISMATCH'],
  ['select-drift', 'F06.field.001.value', 'FOCUS_MISMATCH'], ['outside-field', 'F01.structure', 'STRUCTURE_MISMATCH'],
];
for (const [defect, id, code, base] of defects) test(`forms detect ${defect}`, async ({ page }, info) => {
  const options = { ...base, defect }; await page.setContent(formHtml(options));
  const error = await failure(page, info, formContract(page, options));
  expect(error.code).toBe(code);
  expect(error.result.checks.filter(c => c.status === 'fail').map(c => c.checkId)).toEqual([id]);
  expect(error.result.checks.filter(c => c.status === 'blocked')).toHaveLength(0);
  expect(error.result.coverage.complete).toBe(false);
  if (defect === 'select-drift') expect(error.result.steps.some(s => s.actionKind === 'insertText')).toBe(false);
  const keys = await page.evaluate(() => (window as any).keytrailKeys.length);
  await page.waitForTimeout(150);
  expect(await page.evaluate(() => (window as any).keytrailKeys.length)).toBe(keys);
});
const blocked: [string, string, string, FormOptions?][] = [
  ['no-novalidate', 'F01.structure', 'UNSUPPORTED_FORM'], ['button-type', 'F01.structure', 'UNSUPPORTED_FORM'],
  ['number', 'F01.structure', 'UNSUPPORTED_FORM', { fieldType: 'number' }],
  ['readonly', 'F06.field.001.value', 'NOT_EDITABLE'], ['aria-disabled', 'F06.field.001.value', 'NOT_EDITABLE'],
  ['unreachable-link', 'F05.link.001.entry', 'ENTRY_LIMIT', { policy: 'summary', links: true }],
  ['unreachable-correction', 'F06.field.001.entry', 'ENTRY_LIMIT', { policy: 'stay' }],
  ['navigation', 'F01.submit', 'NAVIGATION'], ['popup', 'F01.submit', 'POPUP'],
];
for (const [defect, id, code, base] of blocked) test(`forms block ${defect}`, async ({ page }, info) => {
  const options = { ...base, defect }; await page.setContent(formHtml(options));
  const error = await failure(page, info, { ...formContract(page, options), entry: { maxTabs: 8 } });
  expect(error.code).toBe(code); expect(error.result.outcome).toBe('blocked');
  expect(error.result.checks.filter(c => c.status === 'blocked').map(c => c.checkId)).toEqual([id]);
  if (code === 'UNSUPPORTED_FORM') expect(error.result.steps).toHaveLength(0);
});
test('forms reject duplicate DOM message IDs with a unique locator', async ({ page }, info) => {
  await page.setContent(formHtml({ defect: 'duplicate-id' })); const contract = formContract(page);
  const errors = contract.errors.map((e, i) => i === 0 ? { ...e, message: { id: 'error-0', locator: page.locator('form #error-0') } } : e);
  const error = await failure(page, info, { ...contract, errors });
  expect(error.code).toBe('IDREF_MISMATCH'); expect(error.result.checks.find(c => c.status === 'fail')?.checkId).toBe('F03.field.001.idref');
});
test('forms normalize complete text and support non-stateful regular expressions', async ({ page }, info) => {
  await page.setContent(formHtml()); const contract = formContract(page);
  const errors = contract.errors.map((e, i) => ({ ...e, expectedText: i ? /^enter a valid value 2\.$/i : '  Enter a   valid value 1.\n' }));
  verify(await assertFormErrorsJourney(page, info, { ...contract, errors }), info);
});
test('forms invalid contract acts on nothing and does not expose input', async ({ page }, info) => {
  await page.setContent(formHtml()); const contract = formContract(page);
  const error = await failure(page, info, { ...contract, errors: [{ ...contract.errors[0]!, expectedText: /CANARY/g }] });
  expect(error.code).toBe('CONFIG_INVALID'); expect(error.result.steps).toHaveLength(0);
  expect(error.message + JSON.stringify(error.result)).not.toContain('CANARY');
});
test('forms reports omit correction values, expected text, DOM IDs and unexpected errors', async ({ page }, info) => {
  const options = { values: ['CANARY_value', 'CANARY_second'] };
  await page.setContent(formHtml(options)); const contract = formContract(page, options);
  const errors = contract.errors.map((e, i) => i ? e : { ...e, expectedText: /CANARY_expected/,
    message: { id: 'error-0', locator: page.locator('#CANARY_dom') } });
  // Rename the message after the application has rendered its invalid state.
  await page.locator('form').evaluate(el => { el.addEventListener('submit', () => {
    const message = document.querySelector('#error-0') as HTMLElement; message.id = 'CANARY_dom'; message.hidden = false; message.textContent = 'CANARY_actual';
  }); });
  const error = await failure(page, info, { ...contract, errors });
  expect(error.code).toBe('TEXT_MISMATCH'); expect(error.message + JSON.stringify(error.result)).not.toContain('CANARY');
});
test('forms own successful report omits text that was actually entered', async ({ page }, info) => {
  const options = { values: ['CANARY_value', 'CANARY_second'] };
  await page.setContent(formHtml(options)); const result = await assertFormErrorsJourney(page, info, formContract(page, options));
  verify(result, info); expect(JSON.stringify(result)).not.toContain('CANARY');
});
test('forms stop on ambiguous targets before submitting', async ({ page }, info) => {
  await page.setContent(formHtml()); const contract = formContract(page);
  const error = await failure(page, info, { ...contract, form: { id: 'form', locator: page.locator('button') } });
  expect(error.code).toBe('TARGET_AMBIGUOUS'); expect(error.result.steps).toHaveLength(0);
});
test('forms already focused submit records entry without extra Tab', async ({ page }, info) => {
  await page.setContent(formHtml()); await page.locator('#submit').focus();
  const result = await assertFormErrorsJourney(page, info, formContract(page)); verify(result, info);
  expect(result.coverage.entryEvidence).toBe('already_focused'); expect(result.steps[0]?.key).toBe('Enter');
});
test('forms preserve the detected defect when attachment writing fails', async ({ page }, info) => {
  await page.setContent(formHtml({ defect: 'empty-text' })); const attach = info.attach.bind(info);
  info.attach = async (...args) => { await attach(...args); throw new Error('CANARY_write'); };
  const error = await failure(page, info, formContract(page));
  expect(error.code).toBe('REPORT_WRITE_FAILED'); expect(error.result.checks.find(c => c.status === 'fail')?.messageCode).toBe('TEXT_MISMATCH');
  expect(error.message).not.toContain('CANARY');
});

test('forms can correct declared fields in a different order', async ({ page }, info) => {
  await page.setContent(formHtml()); const contract = formContract(page);
  verify(await assertFormErrorsJourney(page, info, { ...contract, correction: [...contract.correction].reverse() }), info);
});
test('forms closed page attaches a blocked result', async ({ page }, info) => {
  const contract = formContract(page); await page.close(); const error = await failure(page, info, contract);
  expect(error.code).toBe('PAGE_CLOSED'); expect(error.result.steps).toHaveLength(0);
});
test('forms foreign-page target blocks before any keyboard action', async ({ page, context }, info) => {
  await page.setContent(formHtml()); const other = await context.newPage(); const contract = formContract(page);
  const error = await failure(page, info, { ...contract, form: { id: 'form', locator: other.locator('form') } });
  expect(error.code).toBe('UNSUPPORTED_CONTEXT'); expect(error.result.steps).toHaveLength(0); await other.close();
});
test('forms shadow target blocks before any keyboard action', async ({ page }, info) => {
  await page.setContent(formHtml()); await page.locator('form').evaluate(el => {
    const host = document.createElement('div'); el.replaceWith(host); host.attachShadow({ mode: 'open' }).append(el);
  });
  const error = await failure(page, info, formContract(page));
  expect(error.code).toBe('UNSUPPORTED_CONTEXT'); expect(error.result.steps).toHaveLength(0);
});
test('forms missing messages fail without typing corrections', async ({ page }, info) => {
  await page.setContent(formHtml()); const contract = formContract(page);
  const errors = contract.errors.map((e, i) => i ? e : { ...e, message: { id: 'error-0', locator: page.locator('#missing') } });
  const error = await failure(page, info, { ...contract, errors });
  expect(error.code).toBe('TEXT_MISMATCH'); expect(error.result.steps.some(s => s.actionKind === 'insertText')).toBe(false);
});
test('forms browser errors do not leak inserted values or underlying errors', async ({ page }, info) => {
  const options = { values: ['CANARY_value', 'CANARY_other'] }; await page.setContent(formHtml(options));
  page.keyboard.insertText = async () => { throw new Error('CANARY_browser'); };
  const error = await failure(page, info, formContract(page, options));
  expect(error.code).toBe('BROWSER_ERROR'); expect(error.message + JSON.stringify(error.result)).not.toContain('CANARY');
  expect(error.result.checks.find(c => c.status === 'blocked')?.checkId).toBe('F06.field.001.value');
});
test('forms scenario budget stops waiting without further actions', async ({ page }, info) => {
  await page.setContent(formHtml({ defect: 'empty-text' }));
  const error = await failure(page, info, { ...formContract(page), scenarioTimeoutMs: 1000 });
  expect(error.code).toBe('SCENARIO_TIMEOUT'); expect(error.result.steps.some(s => s.actionKind === 'insertText')).toBe(false);
});

test('forms identify second message', async ({ page }, info) => {
  await page.setContent(formHtml()); const contract = formContract(page);
  const errors = contract.errors.map((e, i) => i === 1 ? { ...e, expectedText: 'A different expected message' } : e);
  const error = await failure(page, info, { ...contract, errors });
  expect(error.code).toBe('TEXT_MISMATCH');
  expect(error.result.checks.find(c => c.status === 'fail')?.checkId).toBe('F02.message.002');
  expect(error.result.checks.find(c => c.checkId === 'F02.message.001')?.status).toBe('not_run');
});
test('forms identify second uncleared error', async ({ page }, info) => {
  await page.setContent(formHtml({ defect: 'second-not-cleared' }));
  const error = await failure(page, info, formContract(page));
  expect(error.code).toBe('ERROR_NOT_CLEARED');
  expect(error.result.checks.find(c => c.status === 'fail')?.checkId).toBe('F06.clear.002');
  expect(error.result.checks.find(c => c.checkId === 'F06.clear.001')?.status).toBe('not_run');
});

test('forms pass native fragment summary links', async ({ page }, info) => {
  const options = { policy: 'summary' as const, mode: 'resubmit' as const, links: true, nativeLinks: true };
  await page.setContent(formHtml(options));
  const result = await assertFormErrorsJourney(page, info, formContract(page, options)); verify(result, info);
  expect(page.url()).toBe('about:blank#field-1');
  expect(result.checks.filter(c => c.ruleId === 'F05').every(c => c.status === 'pass')).toBe(true);
});
test('forms still block a real reload during a summary link', async ({ page }, info) => {
  const options = { policy: 'summary' as const, links: true, defect: 'reload-link' };
  await page.route('https://keytrail.test/form', route => route.fulfill({ contentType: 'text/html', body: formHtml(options) }));
  await page.goto('https://keytrail.test/form');
  const error = await failure(page, info, formContract(page, options));
  expect(error.code).toBe('NAVIGATION');
  expect(error.result.checks.find(c => c.status === 'blocked')?.checkId).toBe('F05.link.001.focus');
  expect(error.result.steps.some(s => s.actionKind === 'insertText')).toBe(false);
});
