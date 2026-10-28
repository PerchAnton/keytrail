import type { AppliedConfig, TabsContract, Target } from './types.js';
import { object, validateCommon, snapshotTargets } from './common.js';

export type ValidatedTabs = { contract: TabsContract; config: AppliedConfig; targets: Target[] };
export function validateTabs(value: unknown): ValidatedTabs | null {
  const common = validateCommon(value);
  if (!common || !object(value) || !Array.isArray(value.items) || value.items.length < 2 || value.items.length > 49) return null;
  if (value.orientation !== 'horizontal' && value.orientation !== 'vertical') return null;
  if (value.homeEnd !== undefined && typeof value.homeEnd !== 'boolean') return null;
  if (value.activation === 'automatic') { if (value.activationKey !== undefined) return null; }
  else if (value.activation !== 'manual' || !['Enter', 'Space'].includes(value.activationKey as string)) return null;
  if (!value.items.every(object)) return null;
  const members = value.items.flatMap(item => [item.tab, item.panel]);
  if (new Set(members).size !== members.length) return null;
  const copies = snapshotTargets([value.tablist, ...members, value.nextTabStop]);
  if (!copies || typeof value.initialTabId !== 'string' || !value.items.some(item => (item.tab as Target).id === value.initialTabId)) return null;
  if (members.includes(value.tablist)) return null;
  if (value.nextTabStop === value.tablist || value.items.some(item => item.tab === value.nextTabStop)) return null;
  const maxTransitions = 2 * value.items.length + (value.homeEnd ? 2 + value.items.length - 1 : 0);
  if (common.config.maxTabs + maxTransitions * (value.activation === 'manual' ? 2 : 1) + 1 > 500) return null;
  const copy = (target: unknown) => copies.get(target as Target)!;
  const base = { id: value.id as string, contractVersion: (value.contractVersion as string | undefined) ?? '1',
    tablist: copy(value.tablist), nextTabStop: copy(value.nextTabStop), initialTabId: value.initialTabId,
    orientation: value.orientation as TabsContract['orientation'], homeEnd: value.homeEnd ?? false,
    items: Object.freeze(value.items.map(item => Object.freeze({ tab: copy(item.tab), panel: copy(item.panel) }))) };
  const contract = Object.freeze({ ...base, ...(value.activation === 'manual' ?
    { activation: 'manual' as const, activationKey: value.activationKey as 'Enter' | 'Space' } : { activation: 'automatic' as const }) });
  return { contract, config: common.config, targets: [...copies.values()] };
}
