import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { test, type Page, type TestInfo } from '@playwright/test';
import playwrightPackage from '@playwright/test/package.json' with { type: 'json' };
import { DEFAULTS, validateDialog } from '../contracts/dialog.js';
import type { CheckResult, DialogContract, JourneyResult, MessageCode, SafeObservation } from '../contracts/types.js';
import { planDialog } from '../engine/plan.js';
import { Blocked, BoundaryExit, Driver, type Snapshot } from '../browser/driver.js';
import { coverage, outcome, JourneyAssertionError } from '../reporting/result.js';
import { serializeJourneyResult } from '../reporting/serialize.js';
import { PACKAGE_VERSION, RULESET_VERSION } from '../version.js';

const limitations = [
  'This assertion checks the declared dialog journey only; use the CI guard to require complete reports.',
  'Chromium; main document; one custom ARIA dialog; no iframe, Shadow DOM, native or nested dialogs.',
  'Checks only observed focus states, not transient focus, pointer blocking or screen-reader behavior.',
  'No WCAG certification, automated repair or application state restoration.',
  'Own JSON and messages exclude page text and selectors; Playwright artifacts may contain them.',
  'Browser calls are cooperatively bounded; the Playwright test timeout remains the hard stop.',
];
class Stop extends Error {}

export async function assertDialogJourney(page: Page, testInfo: TestInfo, input: DialogContract): Promise<JourneyResult> {
  const started = performance.now();
  const startedAt = new Date().toISOString();
  let valid: ReturnType<typeof validateDialog> = null;
  try { valid = validateDialog(input); } catch { /* Invalid configuration is never serialized. */ }
  const plan = valid ? planDialog(valid.contract) : { checks: [{ checkId: 'E_CONFIG', ruleId: 'E_CONFIG',
    stepId: null, status: 'blocked', messageCode: 'CONFIG_INVALID', expected: {}, observed: {}, basis: 'contract' } as CheckResult], transitions: [] };
  const result: JourneyResult = {
    schemaVersion: '1', rulesetVersion: RULESET_VERSION, packageVersion: PACKAGE_VERSION,
    run: { runId: randomUUID(), testRef: createHash('sha256').update(testInfo.testId).digest('hex'),
      attempt: testInfo.retry, startedAt, durationMs: 0, nodeVersion: process.versions.node,
      playwrightVersion: playwrightPackage.version, browserVersion: page.context().browser()?.version() ?? 'unknown' },
    scenario: { id: valid?.contract.id ?? 'invalid-contract', kind: 'dialog', contractVersion: valid?.contract.contractVersion ?? '1' },
    config: valid?.config ?? { ...DEFAULTS }, outcome: 'blocked',
    coverage: coverage(plan.checks, 'unreached'), checks: plan.checks, steps: [], limitations: [...limitations],
  };
  let driver: Driver | undefined;
  let current = plan.checks[0]!;
  try {
    if (valid) {
      const { contract, config, targets } = valid;
      driver = new Driver(page, targets, contract.dialog, config, started);
      const d = driver;
      result.steps = d.steps;
      const select = (id: string) => {
        current = plan.checks.find(c => c.checkId === id)!;
        current.stepId = d.steps.at(-1)?.stepId ?? null;
        return current;
      };
      const finish = (check: CheckResult, ok: boolean, observed: SafeObservation, code: MessageCode) => {
        check.status = ok ? 'pass' : 'fail'; check.messageCode = ok ? 'OK' : code; check.observed = observed;
      };
      const observe = async (id: string, code: MessageCode, read: (s: Snapshot) => Promise<{ ok: boolean; observed: SafeObservation }>, checkBoundary?: (s: Snapshot) => void) => {
        const check = select(id);
        const deadline = performance.now() + d.remaining();
        while (true) {
          d.guard();
          const state = await d.snapshot();
          checkBoundary?.(state);
          const observed = await read(state);
          d.guard();
          if (observed.ok || performance.now() >= deadline) {
            const inTime = performance.now() <= deadline;
            finish(check, observed.ok && inTime, observed.observed, observed.ok ? 'EXPECTATION_TIMEOUT' : code);
            if (!observed.ok || !inTime) throw new Stop();
            return;
          }
          await delay(Math.max(1, Math.min(20, deadline - performance.now(), d.remaining())));
        }
      };
      const observeInside = async (id: string) => {
        const check = select(id);
        const state = await d.snapshot();
        finish(check, state.inside, { inside: state.inside }, 'FOCUS_OUTSIDE_DIALOG');
        if (!state.inside) throw new Stop();
      };
      await test.step('KeyTrail D01 entry and activation', async () => {
        select('D01.entry');
        let state = await d.snapshot();
        if (state.focused.has(contract.trigger.id)) result.coverage.entryEvidence = 'already_focused';
        else {
          for (let n = 0; n < config.maxTabs && !state.focused.has(contract.trigger.id); n++) {
            await d.press('Tab', contract.trigger);
            state = await d.snapshot();
          }
          if (!state.focused.has(contract.trigger.id)) throw new Blocked('ENTRY_LIMIT');
          result.coverage.entryEvidence = 'tab';
        }
        await d.press(contract.openKey, contract.trigger);
        current.stepId = d.steps.at(-1)!.stepId;
        finish(current, true, { focus: contract.trigger.id }, 'OK');
      });
      await test.step('KeyTrail D02 semantics and D03 initial focus', async () => {
        await observe('D02.visible', 'EXPECTATION_TIMEOUT', async s => {
          const visible = s.present.has(contract.dialog.id) && await contract.dialog.locator.isVisible();
          return { ok: visible, observed: { visible } };
        });
        await observe('D02.role', 'ROLE_MISMATCH', async () => {
          const matched = await contract.dialog.locator.and(page.getByRole('dialog')).count() === 1;
          return { ok: matched, observed: { matched } };
        });
        await observe('D02.name', 'NAME_MISSING', async () => {
          const hasAccessibleName = await contract.dialog.locator.and(page.getByRole('dialog', { name: /\S/ })).count() === 1;
          return { ok: hasAccessibleName, observed: { hasAccessibleName } };
        });
        await observe('D02.modal', 'MODAL_MISMATCH', async () => {
          const modal = await contract.dialog.locator.getAttribute('aria-modal', { timeout: d.remaining() }) === 'true';
          return { ok: modal, observed: { modal } };
        });
        await observe('D03.initial', 'FOCUS_MISMATCH', async s => ({ ok: s.focused.has(contract.initialFocus.id), observed: { focus: s.focus } }));
        await observeInside('D05.initial');
      });
      for (const transition of plan.transitions) {
        await test.step(`KeyTrail D04 ${transition.direction} ${transition.index + 1}`, async () => {
          select(transition.focusCheck);
          const boundary = (state: Snapshot) => {
            if (state.inside) return;
            finish(select(transition.focusCheck), state.focused.has(transition.target.id), { focus: state.focus }, 'FOCUS_MISMATCH');
            finish(select(transition.boundaryCheck), false, { inside: false }, 'FOCUS_OUTSIDE_DIALOG');
            throw new Stop();
          };
          try {
            const state = await d.press(transition.direction === 'forward' ? 'Tab' : 'Shift+Tab', transition.target, true);
            boundary(state);
          } catch (error) {
            if (!(error instanceof BoundaryExit)) throw error;
            finish(select(transition.boundaryCheck), false, { inside: false }, 'FOCUS_OUTSIDE_DIALOG');
            throw new Stop();
          }
          try {
            await observe(transition.focusCheck, 'FOCUS_MISMATCH', async s => ({ ok: s.focused.has(transition.target.id), observed: { focus: s.focus } }), boundary);
          } catch (error) {
            if (!(error instanceof Stop)) throw error;
            if (plan.checks.find(c => c.checkId === transition.boundaryCheck)!.status !== 'not_run') throw error;
            // Containment is an independent observation of this same failed transition.
            const state = await d.snapshot();
            finish(select(transition.boundaryCheck), state.inside, { inside: state.inside }, 'FOCUS_OUTSIDE_DIALOG');
            throw error;
          }
          await observeInside(transition.boundaryCheck);
        });
      }
      await test.step('KeyTrail D06 close and D07 return focus', async () => {
        await observeInside('D05.before-close');
        select('D06.closed');
        try { await d.press('Escape', contract.returnFocus, true); }
        catch (error) {
          if (!(error instanceof BoundaryExit)) throw error;
          finish(select('D05.before-close'), false, { inside: false }, 'FOCUS_OUTSIDE_DIALOG');
          throw new Stop();
        }
        await observe('D06.closed', 'EXPECTATION_TIMEOUT', async s => {
          const visible = s.present.has(contract.dialog.id) && await contract.dialog.locator.isVisible();
          return { ok: !visible, observed: { visible } };
        });
        await observe('D07.returned', 'FOCUS_MISMATCH', async s => ({ ok: s.focused.has(contract.returnFocus.id), observed: { focus: s.focus } }));
      });
    }
  } catch (error) {
    if (!(error instanceof Stop)) {
      const reason = driver?.normalize(error) ?? new Blocked('BROWSER_ERROR');
      // Keep an already recorded failure as the primary cause.
      if (current.status === 'not_run') {
        current.status = reason.code === 'EXPECTATION_TIMEOUT' ? 'fail' : 'blocked'; current.messageCode = reason.code;
        current.stepId = driver?.steps.at(-1)?.stepId ?? null;
      }
    }
  } finally {
    await driver?.dispose();
    const first = plan.checks.find(c => c.status === 'fail' || c.status === 'blocked');
    for (const check of plan.checks) if (check.status === 'not_run') check.blockedBy = first?.checkId ?? 'E_ABORTED';
    result.coverage = coverage(plan.checks, result.coverage.entryEvidence);
    result.outcome = outcome(result.coverage);
    result.run.durationMs = Math.max(0, performance.now() - started);
    try {
      await testInfo.attach('journey-result.json', { body: serializeJourneyResult(result), contentType: 'application/json' });
    } catch { throw new JourneyAssertionError('REPORT_WRITE_FAILED', result); }
  }
  if (result.outcome !== 'passed') {
    const first = plan.checks.find(c => c.status === 'fail' || c.status === 'blocked');
    throw new JourneyAssertionError(first?.messageCode ?? 'BROWSER_ERROR', result);
  }
  return result;
}
