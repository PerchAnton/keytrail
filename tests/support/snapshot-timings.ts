import type { Page, TestInfo } from '@playwright/test';
import { Driver } from '../../src/browser/driver.js';
import { ObservationWindow } from '../../src/engine/observation-window.js';

type Reading = { durationMs: number; evaluateMs: number; observedAt?: number;
  window?: number; intervalMs?: number };

/** Opt-in test diagnostics; never change a reading, interval, deadline or result. */
export function recordSnapshotTimings(page: Page, info: TestInfo): (() => Promise<void>) | undefined {
  if (process.env.KEYTRAIL_PROFILE_SNAPSHOTS !== '1') return;
  const readings: Reading[] = [];
  const elapsed = (start: bigint) => Number(process.hrtime.bigint() - start) / 1e6;
  const snapshot = Driver.prototype.snapshot, evaluate = page.evaluate, add = ObservationWindow.prototype.add;
  let active: Reading | undefined, nextWindow = 0;
  const windows = new WeakMap<ObservationWindow, { id: number; last: number }>();
  Driver.prototype.snapshot = async function () {
    if (this.page !== page) return snapshot.call(this);
    const start = process.hrtime.bigint(), reading: Reading = { durationMs: 0, evaluateMs: 0 };
    active = reading;
    try {
      const state = await snapshot.call(this);
      reading.observedAt = state.observedAt;
      return state;
    } finally { reading.durationMs = elapsed(start); readings.push(reading); active = undefined; }
  };
  page.evaluate = (async (...args: Parameters<typeof page.evaluate>) => {
    const start = process.hrtime.bigint();
    try { return await evaluate.apply(page, args); }
    finally { if (active) active.evaluateMs += elapsed(start); }
  }) as typeof page.evaluate;
  ObservationWindow.prototype.add = function (at) {
    add.call(this, at);
    const previous = windows.get(this), reading = readings.at(-1);
    const id = previous?.id ?? ++nextWindow;
    if (reading?.observedAt === at) {
      reading.window = id;
      if (previous) reading.intervalMs = at - previous.last;
    }
    windows.set(this, { id, last: at });
  };
  return async () => {
    Driver.prototype.snapshot = snapshot; page.evaluate = evaluate; ObservationWindow.prototype.add = add;
    await info.attach('snapshot-timings.json', { contentType: 'application/json', body: JSON.stringify({
      fixture: info.title, workerIndex: info.workerIndex, attempt: info.retry,
      clock: 'Host durations use hrtime; window intervals use browser performance.now.', readings,
    }) });
  };
}
