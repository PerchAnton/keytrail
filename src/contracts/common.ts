import type { AppliedConfig, Target } from './types.js';

export const DEFAULTS: Readonly<AppliedConfig> = Object.freeze({
  maxTabs: 25, timeoutMs: 2000, scenarioTimeoutMs: 30000, observationWindowMs: 200,
});
export const ID = /^[a-z][a-z0-9_-]{0,63}$/;
export const object = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x);
const integer = (x: unknown, min: number, max: number): x is number =>
  typeof x === 'number' && Number.isInteger(x) && x >= min && x <= max;

/** Validate trusted test-code configuration before any browser actions. */
export function validateCommon(value: unknown): { config: AppliedConfig } | null {
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
  return { config: config as AppliedConfig };
}

export function snapshotTargets(values: readonly unknown[]): Map<Target, Target> | null {
  const byId = new Map<string, Target>();
  for (const target of values) {
    if (!object(target) || typeof target.id !== 'string' || !ID.test(target.id) || !object(target.locator)) return null;
    for (const method of ['count', 'page', 'elementHandles', 'isVisible', 'and', 'getAttribute']) {
      if (typeof target.locator[method] !== 'function') return null;
    }
    if (byId.has(target.id) && byId.get(target.id) !== target) return null;
    byId.set(target.id, target as Target);
  }
  if (byId.size > 100) return null;
  return new Map([...byId.values()].map(target => [target, Object.freeze({ id: target.id, locator: target.locator })]));
}
