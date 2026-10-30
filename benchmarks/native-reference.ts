import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import type { Page, TestInfo, ElementHandle, Frame } from '@playwright/test';
import type { JourneyResult, CheckResult, SafeObservation, MessageCode, StepResult } from '../src/contracts/types.js';
import schemaValid from '../artifacts/generated/schema-validator.cjs';
import pkg from '../package.json' with { type: 'json' };

export type Manifest = {
  kind: JourneyResult['scenario']['kind']; targets: { id: string; selector: string }[]; root: string;
  scenario: JourneyResult['scenario']; config: JourneyResult['config'];
  checks: Omit<CheckResult, 'status' | 'messageCode' | 'observed'>[];
  steps: Pick<StepResult, 'stepId' | 'actionKind' | 'key' | 'targetId'>[]; limitations: string[];
};
type Reading = { ok: boolean; observed: SafeObservation; code: MessageCode };
class NativeFailure extends Error {
  constructor(readonly code: MessageCode, readonly checkId?: string) { super(code); }
}

/** Fixture-specific reference. No KeyTrail driver, planner, assertion or serializer is called. */
export async function nativeJourney(page: Page, info: TestInfo, manifest: Manifest): Promise<JourneyResult> {
  const started = performance.now(), config = manifest.config;
  const checks: CheckResult[] = manifest.checks.map(check => ({ ...structuredClone(check),
    stepId: null, status: 'not_run', messageCode: 'NOT_RUN', observed: {} }));
  const result: JourneyResult = {
    schemaVersion: '1', rulesetVersion: '0.4.0', packageVersion: pkg.version,
    run: { runId: randomUUID(), testRef: createHash('sha256').update(info.testId).digest('hex'), attempt: info.retry,
      startedAt: new Date().toISOString(), durationMs: 0, nodeVersion: process.versions.node,
      playwrightVersion: '1.64.1', browserVersion: page.context().browser()!.version() },
    scenario: { ...manifest.scenario }, config: { ...config }, outcome: 'blocked',
    coverage: { planned: checks.length, passed: 0, failed: 0, blocked: 0, notRun: checks.length, complete: false, entryEvidence: 'unreached' },
    checks, steps: [], limitations: [...manifest.limitations],
  };
  let current = checks[0]!, interruption: MessageCode | undefined;
  const navigated = (frame: Frame) => { if (frame === page.mainFrame()) interruption = 'NAVIGATION'; };
  const popup = () => { interruption = 'POPUP'; };
  const closed = () => { interruption = 'PAGE_CLOSED'; };
  page.on('framenavigated', navigated); page.on('popup', popup); page.on('close', closed);
  const guard = () => {
    if (interruption) throw new NativeFailure(interruption);
    if (page.isClosed()) throw new NativeFailure('PAGE_CLOSED');
    if (performance.now() - started >= config.scenarioTimeoutMs) throw new NativeFailure('SCENARIO_TIMEOUT');
  };
  const remaining = () => { guard(); return Math.max(1, Math.min(config.timeoutMs, config.scenarioTimeoutMs - (performance.now() - started))); };
  const targets = manifest.targets.map(t => ({ id: t.id, locator: page.locator(t.selector) }));
  const capture = async (semantics = true) => {
    guard();
    const handles: ElementHandle[] = [];
    const resolve = async (locator: typeof targets[number]['locator']) => {
      if (locator.page() !== page) throw new NativeFailure('UNSUPPORTED_CONTEXT');
      const nodes = await locator.elementHandles(); handles.push(...nodes); return nodes;
    };
    try {
      // Wait for every read before releasing handles, even when one locator fails.
      const targetReads = Promise.allSettled(targets.map(async t => {
        const nodes = await resolve(t.locator);
        if (nodes.length > 1) throw new NativeFailure('TARGET_AMBIGUOUS');
        return { id: t.id, node: nodes[0] ?? null };
      }));
      const roles: Record<string, ElementHandle[]> = {};
      const roleQueries = [
        ['dialog', page.getByRole('dialog', { includeHidden: true })],
        ['alert', page.getByRole('alertdialog', { includeHidden: true })],
        ...(manifest.kind === 'tabs' ? [
          ['tab', page.getByRole('tab', { includeHidden: true })],
          ...(semantics ? [
            ['tablist', page.getByRole('tablist', { includeHidden: true })],
            ['named', page.getByRole('tablist', { name: /\S/, includeHidden: true })],
            ['tabpanel', page.getByRole('tabpanel', { includeHidden: true })],
          ] as const : []),
        ] as const : []),
      ] as const;
      const roleReads = Promise.allSettled(roleQueries.map(async ([name, locator]) => { roles[name] = await resolve(locator); }));
      const [reads, rolesRead] = await Promise.all([targetReads, roleReads]);
      const rejected = reads.find(r => r.status === 'rejected');
      if (rejected?.status === 'rejected') throw rejected.reason;
      const roleFailure = rolesRead.find(r => r.status === 'rejected');
      if (roleFailure?.status === 'rejected') throw roleFailure.reason;
      const nodes = reads.map(r => (r as PromiseFulfilledResult<{ id: string; node: ElementHandle | null }>).value);
      guard();
      const state = await page.evaluate(({ nodes, rootId, roles, kind, semantics }) => {
        const observedAt = performance.now();
        const elements = nodes.map(t => ({ id: t.id, node: t.node instanceof Element ? t.node : null }));
        const byId = new Map(elements.map(t => [t.id, t.node]));
        const root = byId.get(rootId), active = document.activeElement;
        const visible = (el: Node | null | undefined): el is Element => {
          if (!(el instanceof Element)) return false;
          const bounds = el.getBoundingClientRect(), visibility = getComputedStyle(el).visibility;
          return bounds.width > 0 && bounds.height > 0 && visibility !== 'hidden' && visibility !== 'collapse';
        };
        const present = elements.filter(t => t.node);
        let code = '';
        if (present.some(t => t.node!.getRootNode() !== document) || active?.shadowRoot || active?.tagName === 'IFRAME') code = 'UNSUPPORTED_CONTEXT';
        else if (present.some(t => !t.node!.isConnected)) code = 'EXPECTATION_TIMEOUT';
        else if (new Set(present.map(t => t.node)).size !== present.length) code = 'TARGET_ALIAS';
        const layers = new Set([...roles.dialog!, ...roles.alert!, ...document.querySelectorAll('dialog')].filter(visible));
        if (layers.size > 1 || [...layers].some(el => el.tagName === 'DIALOG' || roles.alert!.includes(el)) || present.some(t => t.node!.closest('dialog'))) code = 'UNSUPPORTED_DIALOG';
        const focus = present.find(t => t.node === active)?.id ?? (!active ? 'none' : active === document.body || active === document.documentElement ? 'body' : 'unknown');
        const selected = [0, 1, 2].filter(i => byId.get(`tab-${i}`)?.getAttribute('aria-selected') === 'true');
        const panels = [0, 1, 2].filter(i => visible(byId.get(`panel-${i}`)));
        const unique = (el: Element | null | undefined) => !!el?.id && [...document.querySelectorAll('[id]')].filter(e => e.id === el.id).length === 1;
        const tokens = (el: Element | null | undefined, name: string) => el?.getAttribute(name)?.trim().split(/\s+/).filter(Boolean) ?? [];
        const tabNodes = [0, 1, 2].map(i => byId.get(`tab-${i}`));
        const formRoot = byId.get('form'), submit = byId.get('submit');
        const form = [0, 1].map(i => {
          const field = byId.get(`field-${i}`), message = byId.get(`error-${i}`);
          const refs = tokens(field, 'aria-describedby'), invalid = field?.getAttribute('aria-invalid');
          return {
            structure: field instanceof HTMLInputElement && field.form === formRoot && !!formRoot?.contains(field),
            visible: visible(message), matched: (message instanceof HTMLElement ? message.innerText : '').trim().replace(/\s+/g, ' ') === `Enter a valid value ${i + 1}.`,
            invalid: invalid === 'true', idref: unique(message) && refs.includes(message!.id) && !refs.includes(`error-${1 - i}`),
            editable: field instanceof HTMLInputElement && visible(field) && !field.readOnly && !field.matches(':disabled') && field.getAttribute('aria-disabled') !== 'true' && !field.closest('[inert]'),
            value: field instanceof HTMLInputElement && field.value === ['sample-one', 'sample-two'][i],
            cleared: !!field && !visible(message) && (invalid === null || invalid === 'false'),
            invalidCleared: invalid === null || invalid === 'false',
          };
        });
        return { observedAt, code, focus, inside: !!root && !!active && root.contains(active), rootVisible: visible(root),
          dialogRole: !!root && roles.dialog!.includes(root), modal: root?.getAttribute('aria-modal') === 'true',
          selected, panels, selectionValid: tabNodes.every(el => ['true', 'false'].includes(el?.getAttribute('aria-selected') ?? '')),
          roving: tabNodes.includes(active) && tabNodes.every(el => el instanceof HTMLElement && el.tabIndex === (el === active ? 0 : -1)),
          tabStructure: !!root && tabNodes.every(el => !!el && root.contains(el)) && roles.tab?.filter(el => root.contains(el)).length === 3 && [0, 1, 2].every(i => !!byId.get(`panel-${i}`)),
          ...(semantics ? { listRole: !!root && !!roles.tablist?.includes(root), named: !!root && !!roles.named?.includes(root),
          orientation: root?.getAttribute('aria-orientation') === 'horizontal' || !root?.hasAttribute('aria-orientation'),
          items: [0, 1, 2].map(i => {
            const tab = byId.get(`tab-${i}`), panel = byId.get(`panel-${i}`);
            return { 'tab-role': !!tab && !!roles.tab?.includes(tab), 'panel-role': !!panel && !!roles.tabpanel?.includes(panel),
              controls: unique(panel) && tokens(tab, 'aria-controls').length === 1 && tokens(tab, 'aria-controls')[0] === panel?.id,
              labelledby: unique(tab) && tokens(panel, 'aria-labelledby').includes(tab!.id) };
          }),
          } : {}),
          formStructure: formRoot instanceof HTMLFormElement && formRoot.noValidate && submit instanceof HTMLButtonElement && submit.type === 'submit' && submit.form === formRoot && form.every(f => f.structure), form,
        };
      }, { nodes, rootId: manifest.root, roles, kind: manifest.kind, semantics }).catch(async error => {
        // Use the same context-check strategy in both arms; do not charge the
        // reference an unnecessary frame query for every healthy target read.
        guard();
        const frames = await Promise.allSettled(nodes.map(({ node }) => node ? node.ownerFrame() : null));
        guard();
        if (frames.some((frame, index) => nodes[index]!.node && frame.status === 'fulfilled' &&
            frame.value !== page.mainFrame())) throw new NativeFailure('UNSUPPORTED_CONTEXT');
        throw error;
      });
      guard();
      if (state.code) throw new NativeFailure(state.code as MessageCode);
      return state;
    } finally { await Promise.allSettled(handles.map(handle => handle.dispose())); }
  };
  type State = Awaited<ReturnType<typeof capture>>;
  const selection = (s: State, expected: string): Reading => ({
    ok: s.selectionValid && s.selected.length === 1 && `tab-${s.selected[0]}` === expected && s.panels.length === 1 && s.panels[0] === s.selected[0],
    observed: { selected: s.selected.length === 1 ? `tab-${s.selected[0]}` : 'unknown', selectedCount: s.selected.length, visibleCount: s.panels.length }, code: 'SELECTION_MISMATCH',
  });
  const read = async (check: CheckResult, s: State): Promise<Reading> => {
    const id = check.checkId, focus = (expected = check.expected.focus) => ({ ok: s.focus === expected, observed: { focus: s.focus }, code: 'FOCUS_MISMATCH' as const });
    const metadata = (value: boolean | undefined): boolean => {
      if (value === undefined) throw new NativeFailure('BROWSER_ERROR');
      return value;
    };
    const matched = (value: boolean | undefined, code: MessageCode) => ({ ok: metadata(value), observed: { matched: metadata(value) }, code });
    if (id === 'D01.entry') return { ok: result.steps.at(-1)?.beforeFocus === 'open', observed: { focus: result.steps.at(-1)!.beforeFocus }, code: 'ENTRY_LIMIT' };
    if (/^D0[347]\./.test(id) || id === 'T01.entry' || /^T03\./.test(id) || id === 'F01.entry' || id === 'F04.focus' || /^F06.field.\d+.entry$/.test(id)) return focus();
    if (id === 'D02.visible' || id === 'D06.closed') return { ok: s.rootVisible === check.expected.visible, observed: { visible: s.rootVisible }, code: 'EXPECTATION_TIMEOUT' };
    if (id === 'D02.role') return matched(s.dialogRole, 'ROLE_MISMATCH');
    if (id === 'D02.name') { const value = await page.locator('#dialog').and(page.getByRole('dialog', { name: /\S/ })).count() === 1; return { ok: value, observed: { hasAccessibleName: value }, code: 'NAME_MISSING' }; }
    if (id === 'D02.modal') return { ok: s.modal, observed: { modal: s.modal }, code: 'MODAL_MISMATCH' };
    if (id.startsWith('D05.')) return { ok: s.inside, observed: { inside: s.inside }, code: 'FOCUS_OUTSIDE_DIALOG' };
    if (id === 'T02.structure') return matched(s.tabStructure, 'STRUCTURE_MISMATCH');
    if (id === 'T02.role') return matched(s.listRole, 'ROLE_MISMATCH');
    if (id === 'T02.name') return { ok: metadata(s.named), observed: { hasAccessibleName: metadata(s.named) }, code: 'NAME_MISSING' };
    if (id === 'T02.orientation') return matched(s.orientation, 'ORIENTATION_MISMATCH');
    if (id.startsWith('T02.item.')) { const [, , n, property] = id.split('.'); return matched(s.items?.[Number(n) - 1]?.[property as keyof NonNullable<State['items']>[number]], property!.includes('role') ? 'ROLE_MISMATCH' : 'IDREF_MISMATCH'); }
    if (id.endsWith('.roving')) return { ok: s.roving, observed: { roving: s.roving }, code: 'ROVING_MISMATCH' };
    if (/^T0[456]\./.test(id)) {
      const r = selection(s, check.expected.selected!);
      if (id.endsWith('.activated')) return r;
      const desired = id.endsWith('.unchanged') ? manifest.steps.find(step => step.stepId === manifest.checks.find(c => c.checkId === id)!.stepId)!.targetId : check.expected.selected;
      return { ok: r.ok && s.roving && s.focus === desired, observed: { ...r.observed, roving: s.roving, focus: s.focus }, code: r.ok ? 'FOCUS_MISMATCH' : id.endsWith('.unchanged') ? 'PREMATURE_ACTIVATION' : 'SELECTION_MISMATCH' };
    }
    if (id === 'T07.exit') return { ok: s.focus === check.expected.focus && !s.inside, observed: { focus: s.focus, inside: s.inside }, code: 'FOCUS_MISMATCH' };
    if (id === 'F01.structure') return matched(s.formStructure, 'STRUCTURE_MISMATCH');
    if (id === 'F01.submit') return matched(result.steps.at(-1)?.beforeFocus === 'submit', 'FOCUS_MISMATCH');
    const n = Number(id.split('.').find(p => /^\d{3}$/.test(p))) - 1, field = s.form[n];
    if (id.startsWith('F02.message.')) return { ok: field!.visible && field!.matched, observed: { visible: field!.visible, matched: field!.matched }, code: field!.visible ? 'TEXT_MISMATCH' : 'EXPECTATION_TIMEOUT' };
    if (id.startsWith('F03.') && id.endsWith('.invalid')) return { ok: field!.invalid, observed: { invalid: field!.invalid }, code: 'INVALID_STATE_MISMATCH' };
    if (id.startsWith('F03.') && id.endsWith('.idref')) return matched(field!.idref, 'IDREF_MISMATCH');
    if (id.endsWith('.value')) return { ok: field!.value, observed: { editable: !!field!.editable, matched: field!.value }, code: 'VALUE_MISMATCH' };
    if (id.endsWith('.blur')) return matched(s.focus !== `field-${n}`, 'FOCUS_MISMATCH');
    if (id.startsWith('F06.clear.')) return { ok: field!.cleared, observed: { visible: field!.visible, invalid: !field!.invalidCleared }, code: 'ERROR_NOT_CLEARED' };
    throw new Error('UNIMPLEMENTED_REFERENCE_CHECK');
  };
  const mark = (check: CheckResult, reading: Reading) => {
    check.status = reading.ok ? 'pass' : 'fail'; check.messageCode = reading.ok ? 'OK' : reading.code;
    check.observed = reading.observed; check.stepId = result.steps.at(-1)?.stepId ?? null;
    if (!reading.ok) throw new NativeFailure(reading.code, check.checkId);
  };
  try {
    for (let index = 0; index < checks.length; index++) {
      current = checks[index]!;
      current.stepId = result.steps.at(-1)?.stepId ?? null;
      const planned = manifest.checks[index]!, needed = Number(planned.stepId?.slice(5) ?? 0);
      let entryTabs = 0;
      while (result.steps.length < needed) {
        const action = manifest.steps[result.steps.length]!;
        if (current.checkId.endsWith('.entry') && action.key === 'Tab' && ++entryTabs > config.maxTabs) throw new NativeFailure('ENTRY_LIMIT');
        if (result.steps.length >= 500) throw new NativeFailure('ACTION_LIMIT');
        const before = await capture(); guard();
        if (manifest.kind === 'dialog' && action.key === 'Enter' && before.focus !== action.targetId) {
          mark(current, { ok: false, observed: { focus: before.focus }, code: 'FOCUS_MISMATCH' });
        }
        if (action.stepId === 'step-001') result.coverage.entryEvidence = 'tab';
        if (manifest.kind === 'dialog' && action.stepId !== 'step-001' && action.key !== 'Enter' && !before.inside) throw new NativeFailure('FOCUS_OUTSIDE_DIALOG');
        if (manifest.kind === 'tabs' && action.stepId !== 'step-001' && !before.inside) throw new NativeFailure('FOCUS_MISMATCH');
        if (action.actionKind === 'insertText' || action.key === 'ControlOrMeta+A') {
          const n = Number(action.targetId!.split('-')[1]);
          if (before.focus !== action.targetId) throw new NativeFailure('FOCUS_MISMATCH');
          if (!before.form[n]!.editable) throw new NativeFailure('NOT_EDITABLE');
        }
        const began = performance.now();
        const step: StepResult = { ...action, beforeFocus: before.focus, afterFocus: 'unknown', elapsedMs: 0, observationWindowMs: 0 };
        result.steps.push(step);
        if (action.actionKind === 'insertText') await page.keyboard.insertText(['sample-one', 'sample-two'][Number(action.targetId!.split('-')[1])]!);
        else await page.keyboard.press(action.key!);
        const after = await capture(); guard(); step.afterFocus = after.focus; step.elapsedMs = performance.now() - began;
        if (manifest.kind === 'tabs' && action.key!.startsWith('Arrow')) {
          const pending = manifest.checks.find(c => c.stepId === step.stepId && c.checkId.endsWith('.unchanged'))!;
          const r = selection(after, pending.expected.selected!);
          if (!r.ok) mark(checks.find(c => c.checkId === pending.checkId)!, { ...r, code: 'PREMATURE_ACTIVATION' });
        }
      }
      const group = current.checkId.startsWith('F02.message.') || current.checkId.startsWith('F06.clear.') ? checks.slice(index, index + 2) : [current];
      const negative = current.checkId.endsWith('.unchanged');
      const begin = performance.now(), deadline = begin + (negative ? config.observationWindowMs : remaining());
      let firstObserved: number | undefined, lastObserved: number | undefined, maxGap = 0;
      const intervals: number[] = [];
      while (true) {
        const readStarted = performance.now();
        const state = await capture(!negative);
        const readings = await Promise.all(group.map(c => read(c, state))); guard();
        if (negative) {
          if (lastObserved !== undefined) { intervals.push(state.observedAt - lastObserved); maxGap = Math.max(maxGap, intervals.at(-1)!); }
          firstObserved ??= state.observedAt; lastObserved = state.observedAt;
          Object.assign(readings[0]!.observed, { observationWindowMs: state.observedAt - firstObserved,
            observationCount: intervals.length + 1, observationIntervalsMs: [...intervals], maxObservationGapMs: maxGap });
          current.observed = readings[0]!.observed;
          result.steps.at(-1)!.observationWindowMs = state.observedAt - firstObserved;
        }
        const mismatch = readings.findIndex(r => !r.ok), expired = negative ?
          intervals.length > 0 && state.observedAt - firstObserved! >= config.observationWindowMs : performance.now() >= deadline;
        if (negative && mismatch !== -1) mark(current, readings[mismatch]!);
        if (negative && maxGap > 100) throw new NativeFailure('OBSERVATION_GAP');
        if (negative ? expired : mismatch === -1 || expired) {
          if (mismatch !== -1) mark(group[mismatch]!, readings[mismatch]!);
          if (!negative && expired) mark(current, { ok: false, observed: readings[0]!.observed, code: 'EXPECTATION_TIMEOUT' });
          for (let n = 0; n < group.length; n++) mark(group[n]!, readings[n]!);
          break;
        }
        // Match the same 25 ms target and 10 ms maximum pause as the journey.
        const pause = negative ? Math.max(1, Math.min(10, 25 - (performance.now() - readStarted))) : 20;
        await delay(Math.max(1, Math.min(pause, negative ? config.observationWindowMs - (state.observedAt - firstObserved!) : deadline - performance.now(), remaining())));
      }
      index += group.length - 1;
    }
  } catch (error) {
    const failure = error instanceof NativeFailure ? error : new NativeFailure('BROWSER_ERROR');
    const check = failure.checkId ? checks.find(c => c.checkId === failure.checkId)! : current;
    if (check.status === 'not_run') { check.status = 'blocked'; check.messageCode = failure.code; check.stepId = result.steps.at(-1)?.stepId ?? null; }
  } finally {
    page.off('framenavigated', navigated); page.off('popup', popup); page.off('close', closed);
  }
  const cause = checks.find(c => c.status === 'fail' || c.status === 'blocked');
  for (const c of checks) if (c.status === 'not_run') c.blockedBy = cause?.checkId ?? 'E_ABORTED';
  result.coverage.passed = checks.filter(c => c.status === 'pass').length;
  result.coverage.failed = checks.filter(c => c.status === 'fail').length;
  result.coverage.blocked = checks.filter(c => c.status === 'blocked').length;
  result.coverage.notRun = checks.filter(c => c.status === 'not_run').length;
  result.coverage.complete = !result.coverage.blocked && !result.coverage.notRun;
  result.outcome = result.coverage.failed ? 'failed' : result.coverage.complete ? 'passed' : 'blocked';
  result.run.durationMs = performance.now() - started;
  assert(schemaValid(result), 'REFERENCE_SCHEMA_INVALID');
  await info.attach('journey-result.json', { body: Buffer.from(JSON.stringify(result)), contentType: 'application/json' });
  return result;
}
