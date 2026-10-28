import type { CheckResult, DialogContract, Target } from '../contracts/types.js';

export type Transition = { direction: 'forward' | 'backward'; index: number; target: Target; focusCheck: string; boundaryCheck: string };
export function planDialog(contract: DialogContract): { checks: CheckResult[]; transitions: Transition[] } {
  const checks: CheckResult[] = [];
  const add = (checkId: string, ruleId: string, expected: CheckResult['expected']) => {
    checks.push({ checkId, ruleId, stepId: null, status: 'not_run', messageCode: 'NOT_RUN',
      expected, observed: {}, basis: ruleId === 'D02' || ruleId === 'D05' ? 'apg_guidance' : 'contract',
      guidanceUrl: 'https://www.w3.org/WAI/ARIA/apg/patterns/dialog-modal/' });
  };
  add('D01.entry', 'D01', { focus: contract.trigger.id });
  add('D02.visible', 'D02', { visible: true });
  add('D02.role', 'D02', { role: 'dialog' });
  add('D02.name', 'D02', { hasAccessibleName: true });
  add('D02.modal', 'D02', { modal: true });
  add('D03.initial', 'D03', { focus: contract.initialFocus.id });
  add('D05.initial', 'D05', { inside: true });
  const transitions: Transition[] = [];
  const order = contract.tabOrder;
  let position = order.indexOf(contract.initialFocus);
  const forward = order.length + (position === -1 ? 1 : 0);
  for (const direction of ['forward', 'backward'] as const) {
    const count = direction === 'forward' ? forward : order.length;
    for (let index = 0; index < count; index++) {
      position = (position + (direction === 'forward' ? 1 : -1) + order.length) % order.length;
      const target = order[position]!;
      const suffix = `${direction}.${String(index + 1).padStart(3, '0')}`;
      const focusCheck = `D04.${suffix}`, boundaryCheck = `D05.${suffix}`;
      add(focusCheck, 'D04', { focus: target.id });
      add(boundaryCheck, 'D05', { inside: true });
      transitions.push({ direction, index, target, focusCheck, boundaryCheck });
    }
  }
  add('D05.before-close', 'D05', { inside: true });
  add('D06.closed', 'D06', { visible: false });
  add('D07.returned', 'D07', { focus: contract.returnFocus.id });
  return { checks, transitions };
}
