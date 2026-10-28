import type { CheckResult, StepResult, TabsContract, Target } from '../contracts/types.js';

export type TabsTransition = { key: NonNullable<StepResult['key']>; target: Target; index: number; suffix: string; focusCheck: string };
export function planTabs(contract: TabsContract) {
  const checks: CheckResult[] = [], transitions: TabsTransition[] = [];
  const add = (checkId: string, ruleId: string, expected: CheckResult['expected']) => checks.push({
    checkId, ruleId, expected, observed: {}, stepId: null, status: 'not_run', messageCode: 'NOT_RUN',
    basis: ['T02', 'T06'].includes(ruleId) ? 'apg_guidance' : 'contract',
    guidanceUrl: 'https://www.w3.org/WAI/ARIA/apg/patterns/tabs/' });
  add('T01.entry', 'T01', { focus: contract.initialTabId });
  add('T02.structure', 'T02', { matched: true });
  add('T02.role', 'T02', { role: 'tablist' });
  add('T02.name', 'T02', { hasAccessibleName: true });
  add('T02.orientation', 'T02', { orientation: contract.orientation });
  contract.items.forEach((item, index) => {
    const id = `T02.item.${String(index + 1).padStart(3, '0')}`;
    add(`${id}.tab-role`, 'T02', { role: 'tab' });
    add(`${id}.panel-role`, 'T02', { role: 'tabpanel' });
    add(`${id}.controls`, 'T02', { matched: true });
    add(`${id}.labelledby`, 'T02', { matched: true });
  });
  add('T06.initial', 'T06', { selected: contract.initialTabId, selectedCount: 1, visibleCount: 1, roving: true });
  let position = contract.items.findIndex(item => item.tab.id === contract.initialTabId);
  const initial = position, n = contract.items.length;
  const forward = contract.orientation === 'horizontal' ? 'ArrowRight' : 'ArrowDown';
  const backward = contract.orientation === 'horizontal' ? 'ArrowLeft' : 'ArrowUp';
  const move = (key: NonNullable<StepResult['key']>, index: number, suffix: string, rule = 'T03') => {
    const target = contract.items[index]!.tab;
    const focusCheck = `${rule}.${suffix}`;
    add(focusCheck, rule, { focus: target.id });
    add(`T06.${suffix}.roving`, 'T06', { roving: true });
    if (contract.activation === 'manual') add(`T05.${suffix}.unchanged`, 'T05', { selected: contract.items[position]!.tab.id, focus: target.id, roving: true });
    add(`${contract.activation === 'manual' ? 'T05' : 'T04'}.${suffix}.activated`, contract.activation === 'manual' ? 'T05' : 'T04', { selected: target.id });
    add(`T06.${suffix}.state`, 'T06', { selected: target.id, selectedCount: 1, visibleCount: 1, roving: true });
    transitions.push({ key, target, index, suffix, focusCheck });
    position = index;
  };
  for (const direction of ['forward', 'backward'] as const) for (let i = 0; i < n; i++) {
    move(direction === 'forward' ? forward : backward, (position + (direction === 'forward' ? 1 : -1) + n) % n,
      `${direction}.${String(i + 1).padStart(3, '0')}`);
  }
  if (contract.homeEnd) {
    move('Home', 0, 'home', 'T08'); move('End', n - 1, 'end', 'T08');
    let i = 0;
    while (position !== initial) move(forward, (position + 1) % n, `restore.${String(++i).padStart(3, '0')}`);
  }
  add('T06.final', 'T06', { selected: contract.initialTabId, selectedCount: 1, visibleCount: 1, roving: true });
  add('T07.exit', 'T07', { focus: contract.nextTabStop.id, inside: false });
  return { checks, transitions };
}
