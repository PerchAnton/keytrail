import type { Dialog, Frame, Page } from '@playwright/test';
import type { AppliedConfig, Focus, MessageCode, StepResult, Target } from '../contracts/types.js';

export class Blocked extends Error {
  constructor(readonly code: MessageCode) { super(code); }
}
export type Snapshot = { focus: Focus; focused: Set<string>; present: Set<string>; inside: boolean };
export class BoundaryExit extends Error {}
/** Browser calls are awaited; there is no background action chain or Promise.race. */
export class Driver {
  private interrupted: MessageCode | undefined;
  private actions = 0;
  private dismissals: Promise<unknown>[] = [];
  readonly steps: StepResult[] = [];
  private onNavigation = (frame: Frame) => { if (frame === this.page.mainFrame()) this.interrupted ??= 'NAVIGATION'; };
  private onPopup = () => { this.interrupted ??= 'POPUP'; };
  private onClose = () => { this.interrupted ??= 'PAGE_CLOSED'; };
  private onDialog = (dialog: Dialog) => {
    this.interrupted ??= 'UNSUPPORTED_DIALOG';
    // A browser modal blocks the in-flight keyboard command. Dismiss only to unblock
    // that unsupported call; never resume the journey or restore application DOM.
    this.dismissals.push(dialog.dismiss().catch(() => undefined));
  };
  constructor(readonly page: Page, readonly targets: readonly Target[], readonly dialog: Target,
    readonly config: AppliedConfig, readonly started: number) {
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
  async snapshot(): Promise<Snapshot> {
    this.guard();
    try {
      const present = new Set<string>(), focused = new Set<string>();
      let focus: Focus = await this.page.evaluate(() => {
        const el = document.activeElement;
        if (!el) return 'none';
        if (el === document.body || el === document.documentElement) return 'body';
        return el.shadowRoot || el.tagName === 'IFRAME' ? 'unsupported' : 'unknown';
      });
      this.guard();
      for (const target of this.targets) {
        this.guard();
        if (target.locator.page() !== this.page) throw new Blocked('UNSUPPORTED_CONTEXT');
        const count = await target.locator.count();
        this.guard();
        if (count > 1) throw new Blocked('TARGET_AMBIGUOUS');
        if (!count) continue;
        const state = await target.locator.evaluate(el => ({
          supported: window === window.top && el.getRootNode() === document,
          native: !!el.closest('dialog'), focused: document.activeElement === el,
        }), undefined, { timeout: this.remaining() });
        this.guard();
        if (!state.supported) throw new Blocked('UNSUPPORTED_CONTEXT');
        if (state.native) throw new Blocked('UNSUPPORTED_DIALOG');
        for (const other of this.targets) {
          if (!present.has(other.id)) continue;
          this.guard();
          if (await target.locator.and(other.locator).count()) throw new Blocked('TARGET_ALIAS');
        }
        present.add(target.id);
        if (state.focused) { focused.add(target.id); focus = target.id; }
      }
      this.guard();
      const unsupportedLayers = await this.page.locator('dialog, [role="dialog"], [role="alertdialog"]').evaluateAll(elements => {
        const visible = elements.filter(el => el.getClientRects().length > 0 && getComputedStyle(el).visibility !== 'hidden');
        return visible.some(el => el.tagName === 'DIALOG' || el.getAttribute('role') === 'alertdialog') || visible.length > 1;
      });
      if (unsupportedLayers) throw new Blocked('UNSUPPORTED_DIALOG');
      const inside = present.has(this.dialog.id) && await this.dialog.locator.evaluate(
        el => !!document.activeElement && el.contains(document.activeElement), undefined, { timeout: this.remaining() });
      this.guard();
      if (focus === 'unsupported') throw new Blocked('UNSUPPORTED_CONTEXT');
      return { focus, focused, present, inside };
    } catch (error) { throw this.normalize(error); }
  }
  async press(key: StepResult['key'], target: Target | null, requireInside = false): Promise<Snapshot> {
    const before = await this.snapshot();
    if (requireInside && !before.inside) throw new BoundaryExit();
    this.guard();
    if (this.actions >= 500) throw new Blocked('ACTION_LIMIT');
    const started = performance.now();
    const step: StepResult = { stepId: `step-${String(++this.actions).padStart(3, '0')}`,
      actionKind: 'press', key, targetId: target?.id ?? null, beforeFocus: before.focus,
      afterFocus: 'unknown', elapsedMs: 0, observationWindowMs: 0 };
    this.steps.push(step);
    try {
      await this.page.keyboard.press(key);
      this.guard();
      const after = await this.snapshot();
      step.afterFocus = after.focus;
      return after;
    } catch (error) { throw this.normalize(error); }
    finally { step.elapsedMs = Math.max(0, performance.now() - started); }
  }
}
