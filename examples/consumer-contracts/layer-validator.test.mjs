import test from 'node:test';
import assert from 'node:assert/strict';
import { validateLayerReport } from './layer-prototype.mjs';

const report = () => {
  const state = { focus: 'show-notice', dialogs: 1, notices: 0 };
  return { schema: 'consumer-layers-experiment-1', limitMs: 100, windowMs: 150,
    planned: 1, outcome: 'passed', steps: [{ id: 'step-1', key: 'Enter', status: 'passed', code: 'OK', expected: state,
      samples: [0, 50, 100, 150].map(atMs => ({ atMs, gapMs: atMs ? 50 : 0, state })) }] };
};
test('the experimental validator accepts measured coverage and rejects fabricated passes', () => {
  assert.equal(validateLayerReport(report()).outcome, 'passed');
  for (const corrupt of [
    r => { r.steps[0].samples[2].atMs = 120; },
    r => { r.steps[0].samples.pop(); },
    r => { r.steps[0].samples[1].state = { focus: 'unknown', dialogs: 1, notices: 0 }; },
    r => { r.steps[0].samples[1].extra = true; },
    r => { r.steps[0].id = 'step-2'; },
    r => { r.planned = 2; },
    r => { r.steps[0].samples[0].state.focus = 'made-up-focus'; },
    r => { r.steps[0].samples[0].state.dialogs = 2; },
  ]) {
    const changed = report(); corrupt(changed);
    assert.throws(() => validateLayerReport(changed));
  }
});
