import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateTabs } from '../../artifacts/unit/tabsValidation.js';
import { planTabs } from '../../artifacts/unit/tabsPlan.js';
const target = id => ({ id, locator: { page() {}, count() {}, evaluateAll() {}, isVisible() {}, and() {}, getAttribute() {} } });
function base() {
  const items = [0, 1, 2].map(i => ({ tab: target(`tab-${i}`), panel: target(`panel-${i}`) }));
  return { id: 'tabs', tablist: target('list'), items, initialTabId: 'tab-1', orientation: 'horizontal', activation: 'automatic', nextTabStop: items[1].panel };
}
test('tabs contract snapshots items and retains shared exit-panel identity', () => {
  const input = base(), result = validateTabs(input);
  assert.ok(result); assert.equal(result.contract.nextTabStop, result.contract.items[1].panel);
  input.items.reverse(); input.items[0].tab.id = 'changed';
  assert.equal(result.contract.items[0].tab.id, 'tab-0'); assert.equal(result.contract.homeEnd, false);
});
test('tabs reject unsupported configurations before creating a journey', () => {
  for (const fields of [{ items: [] }, { items: [base().items[0]] }, { orientation: 'rtl' }, { initialTabId: 'missing' },
    { activation: 'automatic', activationKey: 'Enter' }, { activation: 'manual' }, { activation: 'manual', activationKey: 'Tab' },
    { homeEnd: 1 }, { homeEnd: null }, { timeoutMs: null }]) assert.equal(validateTabs({ ...base(), ...fields }), null);
  const contract = base(); contract.items.push(contract.items[0]); assert.equal(validateTabs(contract), null);
  const inside = base(); inside.nextTabStop = inside.items[0].tab; assert.equal(validateTabs(inside), null);
});
test('tabs reject an oversized item array before reading its entries', () => {
  const items = Array(50); Object.defineProperty(items, 0, { get() { throw Error('Should not read'); } });
  assert.equal(validateTabs({ ...base(), items }), null);
});
test('tabs plan wraps both directions and omits optional keys entirely', () => {
  const plan = planTabs(base());
  assert.deepEqual(plan.transitions.map(t => t.target.id), ['tab-2', 'tab-0', 'tab-1', 'tab-0', 'tab-2', 'tab-1']);
  assert.ok(plan.checks.every(c => c.ruleId !== 'T08' && c.ruleId !== 'T05'));
  assert.equal(plan.checks.at(-1).checkId, 'T07.exit');
});
test('manual Home End plan restores the initial selection before exit', () => {
  const plan = planTabs({ ...base(), activation: 'manual', activationKey: 'Space', homeEnd: true, orientation: 'vertical' });
  assert.deepEqual(plan.transitions.slice(-4).map(t => [t.key, t.target.id]), [['Home', 'tab-0'], ['End', 'tab-2'], ['ArrowDown', 'tab-0'], ['ArrowDown', 'tab-1']]);
  assert.equal(plan.checks.filter(c => c.checkId.endsWith('.unchanged')).length, plan.transitions.length);
  assert.equal(new Set(plan.checks.map(c => c.checkId)).size, plan.checks.length);
});
