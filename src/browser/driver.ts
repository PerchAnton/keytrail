import { setTimeout as delay } from 'node:timers/promises';
import { createObservationStore, type ObservationRequest } from './observation-store.js';
import type { Dialog, Frame, JSHandle, Locator, Page } from '@playwright/test';
import type { AppliedConfig, Focus, FormErrorsContract, MessageCode, PressKey, StepResult, TabsContract, Target } from '../contracts/types.js';

export class Blocked extends Error {
  constructor(readonly code: MessageCode) { super(code); }
}
export type TabsState = {
  structure: boolean; role?: boolean; named?: boolean; orientation?: boolean;
  selected: string[]; visiblePanels: string[]; selectionValid: boolean; roving: boolean;
  items?: { tabRole: boolean; panelRole: boolean; controls: boolean; labelledby: boolean }[];
};
export type FormState = {
  structure: boolean;
  errors: { visible: boolean; textMatches: boolean; invalid: boolean; idref: boolean;
    editable: boolean; valueMatches: boolean; invalidCleared: boolean; cleared: boolean }[];
  links: boolean[];
};
export type Snapshot = { observedAt: number; focus: Focus; focused: Set<string>; present: Set<string>; inside: boolean; tabs?: TabsState; form?: FormState };
export class BoundaryExit extends Error {}
/** Browser calls are awaited; there is no background action chain or Promise.race. */
export class Driver {
  private interrupted: MessageCode | undefined;
  private actions = 0;
  private observationStore: JSHandle<ReturnType<typeof createObservationStore>> | undefined;
  private interactionBatch: { locator: Locator; ids: string[] } | null | undefined;
  private dismissals: Promise<unknown>[] = [];
  private fragmentNavigation: { base: string } | undefined;
  readonly steps: StepResult[] = [];
  private onNavigation = (frame: Frame) => {
    if (frame !== this.page.mainFrame()) return;
    // Only a declared summary-link activation may change the fragment. Its original
    // Document handle must still be valid after the action and its observations.
    if (this.fragmentNavigation && frame.url().split('#')[0] === this.fragmentNavigation.base) return;
    this.interrupted ??= 'NAVIGATION';
  };
  private onPopup = () => { this.interrupted ??= 'POPUP'; };
  private onClose = () => { this.interrupted ??= 'PAGE_CLOSED'; };
  private onDialog = (dialog: Dialog) => {
    this.interrupted ??= 'UNSUPPORTED_DIALOG';
    // A browser modal blocks the in-flight keyboard command. Dismiss only to unblock
    // that unsupported call; never resume the journey or restore application DOM.
    this.dismissals.push(dialog.dismiss().catch(() => undefined));
  };
  constructor(readonly page: Page, readonly targets: readonly Target[], readonly dialog: Target,
    readonly config: AppliedConfig, readonly started: number, readonly tabsContract?: TabsContract,
    readonly formContract?: FormErrorsContract) {
    page.on('framenavigated', this.onNavigation);
    page.on('popup', this.onPopup);
    page.on('close', this.onClose);
    page.on('dialog', this.onDialog);
  }
  async dispose(): Promise<void> {
    this.page.off('framenavigated', this.onNavigation);
    this.page.off('popup', this.onPopup);
    this.page.off('close', this.onClose);
    this.page.off('dialog', this.onDialog);
    await Promise.all(this.dismissals);
    const store = this.observationStore; this.observationStore = undefined;
    if (this.tabsContract) await store?.evaluate(value => value.stopBatch()).catch(() => undefined);
    await store?.dispose().catch(() => undefined);
  }
  guard(): void {
    if (this.interrupted) throw new Blocked(this.interrupted);
    if (this.page.isClosed()) throw new Blocked('PAGE_CLOSED');
    if (performance.now() - this.started >= this.config.scenarioTimeoutMs) throw new Blocked('SCENARIO_TIMEOUT');
  }
  remaining(): number {
    this.guard();
    return Math.max(1, Math.min(this.config.timeoutMs, this.config.scenarioTimeoutMs - (performance.now() - this.started)));
  }
  normalize(error: unknown): Blocked {
    if (error instanceof Blocked) return error;
    try { this.guard(); } catch (reason) { return reason as Blocked; }
    if (error instanceof Error && error.name === 'TimeoutError') return new Blocked('EXPECTATION_TIMEOUT');
    return new Blocked('BROWSER_ERROR');
  }
  private observationPlans: Record<'complete' | 'interaction', { locators: Locator[]; request: ObservationRequest }> | undefined;
  private plans() {
    if (this.observationPlans) return this.observationPlans;
    const plan = (semantics: boolean) => {
      // Locator objects remain live queries; no element binding is cached.
      const locators = [
        this.page.getByRole('dialog', { includeHidden: true }),
        this.page.getByRole('alertdialog', { includeHidden: true }),
        ...(this.tabsContract ? [this.page.getByRole('tab', { includeHidden: true }),
          ...(semantics ? [this.page.getByRole('tablist', { includeHidden: true }),
            this.page.getByRole('tablist', { name: /\S/, includeHidden: true }),
            this.page.getByRole('tabpanel', { includeHidden: true })] : [])] : []),
        ...(this.formContract?.summaryLinks?.length ? [this.page.getByRole('link', { includeHidden: true })] : []),
      ];
      const request: ObservationRequest = {
        targetSlots: this.targets.map((target, slot) => ({ id: target.id, slot })),
        roleSlots: locators.map((_, index) => this.targets.length + index), dialogId: this.dialog.id, semantics,
        tabs: this.tabsContract ? { orientation: this.tabsContract.orientation,
          items: this.tabsContract.items.map(item => ({ tab: item.tab.id, panel: item.panel.id })) } : null,
        form: this.formContract ? { submit: this.formContract.submit.id,
          errors: this.formContract.errors.map(error => ({ field: error.field.id, message: error.message.id, via: error.via,
            text: typeof error.expectedText === 'string' ? { literal: error.expectedText } :
              { source: error.expectedText.source, flags: error.expectedText.flags },
            value: this.formContract!.correction.find(c => c.field === error.field)!.value })),
          links: this.formContract.summaryLinks?.map(l => l.link.id) ?? [] } : null,
      };
      return { locators, request };
    };
    return this.observationPlans = { complete: plan(true), interaction: plan(false) };
  }
  async snapshot(scope: 'complete' | 'interaction' = 'complete'): Promise<Snapshot> {
    // Initial semantics use complete reads. Negative windows consume only live
    // focus, selection, visibility, roving state and structure; do not resolve
    // unused name/panel-role metadata there. Omitted metadata stays unobserved.
    const plans = this.plans();
    const deadline = performance.now() + this.remaining();
    try {
      while (true) {
        this.guard();
        // Keep one private browser object, never page globals or DOM markers.
        // Every slot is resolved afresh for every snapshot. The atomic read clears
        // all element references before returning, without per-element protocol
        // handles/disposal requests. No selector parsing or cached target binding.
        this.observationStore ??= await this.page.evaluateHandle(createObservationStore,
          { complete: plans.complete.request, interaction: plans.interaction.request });
        const store = this.observationStore;
        let readFinished = false;
        try {
          const batch = scope === 'interaction' ? this.interactionBatch : null;
          const resolve = async (locator: Locator, slot: number) => {
            this.guard();
            if (locator.page() !== this.page) throw new Blocked('UNSUPPORTED_CONTEXT');
            let result: ReturnType<ReturnType<typeof createObservationStore>['register']>;
            try {
              result = slot === -1 && batch
                ? await locator.evaluateAll((nodes, { store, ids }) => store.registerBatch(nodes, ids), { store, ids: batch.ids })
                : await locator.evaluateAll((nodes, { store, slot, scope }) => store.register(nodes, slot, scope), { store, slot, scope });
            } catch (error) {
              this.guard();
              // A non-DOM handle cannot cross execution contexts. Diagnose a
              // foreign frame with a primitive-only public read; keep ordinary
              // transport failures classified as browser errors.
              const main = await locator.evaluateAll(() => window === window.top).catch(() => undefined);
              this.guard();
              if (main === false) throw new Blocked('UNSUPPORTED_CONTEXT');
              throw error;
            }
            this.guard();
            return result;
          };
          // Independent reads can overlap, but every read must settle before the
          // result or cleanup. In particular, an early failure must not leak
          // nodes registered by a slower sibling. Preserve target-order errors.
          const unwrap = <T>(result: PromiseSettledResult<T>): T => {
            if (result.status === 'rejected') throw result.reason;
            return result.value;
          };
          const targetQueries = batch ? [{ locator: batch.locator, slot: -1 }] : this.targets.map((target, slot) => ({ locator: target.locator, slot }));
          const queries = [...targetQueries,
            ...plans[scope].locators.map((locator, index) => ({ locator, slot: this.targets.length + index }))];
          // Start transport work from a short stack. Playwright captures and maps
          // stacks for each request; retaining the entire journey's async caller
          // chain multiplies that work across every locator in every snapshot.
          // A microtask adds no timer pause. It retains the current async context,
          // and every query still checks the deadline and resolves fresh nodes.
          const results = await new Promise<PromiseSettledResult<Awaited<ReturnType<typeof resolve>>>[]>(done => {
            queueMicrotask(() => {
              void Promise.allSettled(queries.map(({ locator, slot }) => resolve(locator, slot))).then(done);
            });
          });
          const resolved = results.map((result, index) => {
            const reply = unwrap(result);
            if (!batch && index < this.targets.length && reply.count > 1) throw new Blocked('TARGET_AMBIGUOUS');
            return reply;
          });
          if (batch && resolved[0]!.fallback) {
            this.interactionBatch = null;
            if (performance.now() >= deadline) throw new Blocked('EXPECTATION_TIMEOUT');
            continue; // The finally block clears partial slots. Credit only the next fresh reading.
          }
          const states = resolved.flatMap(result => result.state ? [result.state] : []);
          if (states.length !== 1) throw new Blocked('BROWSER_ERROR');
          const state = states[0]!;
          readFinished = true;
          this.guard();
          if (state.code) throw new Blocked(state.code);
          if (scope === 'interaction' && this.interactionBatch === undefined && !state.detached) {
            const hints = resolved.slice(0, this.targets.length).map(reply => reply.hint);
            this.interactionBatch = this.makeInteractionBatch(hints);
          }
          if (!state.detached) return { observedAt: state.observedAt, focus: state.focus, focused: new Set(state.focused), present: new Set(state.present), inside: state.inside,
            ...(state.tabs ? { tabs: state.tabs } : {}), ...(state.form ? { form: state.form } : {}) };
        } finally {
          // All resolver calls have settled before cleanup. A failed read must
          // release stored nodes too; navigation may already have destroyed it.
          if (!readFinished) await store.evaluate(value => value.clear()).catch(() => undefined);
        }
        this.guard();
        if (performance.now() >= deadline) throw new Blocked('EXPECTATION_TIMEOUT');
        await delay(Math.max(1, Math.min(20, deadline - performance.now(), this.remaining())));
      }
    } catch (error) { throw this.normalize(error); }
  }
  private makeInteractionBatch(hints: (string | null)[]) {
    if (hints.length < 3 || hints.length > 16 || !hints.every((id): id is string => id !== null) ||
        new Set(hints).size !== hints.length || !this.targets.every(({ locator }) =>
          typeof locator.locator === 'function' && typeof locator.or === 'function')) return null;
    // Run the ORIGINAL locators afresh in one Playwright query. A match with a
    // different ID emits its tree root as a witness, even when the expected
    // node also matches. Only simple ASCII IDs from register() enter the XPath.
    const guarded = this.targets.map(({ locator }, i) => locator.locator(
      `xpath=self::*[@id='${hints[i]}'] | self::*[not(@id='${hints[i]}')]/ancestor-or-self::*[last()]`));
    return { ids: hints, locator: guarded.reduce((union, locator) => union.or(locator)) };
  }
  async press(key: PressKey, target: Target | null, requireInside = false,
    inspectBefore?: (state: Snapshot) => void): Promise<Snapshot> {
    return this.keyboardAction('press', key, target, () => this.page.keyboard.press(key), requireInside, inspectBefore);
  }
  async insertText(value: string, target: Target, inspectBefore: (state: Snapshot) => void): Promise<Snapshot> {
    return this.keyboardAction('insertText', null, target, () => this.page.keyboard.insertText(value), false, inspectBefore);
  }
  async typeCharacter(character: string, target: Target, inspectBefore: (state: Snapshot) => void): Promise<Snapshot> {
    // Validation restricts this mode to printable ASCII. Keep characters out of the report.
    return this.keyboardAction('type', null, target, () => this.page.keyboard.type(character), false, inspectBefore);
  }
  async followSummaryLink(target: Target, inspectBefore: (state: Snapshot) => void): Promise<Snapshot> {
    return this.keyboardAction('press', 'Enter', target, () => this.page.keyboard.press('Enter'), false, inspectBefore, true);
  }
  private async verifyDocument(handle: JSHandle<Document>): Promise<void> {
    this.guard();
    let same = false;
    try { same = await handle.evaluate(original => original === document); } catch { /* A replaced context invalidates its handles. */ }
    this.guard();
    if (!same) throw new Blocked('NAVIGATION');
  }
  private async keyboardAction(actionKind: StepResult['actionKind'], key: StepResult['key'], target: Target | null,
    action: () => Promise<void>, requireInside: boolean, inspectBefore?: (state: Snapshot) => void,
    allowFragment = false): Promise<Snapshot> {
    const before = await this.snapshot();
    inspectBefore?.(before);
    if (requireInside && !before.inside) throw new BoundaryExit();
    this.guard();
    if (this.actions >= 500) throw new Blocked('ACTION_LIMIT');
    const started = performance.now();
    const step: StepResult = { stepId: `step-${String(++this.actions).padStart(3, '0')}`,
      actionKind, key, targetId: target?.id ?? null, beforeFocus: before.focus,
      afterFocus: 'unknown', elapsedMs: 0, observationWindowMs: 0 };
    this.steps.push(step);
    let documentHandle: JSHandle<Document> | undefined;
    try {
      if (allowFragment) {
        documentHandle = await this.page.evaluateHandle(() => document);
        this.fragmentNavigation = { base: this.page.url().split('#')[0]! };
        this.guard();
      }
      await action();
      if (documentHandle) await this.verifyDocument(documentHandle);
      this.guard();
      const after = await this.snapshot();
      if (documentHandle) await this.verifyDocument(documentHandle);
      step.afterFocus = after.focus;
      return after;
    } catch (error) {
      if (documentHandle) await this.verifyDocument(documentHandle);
      throw this.normalize(error);
    } finally {
      this.fragmentNavigation = undefined;
      await documentHandle?.dispose().catch(() => undefined);
      step.elapsedMs = Math.max(0, performance.now() - started);
    }
  }
}
