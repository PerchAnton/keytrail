import { test } from 'node:test';
import assert from 'node:assert/strict';
import { validateFormErrors } from '../../artifacts/unit/formValidation.js';
import { planFormErrors } from '../../artifacts/unit/formPlan.js';
const target = id => ({ id, locator: { page() {}, count() {}, elementHandles() {}, isVisible() {}, and() {}, getAttribute() {} } });
function base() {
  const fields = [target('field-a'), target('field-b')], submit = target('submit');
  return { id: 'form-errors', form: target('form'), submit, submitKey: 'Enter',
    errors: fields.map((field, i) => ({ field, message: target(`error-${i}`), via: 'aria-describedby', expectedText: /Error/i })),
    focusAfterInvalid: { policy: 'firstInvalid', target: fields[0] },
    correction: fields.map(field => ({ field, value: 'synthetic' })), validateCorrection: 'live' };
}
test('forms snapshot inputs, shared targets, regular expressions and correction order', () => {
  const input = base(), valid = validateFormErrors(input); assert.ok(valid);
  input.errors[0].expectedText.compile('Changed'); input.correction[0].value = 'changed'; input.errors.reverse();
  assert.equal(valid.contract.errors[0].expectedText.source, 'Error'); assert.equal(valid.contract.correction[0].value, 'synthetic');
  assert.equal(valid.contract.errors[0].field, valid.contract.focusAfterInvalid.target);
  assert.equal(valid.contract.errors[0].field, valid.contract.correction[0].field);
});
test('forms reject wrong focus policies, incomplete correction and stateful patterns', () => {
  for (const mutate of [c => c.errors = [], c => c.correction.pop(), c => c.correction[1] = c.correction[0],
    c => c.errors.push(c.errors[0]), c => c.errors[0].expectedText = /x/g, c => c.errors[0].expectedText = /x/y,
    c => c.errors[0].expectedText = '  ', c => c.errors[0].via = 'title', c => c.correction[0].value = 'a'.repeat(257),
    c => c.correction[0].value = 42, c => c.submitKey = 'Tab', c => c.validateCorrection = 'callback',
    c => c.focusAfterInvalid.target = c.submit, c => c.focusAfterInvalid.policy = 'stay',
    c => c.summaryLinks = [{ link: target('link'), field: target('unknown') }],
    c => c.errors[0].message = c.errors[0].field, c => c.errors[0].field = c.submit]) {
    const c = base(); mutate(c); assert.equal(validateFormErrors(c), null);
  }
});
test('forms allow empty replacement and count Unicode code points', () => {
  const c = base(); c.correction[0].value = ''; c.correction[1].value = '🧭'.repeat(256);
  assert.ok(validateFormErrors(c)); c.correction[1].value += 'x'; assert.equal(validateFormErrors(c), null);
});
test('forms limit arrays before reading entries', () => {
  const c = base(); c.errors = Array(21); Object.defineProperty(c.errors, 0, { get() { throw Error('Should not read'); } });
  assert.equal(validateFormErrors(c), null);
});
test('forms preplan links, values and clearing with mode-specific steps', () => {
  const c = base(); const live = planFormErrors(c);
  assert.equal(new Set(live.map(x => x.checkId)).size, live.length);
  assert.ok(live.every(x => x.status === 'not_run' && x.messageCode === 'NOT_RUN'));
  assert.equal(live.filter(x => x.checkId.endsWith('.blur')).length, 2);
  c.validateCorrection = 'resubmit'; c.summaryLinks = [{ link: target('link'), field: c.errors[0].field }];
  const resubmit = planFormErrors(c);
  assert.equal(resubmit.filter(x => x.checkId.endsWith('.blur')).length, 0);
  assert.ok(resubmit.some(x => x.checkId === 'F06.resubmit')); assert.equal(resubmit.filter(x => x.ruleId === 'F05').length, 2);
  assert.ok(!JSON.stringify(resubmit).includes('synthetic'));
});

test('forms accept exactly twenty fields and reject an additional one', () => {
  const c = base(); const fields = Array.from({ length: 20 }, (_, i) => target(`field-${i}`));
  c.errors = fields.map((field, i) => ({ field, message: target(`error-${i}`), via: 'aria-errormessage', expectedText: 'Error' }));
  c.correction = fields.map(field => ({ field, value: 'valid' })); c.focusAfterInvalid.target = fields[0];
  assert.ok(validateFormErrors(c)); c.errors.push(c.errors[0]); assert.equal(validateFormErrors(c), null);
});

test('forms allow multiple unique summary links per field within the common target limit', () => {
  const c = base(); c.summaryLinks = Array.from({ length: 21 }, (_, i) => ({ link: target(`link-${i}`), field: c.errors[0].field }));
  assert.ok(validateFormErrors(c));
  c.summaryLinks = Array.from({ length: 100 }, (_, i) => ({ link: target(`link-${i}`), field: c.errors[0].field }));
  assert.equal(validateFormErrors(c), null);
});

test('forms validate keyboard mode before any action and preserve the insertion default', () => {
  assert.equal(validateFormErrors(base()).config.inputMode, 'insertText');
  const c = base(); c.inputMode = 'type'; c.correction[0].value = 'Az09 +!?~';
  assert.equal(validateFormErrors(c).config.inputMode, 'type');
  for (const unsupported of ['café', '🧭', 'line\nbreak', '\t', '\x7f']) {
    c.correction[0].value = unsupported; assert.equal(validateFormErrors(c), null);
  }
  c.inputMode = 'paste'; assert.equal(validateFormErrors(c), null);
});
