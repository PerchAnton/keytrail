import { setTimeout as delay } from 'node:timers/promises';
import type { Dialog, ElementHandle, Frame, Locator, Page } from '@playwright/test';
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
    const deadline = performance.now() + this.remaining();
    try {
      while (true) {
        this.guard();
        // Handles exist only for this observation. Resolve locators again after
        // detachment and before every later observation; never act on a handle.
        const handles: ElementHandle[] = [];
        try {
          const resolve = async (locator: Locator) => {
            this.guard();
            if (locator.page() !== this.page) throw new Blocked('UNSUPPORTED_CONTEXT');
            const nodes = await locator.elementHandles();
            handles.push(...nodes);
            this.guard();
            return nodes;
          };
          const targets: { id: string; node: ElementHandle | null }[] = [];
          for (const target of this.targets) {
            const nodes = await resolve(target.locator);
            if (nodes.length > 1) throw new Blocked('TARGET_AMBIGUOUS');
            const node = nodes[0] ?? null;
            if (node && await node.ownerFrame() !== this.page.mainFrame()) throw new Blocked('UNSUPPORTED_CONTEXT');
            targets.push({ id: target.id, node });
          }
          // Use Playwright's role resolution, including fallback role tokens.
          const dialogs = await resolve(this.page.getByRole('dialog', { includeHidden: true }));
          const alerts = await resolve(this.page.getByRole('alertdialog', { includeHidden: true }));
          this.guard();
          const state = await this.page.evaluate(({ targets, dialogId, dialogs, alerts }) => {
            const result = { code: '' as MessageCode | '', detached: false,
              focus: 'unknown', focused: [] as string[], present: [] as string[], inside: false };
            const nodes = [...targets.flatMap(t => t.node ? [t.node] : []), ...dialogs, ...alerts];
            if (nodes.some(node => !node.isConnected)) return { ...result, detached: true };
            if (targets.some(({ node }) => node && (!(node instanceof Element) || node.getRootNode() !== document))) return { ...result, code: 'UNSUPPORTED_CONTEXT' as const };
            const active = document.activeElement;
            // Context is independent of caller-controlled target IDs.
            if (active?.shadowRoot || active?.tagName === 'IFRAME') return { ...result, code: 'UNSUPPORTED_CONTEXT' as const };
            const visible = (node: Node) => {
              if (!(node instanceof Element)) return false;
              const rect = node.getBoundingClientRect();
              const visibility = getComputedStyle(node).visibility;
              return rect.width > 0 && rect.height > 0 && visibility !== 'hidden' && visibility !== 'collapse';
            };
            const layers = new Set([...dialogs, ...alerts, ...document.querySelectorAll('dialog')].filter(visible));
            if ([...layers].some(node => node.getRootNode() !== document)) return { ...result, code: 'UNSUPPORTED_CONTEXT' as const };
            if (layers.size > 1 || [...layers].some(node => (node instanceof Element && node.tagName === 'DIALOG') || alerts.includes(node)) ||
                targets.some(t => t.node instanceof Element && t.node.closest('dialog'))) return { ...result, code: 'UNSUPPORTED_DIALOG' as const };
            const seen = new Set<Node>();
            result.focus = !active ? 'none' : active === document.body || active === document.documentElement ? 'body' : 'unknown';
            for (const { id, node } of targets) {
              if (!node) continue;
              if (seen.has(node)) return { ...result, code: 'TARGET_ALIAS' as const };
              seen.add(node);
              result.present.push(id);
              if (node === active) { result.focused.push(id); result.focus = id; }
              if (id === dialogId) result.inside = !!active && node.contains(active);
            }
            return result;
          }, { targets, dialogId: this.dialog.id, dialogs, alerts });
          this.guard();
          if (state.code) throw new Blocked(state.code);
          if (!state.detached) return { focus: state.focus, focused: new Set(state.focused), present: new Set(state.present), inside: state.inside };
        } finally {
          // Page closure can destroy a handle before disposal; preserve the primary result.
          await Promise.allSettled(handles.map(handle => handle.dispose()));
        }
        this.guard();
        if (performance.now() >= deadline) throw new Blocked('EXPECTATION_TIMEOUT');
        await delay(Math.max(1, Math.min(20, deadline - performance.now(), this.remaining())));
      }
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
