import type { AppliedConfig, DialogContract, Target } from './types.js';

export const DEFAULTS: Readonly<AppliedConfig> = Object.freeze({
  maxTabs: 25, timeoutMs: 2000, scenarioTimeoutMs: 30000, observationWindowMs: 200,
});
export const ID = /^[a-z][a-z0-9_-]{0,63}$/;
export type ValidatedDialog = { contract: DialogContract; config: AppliedConfig; targets: Target[] };
const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const integer = (x: unknown, min: number, max: number): x is number =>
  typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;

/** Validate trusted test-code configuration before any browser actions. */
export function validateDialog(value: unknown): ValidatedDialog | null {
  if (!object(value) || typeof value.id !== 'string' || !ID.test(value.id)) return null;
  if (value.contractVersion !== undefined &&
      (typeof value.contractVersion !== 'string' || !/^[A-Za-z0-9._-]{1,64}$/.test(value.contractVersion))) return null;
  if (value.entry !== undefined && !object(value.entry)) return null;
  const entry = value.entry as Record<string, unknown> | undefined;
  const config = {
    maxTabs: entry?.maxTabs ?? DEFAULTS.maxTabs,
    timeoutMs: value.timeoutMs ?? DEFAULTS.timeoutMs,
    scenarioTimeoutMs: value.scenarioTimeoutMs ?? DEFAULTS.scenarioTimeoutMs,
    observationWindowMs: value.observationWindowMs ?? DEFAULTS.observationWindowMs,
  };
  // Explicit null is invalid, not an implicit request for defaults.
  if ([entry?.maxTabs, value.timeoutMs, value.scenarioTimeoutMs, value.observationWindowMs].includes(null)) return null;
  if (!integer(config.maxTabs, 1, 100) || !integer(config.timeoutMs, 100, 10000) ||
      !integer(config.scenarioTimeoutMs, 1000, 120000) || !integer(config.observationWindowMs, 50, 2000) ||
      config.observationWindowMs > config.timeoutMs) return null;
  if (value.openKey !== 'Enter' && value.openKey !== 'Space') return null;
  if (value.closeKey !== 'Escape' || !Array.isArray(value.tabOrder) || !value.tabOrder.length || value.tabOrder.length > 100) return null;
  const byId = new Map<string, Target>();
  for (const target of [value.trigger, value.dialog, value.initialFocus, ...value.tabOrder, value.returnFocus]) {
    if (!object(target) || typeof target.id !== 'string' || !ID.test(target.id) || !object(target.locator)) return null;
    for (const method of ['count', 'page', 'elementHandles', 'isVisible', 'and', 'getAttribute']) {
      if (typeof target.locator[method] !== 'function') return null;
    }
    if (byId.has(target.id) && byId.get(target.id) !== target) return null;
    byId.set(target.id, target as Target);
  }
  if (byId.size > 100 || new Set(value.tabOrder).size !== value.tabOrder.length) return null;
  const actions = config.maxTabs + 2 * value.tabOrder.length + 3;
  if (actions > 500 || 9 + 2 * (2 * value.tabOrder.length + 1) > 5000) return null;
  // Snapshot the contract so asynchronous user changes cannot alter the planned sequence.
  const copies = new Map([...byId.values()].map(target => [target, Object.freeze({ id: target.id, locator: target.locator })]));
  const copy = (target: unknown) => copies.get(target as Target)!;
  const contract: DialogContract = Object.freeze({ id: value.id,
    contractVersion: (value.contractVersion as string | undefined) ?? '1',
    trigger: copy(value.trigger), dialog: copy(value.dialog), initialFocus: copy(value.initialFocus),
    returnFocus: copy(value.returnFocus), openKey: value.openKey, closeKey: value.closeKey,
    tabOrder: Object.freeze(value.tabOrder.map(copy)) });
  return { contract, config: config as AppliedConfig, targets: [...copies.values()] };
}
