import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { validateDialog } from '../../artifacts/unit/validation.js';
import { planDialog } from '../../artifacts/unit/plan.js';
import { coverage, outcome } from '../../artifacts/unit/result.js';

const target = id => ({ id, locator: { page() {}, count() {}, elementHandles() {}, isVisible() {}, and() {}, getAttribute() {} } });
function base() {
  const trigger = target('open'), name = target('name'), save = target('save');
  return { id: 'profile', trigger, returnFocus: trigger, dialog: target('dialog'),
    openKey: 'Enter', closeKey: 'Escape', initialFocus: name, tabOrder: [name, save] };
}
test('defaults and shared Target identity are preserved in an isolated snapshot', () => {
  const input = base();
  const result = validateDialog(input);
  assert.ok(result);
  assert.deepEqual(result.config, { maxTabs: 25, timeoutMs: 2000, scenarioTimeoutMs: 30000, observationWindowMs: 200 });
  assert.equal(result.contract.trigger, result.contract.returnFocus);
  input.trigger.id = 'mutated'; input.tabOrder.reverse();
  assert.equal(result.contract.trigger.id, 'open');
  assert.equal(result.contract.tabOrder[0].id, 'name');
});
test('rejects invalid identifiers, bounds, keys and explicit null', () => {
  const invalid = [{ id: 'bad name' }, { id: 'A' }, { id: 'a'.repeat(65) }, { timeoutMs: null },
    { timeoutMs: 99 }, { timeoutMs: 10001 }, { timeoutMs: '2000' }, { timeoutMs: Infinity },
    { scenarioTimeoutMs: 999 }, { scenarioTimeoutMs: 120001 }, { observationWindowMs: 49 },
    { observationWindowMs: 2001 }, { timeoutMs: 100, observationWindowMs: 200 },
    { entry: null }, { entry: { maxTabs: 0 } }, { entry: { maxTabs: null } },
    { entry: { maxTabs: 101 } }, { openKey: 'click' }, { closeKey: 'Enter' }, { tabOrder: [] }];
  for (const fields of invalid) assert.equal(validateDialog({ ...base(), ...fields }), null, JSON.stringify(fields));
});
test('rejects duplicate object IDs, repeated tab stops and too many targets', () => {
  const a = base();
  assert.equal(validateDialog({ ...a, returnFocus: { ...a.trigger } }), null);
  assert.equal(validateDialog({ ...a, tabOrder: [a.initialFocus, a.initialFocus] }), null);
  assert.equal(validateDialog({ ...a, tabOrder: Array.from({ length: 101 }, (_, n) => target(`item-${n}`)) }), null);
});
test('plans both directions including a single tab stop', () => {
  const a = base(); a.tabOrder = [a.initialFocus];
  const { checks, transitions } = planDialog(a);
  assert.deepEqual(transitions.map(t => [t.direction, t.target.id]), [['forward', 'name'], ['backward', 'name']]);
  assert.equal(checks.at(-1).checkId, 'D07.returned');
  assert.equal(new Set(checks.map(c => c.checkId)).size, checks.length);
  assert.ok(checks.every(c => c.status === 'not_run'));
});
test('static initial heading adds an entry Tab and still checks full wrap in both directions', () => {
  const a = base(); a.initialFocus = target('heading');
  const { transitions } = planDialog(a);
  assert.deepEqual(transitions.map(t => t.target.id), ['name', 'save', 'name', 'save', 'name']);
});
test('failure takes precedence over blocked while incomplete coverage remains visible', () => {
  const statuses = ['pass', 'fail', 'blocked', 'not_run'].map(status => ({ status }));
  const c = coverage(statuses, 'tab');
  assert.deepEqual(c, { planned: 4, passed: 1, failed: 1, blocked: 1, notRun: 1, complete: false, entryEvidence: 'tab' });
  assert.equal(outcome(c), 'failed');
  assert.equal(outcome(coverage([{ status: 'not_run' }], 'unreached')), 'blocked');
  assert.equal(outcome(coverage([], 'unreached')), 'blocked');
  assert.equal(outcome(coverage([{ status: 'pass' }], 'tab')), 'passed');
});
test('package and source version agree; published exports contain no future stubs', () => {
  const pkg = JSON.parse(readFileSync('package.json', 'utf8'));
  assert.match(readFileSync('src/version.ts', 'utf8'), new RegExp(pkg.version.replaceAll('.', '\\.')));
  assert.deepEqual(Object.keys(pkg.exports), ['.', './schema/journey-result.v1.json', './ci-guard']);
});

test('rejects incomplete locator implementations before browser work', () => {
  for (const method of ['count', 'page', 'elementHandles', 'isVisible', 'and', 'getAttribute']) {
    const contract = base();
    delete contract.trigger.locator[method];
    assert.equal(validateDialog(contract), null, method);
  }
});
test('rejects oversized tab order before iterating its entries', () => {
  const contract = base();
  const tabOrder = Array(101);
  Object.defineProperty(tabOrder, '0', { get() { throw new Error('Oversized input was traversed'); } });
  assert.equal(validateDialog({ ...contract, tabOrder }), null);
});
