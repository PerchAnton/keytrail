import type { AppliedConfig, DialogContract, Target } from './types.js';
import { object, validateCommon, snapshotTargets } from './common.js';
export { DEFAULTS, ID } from './common.js';
export type ValidatedDialog = { contract: DialogContract; config: AppliedConfig; targets: Target[] };

export function validateDialog(value: unknown): ValidatedDialog | null {
  const common = validateCommon(value);
  if (!common || !object(value)) return null;
  const { config } = common;
  if (value.openKey !== 'Enter' && value.openKey !== 'Space') return null;
  if (value.closeKey !== 'Escape' || !Array.isArray(value.tabOrder) || !value.tabOrder.length || value.tabOrder.length > 100) return null;
  if (new Set(value.tabOrder).size !== value.tabOrder.length) return null;
  const copies = snapshotTargets([value.trigger, value.dialog, value.initialFocus, ...value.tabOrder, value.returnFocus]);
  if (!copies) return null;
  const actions = config.maxTabs + 2 * value.tabOrder.length + 3;
  if (actions > 500 || 9 + 2 * (2 * value.tabOrder.length + 1) > 5000) return null;
  // Snapshot the contract so asynchronous user changes cannot alter the planned sequence.
  const copy = (target: unknown) => copies.get(target as Target)!;
  const contract: DialogContract = Object.freeze({ id: value.id as string,
    contractVersion: (value.contractVersion as string | undefined) ?? '1',
    trigger: copy(value.trigger), dialog: copy(value.dialog), initialFocus: copy(value.initialFocus),
    returnFocus: copy(value.returnFocus), openKey: value.openKey, closeKey: value.closeKey,
    tabOrder: Object.freeze(value.tabOrder.map(copy)) });
  return { contract, config, targets: [...copies.values()] };
}
