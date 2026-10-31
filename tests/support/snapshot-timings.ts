import type { Locator, Page, TestInfo } from '@playwright/test';
import { cpus, loadavg } from 'node:os';
import { performance as hostPerformance, PerformanceObserver, type PerformanceEntry } from 'node:perf_hooks';
import { Driver } from '../../src/browser/driver.js';
import { ObservationWindow } from '../../src/engine/observation-window.js';

type Resolution = { startedMs: number; finishedMs: number; browserStartedAt?: number; browserFinishedAt?: number };
type Reading = { startedMs: number; finishedMs: number; hostGapBeforeMs: number; durationMs: number;
  evaluateMs: number; resolutionMs: number[]; resolutions: Resolution[]; observedAt?: number;
  window?: number; intervalMs?: number; hostPerformanceStartedAt: number; hostPerformanceFinishedAt: number;
  hostActiveMs: number; hostIdleMs: number; cpuUserMs: number; cpuSystemMs: number };

/** Opt-in test diagnostics; never change a reading, interval, deadline or result. */
export function recordSnapshotTimings(page: Page, info: TestInfo): (() => Promise<void>) | undefined {
  if (process.env.KEYTRAIL_PROFILE_SNAPSHOTS !== '1') return;
  const readings: Reading[] = [];
  const origin = process.hrtime.bigint(), cpuBefore = process.cpuUsage(), loadBefore = loadavg();
  // A regression deliberately replaces info.attach to exercise report failures.
  // Keep the diagnostic sink independent from that injected journey failure.
  const attach = info.attach.bind(info);
  const gc: { startedAt: number; durationMs: number; kind: number | undefined }[] = [];
  const recordGC = (entries: PerformanceEntry[]) => {
    for (const entry of entries) gc.push({ startedAt: entry.startTime, durationMs: entry.duration,
      kind: (entry as PerformanceEntry & { detail?: { kind?: number } }).detail?.kind });
  };
  const observer = new PerformanceObserver(list => recordGC(list.getEntries()));
  observer.observe({ entryTypes: ['gc'] });
  const elapsed = (start: bigint) => Number(process.hrtime.bigint() - start) / 1e6;
  const hostNow = () => elapsed(origin);
  const snapshot = Driver.prototype.snapshot, evaluate = page.evaluate, add = ObservationWindow.prototype.add;
  const locatorPrototype = Object.getPrototypeOf(page.locator('body')) as Locator;
  const evaluateAll = locatorPrototype.evaluateAll;
  const wrappers = new Map<string, Function>();
  let active: Reading | undefined, nextWindow = 0;
  const windows = new WeakMap<ObservationWindow, { id: number; last: number }>();
  Driver.prototype.snapshot = async function (...args) {
    if (this.page !== page) return snapshot.apply(this, args);
    const start = process.hrtime.bigint(), startedMs = hostNow();
    const utilization = hostPerformance.eventLoopUtilization(), cpu = process.cpuUsage();
    const reading: Reading = { startedMs, finishedMs: 0,
      hostGapBeforeMs: readings.length ? startedMs - readings.at(-1)!.finishedMs : 0,
      durationMs: 0, evaluateMs: 0, resolutionMs: [], resolutions: [],
      hostPerformanceStartedAt: hostPerformance.now(), hostPerformanceFinishedAt: 0,
      hostActiveMs: 0, hostIdleMs: 0, cpuUserMs: 0, cpuSystemMs: 0 };
    active = reading;
    try {
      const state = await snapshot.apply(this, args);
      reading.observedAt = state.observedAt;
      return state;
    } finally {
      reading.durationMs = elapsed(start); reading.finishedMs = hostNow();
      reading.hostPerformanceFinishedAt = hostPerformance.now();
      const loop = hostPerformance.eventLoopUtilization(utilization), used = process.cpuUsage(cpu);
      reading.hostActiveMs = loop.active; reading.hostIdleMs = loop.idle;
      reading.cpuUserMs = used.user / 1000; reading.cpuSystemMs = used.system / 1000;
      readings.push(reading); active = undefined;
    }
  };
  page.evaluate = (async (...args: Parameters<typeof page.evaluate>) => {
    const start = process.hrtime.bigint();
    try { return await evaluate.apply(page, args); }
    finally { if (active) active.evaluateMs += elapsed(start); }
  }) as typeof page.evaluate;
  locatorPrototype.evaluateAll = (async function (this: Locator, ...args: Parameters<Locator['evaluateAll']>) {
    const reading = this.page() === page ? active : undefined, start = process.hrtime.bigint();
    if (!reading) return evaluateAll.apply(this, args);
    const resolution: Resolution = { startedMs: hostNow(), finishedMs: 0 };
    try {
      // The original callback already has to be self-contained for Playwright.
      // Wrap only that callback, not selector resolution, with browser-clock
      // timestamps. Keep clocks separate and return its exact original value.
      const source = args[0].toString();
      let wrapper = wrappers.get(source);
      if (!wrapper) {
        wrapper = new Function('nodes', 'arg', `const browserStartedAt = performance.now();
          const value = (${source})(nodes, arg);
          return { value, browserStartedAt, browserFinishedAt: performance.now() };`);
        wrappers.set(source, wrapper);
      }
      const measured = await evaluateAll.call(this, wrapper as (nodes: Element[], arg: unknown) => {
        value: unknown; browserStartedAt: number; browserFinishedAt: number;
      }, args[1]) as { value: unknown; browserStartedAt: number; browserFinishedAt: number };
      resolution.browserStartedAt = measured.browserStartedAt;
      resolution.browserFinishedAt = measured.browserFinishedAt;
      return measured.value;
    } finally {
      resolution.finishedMs = hostNow(); reading.resolutions.push(resolution);
      reading.resolutionMs.push(elapsed(start));
    }
  }) as Locator['evaluateAll'];
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
    locatorPrototype.evaluateAll = evaluateAll;
    Driver.prototype.snapshot = snapshot; page.evaluate = evaluate; ObservationWindow.prototype.add = add;
    recordGC(observer.takeRecords()); observer.disconnect();
    await attach('snapshot-timings.json', { contentType: 'application/json', body: JSON.stringify({
      fixture: info.title, workerIndex: info.workerIndex, attempt: info.retry,
      clock: 'Host durations use hrtime; window intervals use browser performance.now.',
      transport: 'Atomic read in final locator registration; evaluateMs counts separate page.evaluate calls only.', readings,
      host: { cpuMicroseconds: process.cpuUsage(cpuBefore), elapsedMs: hostNow(),
        loadAverageBefore: loadBefore, loadAverageAfter: loadavg(), logicalCpus: cpus().length },
      gc, gcClock: 'GC and hostPerformance timestamps use Node performance.now, never the browser clock.',
    }) });
  };
}
