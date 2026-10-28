import { setTimeout as delay } from 'node:timers/promises';
import type { Dialog, ElementHandle, Frame, JSHandle, Locator, Page } from '@playwright/test';
import type { AppliedConfig, Focus, FormErrorsContract, MessageCode, PressKey, StepResult, TabsContract, Target } from '../contracts/types.js';

export class Blocked extends Error {
  constructor(readonly code: MessageCode) { super(code); }
}
export type TabsState = {
  structure: boolean; role: boolean; named: boolean; orientation: boolean;
  selected: string[]; visiblePanels: string[]; selectionValid: boolean; roving: boolean;
  items: { tabRole: boolean; panelRole: boolean; controls: boolean; labelledby: boolean }[];
};
export type FormState = {
  structure: boolean;
  errors: { visible: boolean; textMatches: boolean; invalid: boolean; idref: boolean;
    editable: boolean; valueMatches: boolean; invalidCleared: boolean; cleared: boolean }[];
  links: boolean[];
};
export type Snapshot = { focus: Focus; focused: Set<string>; present: Set<string>; inside: boolean; tabs?: TabsState; form?: FormState };
export class BoundaryExit extends Error {}
/** Browser calls are awaited; there is no background action chain or Promise.race. */
export class Driver {
  private interrupted: MessageCode | undefined;
  private actions = 0;
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
          // Independent reads can overlap, but every read must settle before the
          // observation or cleanup. In particular, an early failure must not leak
          // handles returned by a slower sibling. Preserve target-order errors.
          const unwrap = <T>(result: PromiseSettledResult<T>): T => {
            if (result.status === 'rejected') throw result.reason;
            return result.value;
          };
          const targetReads = Promise.allSettled(this.targets.map(async target => {
            const nodes = await resolve(target.locator);
            if (nodes.length > 1) throw new Blocked('TARGET_AMBIGUOUS');
            const node = nodes[0] ?? null;
            if (node && await node.ownerFrame() !== this.page.mainFrame()) throw new Blocked('UNSUPPORTED_CONTEXT');
            return { id: target.id, node };
          }));
          // Use Playwright's role resolution, including fallback role tokens.
          const roleReads = Promise.allSettled([
            resolve(this.page.getByRole('dialog', { includeHidden: true })),
            resolve(this.page.getByRole('alertdialog', { includeHidden: true })),
            ...(this.tabsContract ? [
              resolve(this.page.getByRole('tablist', { includeHidden: true })),
              resolve(this.page.getByRole('tablist', { name: /\S/, includeHidden: true })),
              resolve(this.page.getByRole('tab', { includeHidden: true })),
              resolve(this.page.getByRole('tabpanel', { includeHidden: true })),
            ] : []),
            ...(this.formContract?.summaryLinks?.length ? [resolve(this.page.getByRole('link', { includeHidden: true }))] : []),
          ]);
          const [targetResults, roleResults] = await Promise.all([targetReads, roleReads]);
          const targets = targetResults.map(unwrap), roles = roleResults.map(unwrap);
          const dialogs = roles[0]!, alerts = roles[1]!;
          const tabRoles = this.tabsContract ? { lists: roles[2]!, named: roles[3]!, tabs: roles[4]!, panels: roles[5]! } : null;
          const tabs = this.tabsContract ? { orientation: this.tabsContract.orientation,
            items: this.tabsContract.items.map(item => ({ tab: item.tab.id, panel: item.panel.id })) } : null;
          const form = this.formContract ? { submit: this.formContract.submit.id,
            errors: this.formContract.errors.map(error => ({ field: error.field.id, message: error.message.id, via: error.via,
              text: typeof error.expectedText === 'string' ? { literal: error.expectedText } :
                { source: error.expectedText.source, flags: error.expectedText.flags },
              value: this.formContract!.correction.find(c => c.field === error.field)!.value })),
            links: this.formContract.summaryLinks?.map(l => l.link.id) ?? [] } : null;
          const linkRoles = form?.links.length ? roles[2]! : [];
          this.guard();
          const state = await this.page.evaluate(({ targets, dialogId, dialogs, alerts, tabRoles, tabs, form, linkRoles }) => {
            const result = { code: '' as MessageCode | '', detached: false,
              focus: 'unknown', focused: [] as string[], present: [] as string[], inside: false,
              tabs: null as TabsState | null, form: null as FormState | null };
            const nodes = [...targets.flatMap(t => t.node ? [t.node] : []), ...dialogs, ...alerts,
              ...Object.values(tabRoles ?? {}).flat(), ...linkRoles];
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
            if (tabs && tabRoles) {
              const node = (id: string): Element | null => {
                const found = targets.find(t => t.id === id)?.node;
                return found instanceof Element ? found : null;
              };
              const root = node(dialogId);
              const members = tabs.items.map(item => ({ ...item, tabNode: node(item.tab), panelNode: node(item.panel) }));
              if (root && (getComputedStyle(root).direction === 'rtl' || root.hasAttribute('aria-activedescendant') ||
                  root.getAttribute('aria-disabled') === 'true' || members.some(item => item.tabNode &&
                  (item.tabNode.hasAttribute('aria-activedescendant') || item.tabNode.matches(':disabled') || item.tabNode.getAttribute('aria-disabled') === 'true')))) {
                return { ...result, code: 'UNSUPPORTED_TABS' as const };
              }
              const ids = new Map<string, Element[]>();
              for (const el of document.querySelectorAll('[id]')) ids.set(el.id, [...(ids.get(el.id) ?? []), el]);
              const unique = (el: Element | null) => !!el?.id && ids.get(el.id)?.length === 1 && ids.get(el.id)![0] === el;
              const tokens = (el: Element | null, attribute: string) => el?.getAttribute(attribute)?.trim().split(/\s+/).filter(Boolean) ?? [];
              const actualTabs = tabRoles.tabs.filter(el => root?.contains(el));
              const selected = members.filter(item => item.tabNode?.getAttribute('aria-selected') === 'true').map(item => item.tab);
              result.tabs = {
                structure: !!root && members.every(item => item.tabNode && item.panelNode && root.contains(item.tabNode)) &&
                  actualTabs.length === members.length && actualTabs.every(el => members.some(item => item.tabNode === el)),
                role: !!root && tabRoles.lists.includes(root), named: !!root && tabRoles.named.includes(root),
                orientation: !!root && (root.getAttribute('aria-orientation') === tabs.orientation ||
                  (tabs.orientation === 'horizontal' && !root.hasAttribute('aria-orientation'))),
                selected, visiblePanels: members.filter(item => item.panelNode && visible(item.panelNode)).map(item => item.panel),
                selectionValid: members.every(item => ['true', 'false'].includes(item.tabNode?.getAttribute('aria-selected') ?? '')),
                roving: members.some(item => item.tabNode === active) && members.every(item => item.tabNode &&
                  (item.tabNode as HTMLElement).tabIndex === (item.tabNode === active ? 0 : -1)),
                items: members.map(item => ({ tabRole: !!item.tabNode && tabRoles.tabs.includes(item.tabNode),
                  panelRole: !!item.panelNode && tabRoles.panels.includes(item.panelNode),
                  controls: unique(item.panelNode) && tokens(item.tabNode, 'aria-controls').length === 1 && tokens(item.tabNode, 'aria-controls')[0] === item.panelNode?.id,
                  labelledby: unique(item.tabNode) && tokens(item.panelNode, 'aria-labelledby').includes(item.tabNode!.id) })),
              };
            }
            if (form) {
              const node = (id: string): Element | null => {
                const found = targets.find(t => t.id === id)?.node;
                return found instanceof Element ? found : null;
              };
              const root = node(dialogId), submit = node(form.submit);
              const supportedField = (el: Element | null): el is HTMLInputElement | HTMLTextAreaElement =>
                el instanceof HTMLTextAreaElement || el instanceof HTMLInputElement &&
                ['text', 'email', 'search', 'tel', 'url', 'password'].includes(el.type);
              if ((root && (!(root instanceof HTMLFormElement) || !root.noValidate)) ||
                  (submit && (!(submit instanceof HTMLButtonElement) || submit.type !== 'submit')) ||
                  form.errors.some(e => node(e.field) && !supportedField(node(e.field)))) return { ...result, code: 'UNSUPPORTED_FORM' as const };
              const ids = new Map<string, Element[]>();
              for (const el of document.querySelectorAll('[id]')) ids.set(el.id, [...(ids.get(el.id) ?? []), el]);
              const normalize = (text: string) => text.trim().replace(/\s+/g, ' ');
              result.form = {
                structure: root instanceof HTMLFormElement && submit instanceof HTMLButtonElement &&
                  root.contains(submit) && submit.form === root && form.errors.every(e => {
                    const field = node(e.field); return supportedField(field) && root.contains(field) && field.form === root;
                  }),
                errors: form.errors.map(error => {
                  const field = node(error.field), message = node(error.message);
                  const text = normalize(message instanceof HTMLElement ? message.innerText : message?.textContent ?? '');
                  const refs = field?.getAttribute(error.via)?.trim().split(/\s+/).filter(Boolean) ?? [];
                  const unique = !!message?.id && ids.get(message.id)?.length === 1 && ids.get(message.id)![0] === message;
                  const wrongMessage = form.errors.some(other => other.message !== error.message &&
                    !!node(other.message)?.id && refs.includes(node(other.message)!.id));
                  const invalid = field?.getAttribute('aria-invalid');
                  return {
                    visible: !!message && visible(message),
                    textMatches: !!text && (error.text.literal !== undefined ? text === normalize(error.text.literal) :
                      new RegExp(error.text.source!, error.text.flags).test(text)),
                    invalid: invalid === 'true', idref: unique && refs.includes(message!.id) && !wrongMessage,
                    editable: supportedField(field) && visible(field) && !field.readOnly && !field.matches(':disabled') && field.getAttribute('aria-disabled') !== 'true' && !field.closest('[inert]'),
                    valueMatches: supportedField(field) && field.value === error.value,
                    invalidCleared: !!field && (invalid === null || invalid === 'false'),
                    cleared: !!field && (!message || !visible(message)) && (invalid === null || invalid === 'false'),
                  };
                }),
                links: form.links.map(id => { const el = node(id); return !!el && linkRoles.includes(el); }),
              };
            }
            return result;
          }, { targets, dialogId: this.dialog.id, dialogs, alerts, tabRoles, tabs, form, linkRoles });
          this.guard();
          if (state.code) throw new Blocked(state.code);
          if (!state.detached) return { focus: state.focus, focused: new Set(state.focused), present: new Set(state.present), inside: state.inside,
            ...(state.tabs ? { tabs: state.tabs } : {}), ...(state.form ? { form: state.form } : {}) };
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
  async press(key: PressKey, target: Target | null, requireInside = false,
    inspectBefore?: (state: Snapshot) => void): Promise<Snapshot> {
    return this.keyboardAction('press', key, target, () => this.page.keyboard.press(key), requireInside, inspectBefore);
  }
  async insertText(value: string, target: Target, inspectBefore: (state: Snapshot) => void): Promise<Snapshot> {
    return this.keyboardAction('insertText', null, target, () => this.page.keyboard.insertText(value), false, inspectBefore);
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
