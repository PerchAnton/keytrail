import type { MessageCode } from '../contracts/types.js';
import type { TabsState, FormState } from './driver.js';

export type ObservationRequest = {
  targetSlots: { id: string; slot: number }[]; roleSlots: number[]; dialogId: string;
  tabs: { orientation: string; items: { tab: string; panel: string }[] } | null;
  form: { submit: string; errors: { field: string; message: string; via: string;
    text: { literal?: string; source?: string; flags?: string }; value: string }[]; links: string[] } | null;
  semantics: boolean;
};

/** Serialized once per journey. Keep the reader self-contained in the browser. */
export function createObservationStore(requests: Record<'complete' | 'interaction', ObservationRequest>) {
  const store = new Map<number, Element[]>();
  const read = ({ targetSlots, roleSlots, dialogId, tabs, form, semantics }: ObservationRequest) => {
    try {
      const targets = targetSlots.map(({ id, slot }) => ({ id, node: store.get(slot)?.[0] ?? null }));
      const roles = roleSlots.map(slot => store.get(slot) ?? []);
      const dialogs = roles[0]!, alerts = roles[1]!;
      const tabRoles = tabs ? { tabs: roles[2]!, lists: roles[3] ?? [], named: roles[4] ?? [], panels: roles[5] ?? [] } : null;
      const linkRoles = form?.links.length ? roles[2]! : [];
      const result = { observedAt: performance.now(), code: '' as MessageCode | '', detached: false,
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
        if (semantics) for (const el of document.querySelectorAll('[id]')) ids.set(el.id, [...(ids.get(el.id) ?? []), el]);
        const unique = (el: Element | null) => !!el?.id && ids.get(el.id)?.length === 1 && ids.get(el.id)![0] === el;
        const tokens = (el: Element | null, attribute: string) => el?.getAttribute(attribute)?.trim().split(/\s+/).filter(Boolean) ?? [];
        const actualTabs = tabRoles.tabs.filter(el => root?.contains(el));
        const selected = members.filter(item => item.tabNode?.getAttribute('aria-selected') === 'true').map(item => item.tab);
        result.tabs = {
          structure: !!root && members.every(item => item.tabNode && item.panelNode && root.contains(item.tabNode)) &&
            actualTabs.length === members.length && actualTabs.every(el => members.some(item => item.tabNode === el)),
          selected, visiblePanels: members.filter(item => item.panelNode && visible(item.panelNode)).map(item => item.panel),
          selectionValid: members.every(item => ['true', 'false'].includes(item.tabNode?.getAttribute('aria-selected') ?? '')),
          roving: members.some(item => item.tabNode === active) && members.every(item => item.tabNode &&
            (item.tabNode as HTMLElement).tabIndex === (item.tabNode === active ? 0 : -1)),
          ...(semantics ? {
            role: !!root && tabRoles.lists.includes(root), named: !!root && tabRoles.named.includes(root),
            orientation: !!root && (root.getAttribute('aria-orientation') === tabs.orientation ||
              (tabs.orientation === 'horizontal' && !root.hasAttribute('aria-orientation'))),
            items: members.map(item => ({ tabRole: !!item.tabNode && tabRoles.tabs.includes(item.tabNode),
            panelRole: !!item.panelNode && tabRoles.panels.includes(item.panelNode),
            controls: unique(item.panelNode) && tokens(item.tabNode, 'aria-controls').length === 1 && tokens(item.tabNode, 'aria-controls')[0] === item.panelNode?.id,
            labelledby: unique(item.tabNode) && tokens(item.panelNode, 'aria-labelledby').includes(item.tabNode!.id) })),
          } : {}),
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
    } finally { store.clear(); }
  };
  return Object.assign(store, {
    register(nodes: Element[], slot: number, scope: 'complete' | 'interaction') {
      store.set(slot, nodes);
      const request = requests[scope];
      // The last fresh locator resolution reads the DOM in the same browser task.
      // Earlier registrations return only their count; no extra host request is needed.
      return { count: nodes.length,
        state: store.size === request.targetSlots.length + request.roleSlots.length ? read(request) : null };
    },
  });
}
