import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ObservationWindow } from '../../artifacts/unit/observationWindow.js';

test('negative observations require two readings spanning the window', () => {
  const window = new ObservationWindow(); window.add(800);
  assert.equal(window.complete(0), false); assert.equal(window.complete(50), false);
  window.add(849); assert.equal(window.complete(50), false);
  window.add(850); assert.equal(window.complete(50), true);
  assert.deepEqual(window.observed(), { observationWindowMs: 50, observationCount: 3,
    observationIntervalsMs: [49, 1], maxObservationGapMs: 49 });
});
test('100 ms gaps are allowed but larger gaps remain blocked after later samples', () => {
  const window = new ObservationWindow(); window.add(0); window.add(100);
  assert.equal(window.complete(100), true); window.add(200.125);
  assert.equal(window.gap, true); window.add(201);
  assert.equal(window.complete(200), false);
  assert.deepEqual(window.observed().observationIntervalsMs, [100, 100.125, 0.875]);
});
test('alternating fast and slow readings retain every actual interval', () => {
  const window = new ObservationWindow();
  for (const at of [0, 12, 110.5, 120, 219.5]) window.add(at);
  assert.equal(window.complete(200), true);
  assert.deepEqual(window.observed().observationIntervalsMs, [12, 98.5, 9.5, 99.5]);
  window.add(320);
  assert.equal(window.gap, true, 'An actual slow reading still blocks');
  assert.equal(window.complete(200), false);
});
