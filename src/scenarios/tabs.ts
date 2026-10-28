import { createHash, randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { test, type Page, type TestInfo } from '@playwright/test';
import playwrightPackage from '@playwright/test/package.json' with { type: 'json' };
import { DEFAULTS } from '../contracts/common.js';
import { validateTabs } from '../contracts/tabs.js';
import type { CheckResult, JourneyResult, MessageCode, SafeObservation, TabsContract } from '../contracts/types.js';
import { planTabs } from '../engine/tabs-plan.js';
import { Blocked, BoundaryExit, Driver, type Snapshot } from '../browser/driver.js';
import { coverage, outcome, JourneyAssertionError } from '../reporting/result.js';
import { serializeJourneyResult } from '../reporting/serialize.js';
import { PACKAGE_VERSION, RULESET_VERSION } from '../version.js';

class Stop extends Error {}
type Reading = { ok: boolean; observed: SafeObservation };
export async function assertTabsJourney(page: Page, info: TestInfo, input: TabsContract): Promise<JourneyResult> {
  const started = performance.now();
  let valid: ReturnType<typeof validateTabs> = null;
  try { valid = validateTabs(input); } catch { /* Do not serialize invalid input. */ }
  const plan = valid ? planTabs(valid.contract) : { checks: [{ checkId: 'E_CONFIG', ruleId: 'E_CONFIG',
    stepId: null, status: 'blocked', messageCode: 'CONFIG_INVALID', expected: {}, observed: {}, basis: 'contract' } as CheckResult], transitions: [] };
  const result: JourneyResult = {
    schemaVersion: '1', rulesetVersion: RULESET_VERSION, packageVersion: PACKAGE_VERSION,
    run: { runId: randomUUID(), testRef: createHash('sha256').update(info.testId).digest('hex'), attempt: info.retry,
      startedAt: new Date().toISOString(), durationMs: 0, nodeVersion: process.versions.node,
      playwrightVersion: playwrightPackage.version, browserVersion: page.context().browser()?.version() ?? 'unknown' },
    scenario: { id: valid?.contract.id ?? 'invalid-contract', kind: 'tabs', contractVersion: valid?.contract.contractVersion ?? '1' },
    config: valid?.config ?? { ...DEFAULTS }, outcome: 'blocked', coverage: coverage(plan.checks, 'unreached'),
    checks: plan.checks, steps: [], limitations: [
      'Chromium; main document; LTR; fixed tabs and panels; roving tabindex; no disabled tabs or aria-activedescendant.',
      'Manual activation is checked only at observed states within the recorded observation window, not continuously.',
      'No screen-reader, pointer, scroll, perpendicular-arrow or WCAG-conformance check.',
      'No application state restoration. Browser calls are cooperative; the Playwright test timeout is the hard stop.',
      'Own JSON excludes DOM IDs, text and selectors; external Playwright artifacts may contain page data.',
    ],
  };
  let driver: Driver | undefined, current = plan.checks[0]!;
  try {
    if (valid) {
      const { contract, config, targets } = valid;
      driver = new Driver(page, targets, contract.tablist, config, started, contract);
      const d = driver;
      result.steps = d.steps;
      const checks = new Map(plan.checks.map(check => [check.checkId, check]));
      let structureEstablished = false;
      const select = (id: string) => { current = checks.get(id)!; current.stepId = d.steps.at(-1)?.stepId ?? null; return current; };
      const finish = (id: string, reading: Reading, code: MessageCode) => {
        const check = select(id);
        check.status = reading.ok ? 'pass' : 'fail'; check.messageCode = reading.ok ? 'OK' : code;
        check.observed = reading.observed;
      };
      const structure = (state: Snapshot) => {
        if (structureEstablished && !state.tabs!.structure) throw new Blocked('UNSUPPORTED_TABS');
      };
      const observe = async (id: string, code: MessageCode, read: (s: Snapshot) => Reading, inspect?: (s: Snapshot) => void) => {
        select(id);
        const deadline = performance.now() + d.remaining();
        while (true) {
          const state = await d.snapshot(); structure(state); inspect?.(state);
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
      const selection = (state: Snapshot, index: number): Reading => {
        const tabs = state.tabs!, item = contract.items[index]!;
        return { ok: tabs.selectionValid && tabs.selected.length === 1 && tabs.selected[0] === item.tab.id &&
          tabs.visiblePanels.length === 1 && tabs.visiblePanels[0] === item.panel.id,
          observed: { selected: tabs.selected.length === 1 ? tabs.selected[0]! : 'unknown',
            selectedCount: tabs.selected.length, visibleCount: tabs.visiblePanels.length } };
      };
      const consistent = (state: Snapshot, index: number): Reading => {
        const reading = selection(state, index);
        return { ok: reading.ok && state.tabs!.roving && state.focused.has(contract.items[index]!.tab.id),
          observed: { ...reading.observed, roving: state.tabs!.roving, focus: state.focus } };
      };
      let selected = contract.items.findIndex(item => item.tab.id === contract.initialTabId);
      const initial = selected;
      await test.step('KeyTrail T01 entry', async () => {
        select('T01.entry');
        let state = await d.snapshot();
        if (state.focused.has(contract.initialTabId)) result.coverage.entryEvidence = 'already_focused';
        else {
          for (let n = 0; n < config.maxTabs && !state.focused.has(contract.initialTabId); n++) {
            state = await d.press('Tab', contract.items[initial]!.tab);
          }
          if (!state.focused.has(contract.initialTabId)) throw new Blocked('ENTRY_LIMIT');
          result.coverage.entryEvidence = 'tab';
        }
        finish('T01.entry', { ok: true, observed: { focus: contract.initialTabId } }, 'OK');
      });
      await test.step('KeyTrail T02 semantics and T06 initial state', async () => {
        await observe('T02.structure', 'STRUCTURE_MISMATCH', s => ({ ok: s.tabs!.structure, observed: { matched: s.tabs!.structure } }));
        structureEstablished = true;
        await observe('T02.role', 'ROLE_MISMATCH', s => ({ ok: s.tabs!.role, observed: { matched: s.tabs!.role } }));
        await observe('T02.name', 'NAME_MISSING', s => ({ ok: s.tabs!.named, observed: { hasAccessibleName: s.tabs!.named } }));
        await observe('T02.orientation', 'ORIENTATION_MISMATCH', s => ({ ok: s.tabs!.orientation, observed: { matched: s.tabs!.orientation } }));
        for (let index = 0; index < contract.items.length; index++) {
          const id = `T02.item.${String(index + 1).padStart(3, '0')}`;
          for (const [suffix, property, code] of [
            ['tab-role', 'tabRole', 'ROLE_MISMATCH'], ['panel-role', 'panelRole', 'ROLE_MISMATCH'],
            ['controls', 'controls', 'IDREF_MISMATCH'], ['labelledby', 'labelledby', 'IDREF_MISMATCH'],
          ] as const) await observe(`${id}.${suffix}`, code, s => ({ ok: s.tabs!.items[index]![property], observed: { matched: s.tabs!.items[index]![property] } }));
        }
        await observe('T06.initial', 'SELECTION_MISMATCH', s => consistent(s, initial));
      });
      for (const transition of plan.transitions) await test.step(`KeyTrail ${transition.focusCheck}`, async () => {
        const unchanged = `T05.${transition.suffix}.unchanged`;
        const inspect = (state: Snapshot) => {
          structure(state);
          if (contract.activation === 'manual' && !selection(state, selected).ok) {
            finish(unchanged, selection(state, selected), 'PREMATURE_ACTIVATION'); throw new Stop();
          }
        };
        const inspectFocused = (state: Snapshot) => {
          inspect(state);
          if (contract.activation === 'manual' && !state.focused.has(transition.target.id)) {
            finish(unchanged, { ok: false, observed: { ...selection(state, selected).observed,
              roving: state.tabs!.roving, focus: state.focus } }, 'FOCUS_MISMATCH');
            throw new Stop();
          }
        };
        const ready = (state: Snapshot) => {
          inspectFocused(state);
          if (!state.tabs!.roving) {
            finish(unchanged, { ok: false, observed: { ...selection(state, selected).observed,
              roving: false, focus: state.focus } }, 'ROVING_MISMATCH');
            throw new Stop();
          }
        };
        select(transition.focusCheck);
        let state: Snapshot;
        try { state = await d.press(transition.key, transition.target, true); }
        catch (error) {
          if (!(error instanceof BoundaryExit)) throw error;
          finish(transition.focusCheck, { ok: false, observed: { inside: false } }, 'FOCUS_MISMATCH'); throw new Stop();
        }
        inspect(state);
        await observe(transition.focusCheck, 'FOCUS_MISMATCH', s => ({ ok: s.focused.has(transition.target.id), observed: { focus: s.focus } }), inspect);
        await observe(`T06.${transition.suffix}.roving`, 'ROVING_MISMATCH', s => ({ ok: s.tabs!.roving, observed: { roving: s.tabs!.roving } }), inspectFocused);
        if (contract.activation === 'manual') {
          select(unchanged);
          const windowStarted = performance.now();
          const deadline = windowStarted + config.observationWindowMs;
          const step = d.steps.at(-1)!;
          try {
            while (true) {
              state = await d.snapshot(); ready(state); d.guard();
              if (performance.now() >= deadline) break;
              await delay(Math.max(1, Math.min(20, deadline - performance.now(), d.remaining())));
            }
            finish(unchanged, { ...selection(state, selected), observed: { ...selection(state, selected).observed,
              focus: state.focus, roving: state.tabs!.roving, observationWindowMs: performance.now() - windowStarted } }, 'PREMATURE_ACTIVATION');
          } finally { step.observationWindowMs = performance.now() - windowStarted; }
          select(`T05.${transition.suffix}.activated`);
          try { state = await d.press(contract.activationKey, transition.target, true, ready); }
          catch (error) {
            if (!(error instanceof BoundaryExit)) throw error;
            finish(current.checkId, { ok: false, observed: { inside: false } }, 'FOCUS_MISMATCH'); throw new Stop();
          }
          structure(state);
        }
        const activated = `${contract.activation === 'manual' ? 'T05' : 'T04'}.${transition.suffix}.activated`;
        await observe(activated, 'SELECTION_MISMATCH', s => selection(s, transition.index));
        await observe(`T06.${transition.suffix}.state`, 'SELECTION_MISMATCH', s => consistent(s, transition.index));
        selected = transition.index;
      });
      await test.step('KeyTrail T07 exit from the initial panel', async () => {
        await observe('T06.final', 'SELECTION_MISMATCH', s => consistent(s, initial));
        select('T07.exit');
        try { await d.press('Tab', contract.nextTabStop, true); }
        catch (error) {
          if (!(error instanceof BoundaryExit)) throw error;
          finish('T07.exit', { ok: false, observed: { inside: false } }, 'FOCUS_MISMATCH'); throw new Stop();
        }
        await observe('T07.exit', 'FOCUS_MISMATCH', s => ({ ok: s.focused.has(contract.nextTabStop.id) && !s.inside,
          observed: { focus: s.focus, inside: s.inside } }));
      });
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
    try { await info.attach('journey-result.json', { body: serializeJourneyResult(result), contentType: 'application/json' }); }
    catch { throw new JourneyAssertionError('REPORT_WRITE_FAILED', result); }
  }
  if (result.outcome !== 'passed') throw new JourneyAssertionError(plan.checks.find(c => c.status === 'fail' || c.status === 'blocked')?.messageCode ?? 'BROWSER_ERROR', result);
  return result;
}
