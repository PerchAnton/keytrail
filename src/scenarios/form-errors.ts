import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { test, type Page, type TestInfo } from '@playwright/test';
import playwrightPackage from '@playwright/test/package.json' with { type: 'json' };
import { DEFAULTS } from '../contracts/common.js';
import { validateFormErrors } from '../contracts/form-errors.js';
import type { CheckResult, JourneyResult, MessageCode, SafeObservation, FormErrorsContract, Target } from '../contracts/types.js';
import { ordinal, planFormErrors } from '../engine/form-errors-plan.js';
import { Blocked, Driver, type Snapshot } from '../browser/driver.js';
import { coverage, outcome, JourneyAssertionError } from '../reporting/result.js';
import { PACKAGE_VERSION, RULESET_VERSION } from '../version.js';

class Stop extends Error {}
type Reading = { ok: boolean; observed: SafeObservation };
export async function assertFormErrorsJourney(page: Page, info: TestInfo, input: FormErrorsContract): Promise<JourneyResult> {
  const started = performance.now();
  let valid: ReturnType<typeof validateFormErrors> = null;
  try { valid = validateFormErrors(input); } catch { /* Do not serialize invalid input. */ }
  const plan = valid ? { checks: planFormErrors(valid.contract) } : { checks: [{ checkId: 'E_CONFIG', ruleId: 'E_CONFIG',
    stepId: null, status: 'blocked', messageCode: 'CONFIG_INVALID', expected: {}, observed: {}, basis: 'contract' } as CheckResult] };
  const result: JourneyResult = {
    schemaVersion: '1', rulesetVersion: RULESET_VERSION, packageVersion: PACKAGE_VERSION,
    run: { runId: randomUUID(), testRef: createHash('sha256').update(info.testId).digest('hex'), attempt: info.retry,
      startedAt: new Date().toISOString(), durationMs: 0, nodeVersion: process.versions.node,
      playwrightVersion: playwrightPackage.version, browserVersion: page.context().browser()?.version() ?? 'unknown' },
    scenario: { id: valid?.contract.id ?? 'invalid-contract', kind: 'formErrors', contractVersion: valid?.contract.contractVersion ?? '1' },
    config: valid?.config ?? { ...DEFAULTS }, outcome: 'blocked', coverage: coverage(plan.checks, 'unreached'),
    checks: plan.checks, steps: [], limitations: [
      'Chromium; main document; novalidate form; native text inputs and textarea; at most 20 declared fields.',
      'Correction uses select-all and keyboard.insertText, or Backspace for an empty value; no IME or per-character key-event check.',
      'Fragment changes are allowed only during declared summary-link activation with verified Document identity.',
      'Only declared errors are checked. Clearing them does not prove server persistence, success announcements or WCAG conformance.',
      'Use synthetic values and mock network requests in test setup. No application state restoration.',
      'Browser calls are cooperative; the Playwright test timeout is the hard stop.',
      'Own JSON excludes values, error text and selectors; external Playwright artifacts may contain them.',
    ],
  };
  let driver: Driver | undefined, current = plan.checks[0]!;
  try {
    if (valid) {
      const { contract, config, targets } = valid;
      driver = new Driver(page, targets, contract.form, config, started, undefined, contract);
      const d = driver;
      result.steps = d.steps;
      const checks = new Map(plan.checks.map(check => [check.checkId, check]));
      let structureEstablished = false;
      const select = (id: string) => { current = checks.get(id)!; current.stepId = d.steps.at(-1)?.stepId ?? null; return current; };
      const finish = (id: string, reading: Reading, code: MessageCode) => {
        const check = select(id); check.status = reading.ok ? 'pass' : 'fail';
        check.messageCode = reading.ok ? 'OK' : code; check.observed = reading.observed;
      };
      const structure = (state: Snapshot) => {
        if (structureEstablished && !state.form!.structure) throw new Blocked('UNSUPPORTED_FORM');
      };
      const observe = async (id: string, code: MessageCode, read: (state: Snapshot) => Reading) => {
        select(id); const deadline = performance.now() + d.remaining();
        while (true) {
          const state = await d.snapshot(); structure(state);
          const reading = read(state); d.guard();
          if (reading.ok || performance.now() >= deadline) {
            const inTime = performance.now() <= deadline;
            finish(id, { ...reading, ok: reading.ok && inTime }, reading.ok ? 'EXPECTATION_TIMEOUT' : code);
            if (!reading.ok || !inTime) throw new Stop();
            return;
          }
          await delay(Math.max(1, Math.min(20, deadline - performance.now(), d.remaining())));
        }
      };
      const focus = (state: Snapshot, target: Target) => ({ ok: state.focused.has(target.id), observed: { focus: state.focus } });
      const requireFocus = (id: string, target: Target) => (state: Snapshot) => {
        structure(state);
        const reading = focus(state, target);
        if (!reading.ok) { finish(id, reading, 'FOCUS_MISMATCH'); throw new Stop(); }
      };
      const reach = async (id: string, target: Target, entry = false) => {
        select(id); let state = await d.snapshot(); structure(state);
        const already = state.focused.has(target.id);
        for (let n = 0; n < config.maxTabs && !state.focused.has(target.id); n++) {
          state = await d.press('Tab', target, false, structure); structure(state);
        }
        if (!state.focused.has(target.id)) throw new Blocked('ENTRY_LIMIT');
        if (entry) result.coverage.entryEvidence = already ? 'already_focused' : 'tab';
        finish(id, focus(state, target), 'FOCUS_MISMATCH');
      };
      // Every message in a phase must be valid in the same observation.
      const messages = async (clear: boolean) => {
        const ids = contract.errors.map((_, i) => `${clear ? 'F06.clear' : 'F02.message'}.${ordinal(i)}`);
        select(ids[0]!); const deadline = performance.now() + d.remaining();
        while (true) {
          const state = await d.snapshot(); structure(state); d.guard();
          const readings = state.form!.errors.map(e => clear ?
            { ok: e.cleared, observed: { visible: e.visible, invalid: !e.invalidCleared } } :
            { ok: e.visible && e.textMatches, observed: { visible: e.visible, matched: e.textMatches } });
          const mismatch = readings.findIndex(r => !r.ok);
          if (mismatch === -1 || performance.now() >= deadline) {
            const inTime = performance.now() <= deadline;
            if (mismatch !== -1) {
              finish(ids[mismatch]!, readings[mismatch]!, clear ? 'ERROR_NOT_CLEARED' : 'TEXT_MISMATCH');
              throw new Stop();
            }
            for (let i = 0; i < readings.length; i++) {
              const reading = readings[i]!;
              finish(ids[i]!, { ...reading, ok: inTime }, 'EXPECTATION_TIMEOUT');
              if (!inTime) throw new Stop();
            }
            return;
          }
          await delay(Math.max(1, Math.min(20, deadline - performance.now(), d.remaining())));
        }
      };
      await test.step('KeyTrail F01 invalid submit', async () => {
        await observe('F01.structure', 'STRUCTURE_MISMATCH', s => ({ ok: s.form!.structure, observed: { matched: s.form!.structure } }));
        structureEstablished = true;
        await reach('F01.entry', contract.submit, true);
        select('F01.submit');
        await d.press(contract.submitKey, contract.submit, false, requireFocus('F01.submit', contract.submit));
        finish('F01.submit', { ok: true, observed: { matched: true } }, 'OK');
      });
      await test.step('KeyTrail F02 messages and F03 relationships', async () => {
        await messages(false);
        for (let i = 0; i < contract.errors.length; i++) {
          await observe(`F03.field.${ordinal(i)}.invalid`, 'INVALID_STATE_MISMATCH', s => ({
            ok: s.form!.errors[i]!.invalid, observed: { invalid: s.form!.errors[i]!.invalid } }));
          await observe(`F03.field.${ordinal(i)}.idref`, 'IDREF_MISMATCH', s => ({
            ok: s.form!.errors[i]!.idref, observed: { matched: s.form!.errors[i]!.idref } }));
        }
      });
      await test.step('KeyTrail F04 focus policy', async () => {
        await observe('F04.focus', 'FOCUS_MISMATCH', s => focus(s, contract.focusAfterInvalid.target));
      });
      for (let i = 0; i < (contract.summaryLinks?.length ?? 0); i++) await test.step(`KeyTrail F05 link ${ordinal(i)}`, async () => {
        const link = contract.summaryLinks![i]!, id = `F05.link.${ordinal(i)}`;
        await reach(`${id}.entry`, link.link);
        select(`${id}.focus`);
        await d.followSummaryLink(link.link, state => {
          requireFocus(`${id}.focus`, link.link)(state);
          if (!state.form!.links[i]) { finish(`${id}.focus`, { ok: false, observed: { matched: false } }, 'ROLE_MISMATCH'); throw new Stop(); }
        });
        await observe(`${id}.focus`, 'FOCUS_MISMATCH', s => focus(s, link.field));
      });
      for (let i = 0; i < contract.correction.length; i++) await test.step(`KeyTrail F06 correction ${ordinal(i)}`, async () => {
        const item = contract.correction[i]!, id = `F06.field.${ordinal(i)}`;
        const errorIndex = contract.errors.findIndex(e => e.field === item.field);
        await reach(`${id}.entry`, item.field); select(`${id}.value`);
        const editable = (state: Snapshot) => {
          requireFocus(`${id}.value`, item.field)(state);
          if (!state.form!.errors[errorIndex]!.editable) throw new Blocked('NOT_EDITABLE');
        };
        await d.press('ControlOrMeta+A', item.field, false, editable);
        if (item.value === '') await d.press('Backspace', item.field, false, editable);
        else await d.insertText(item.value, item.field, editable);
        await observe(`${id}.value`, 'VALUE_MISMATCH', s => ({
          ok: s.form!.errors[errorIndex]!.valueMatches, observed: { editable: s.form!.errors[errorIndex]!.editable,
            matched: s.form!.errors[errorIndex]!.valueMatches } }));
        if (contract.validateCorrection === 'live') {
          select(`${id}.blur`);
          await d.press('Tab', null, false, requireFocus(`${id}.blur`, item.field));
          await observe(`${id}.blur`, 'FOCUS_MISMATCH', s => ({ ok: !s.focused.has(item.field.id), observed: { matched: !s.focused.has(item.field.id) } }));
        }
      });
      if (contract.validateCorrection === 'resubmit') await test.step('KeyTrail F06 resubmit', async () => {
        await reach('F06.resubmit.entry', contract.submit); select('F06.resubmit');
        await d.press(contract.submitKey, contract.submit, false, requireFocus('F06.resubmit', contract.submit));
        finish('F06.resubmit', { ok: true, observed: { matched: true } }, 'OK');
      });
      await test.step('KeyTrail F06 cleared errors', async () => { await messages(true); });
    }
  } catch (error) {
    if (!(error instanceof Stop)) {
      const reason = driver?.normalize(error) ?? new Blocked('BROWSER_ERROR');
      if (current.status === 'not_run') {
        current.status = reason.code === 'EXPECTATION_TIMEOUT' ? 'fail' : 'blocked'; current.messageCode = reason.code;
        current.stepId = driver?.steps.at(-1)?.stepId ?? null;
      }
    }
  } finally {
    await driver?.dispose();
    const first = plan.checks.find(c => c.status === 'fail' || c.status === 'blocked');
    for (const check of plan.checks) if (check.status === 'not_run') check.blockedBy = first?.checkId ?? 'E_ABORTED';
    result.coverage = coverage(plan.checks, result.coverage.entryEvidence); result.outcome = outcome(result.coverage);
    result.run.durationMs = performance.now() - started;
    try { await info.attach('journey-result.json', { body: Buffer.from(JSON.stringify(result)), contentType: 'application/json' }); }
    catch { throw new JourneyAssertionError('REPORT_WRITE_FAILED', result); }
  }
  if (result.outcome !== 'passed') throw new JourneyAssertionError(plan.checks.find(c => c.status === 'fail' || c.status === 'blocked')?.messageCode ?? 'BROWSER_ERROR', result);
  return result;
}
