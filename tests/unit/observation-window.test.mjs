import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ObservationWindow, observationPauseMs } from '../../artifacts/unit/observationWindow.js';

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
test('slow browser reads do not receive an avoidable extra 20 ms gap', () => {
  const fixed = new ObservationWindow(); fixed.add(0); fixed.add(85 + 20);
  assert.equal(fixed.gap, true);
  const adaptive = new ObservationWindow(); adaptive.add(0);
  adaptive.add(85 + observationPauseMs(85));
  assert.equal(adaptive.gap, false);
  assert.equal(40 + observationPauseMs(40), 50);
  assert.equal(observationPauseMs(10), 20);
  assert.equal(observationPauseMs(150), 1);
  adaptive.add(300);
  assert.equal(adaptive.gap, true, 'Scheduling cannot excuse a real observation gap');
});
