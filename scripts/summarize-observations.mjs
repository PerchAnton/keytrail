import { readFile } from 'node:fs/promises';

// Read-only diagnostics for CI artifacts, including failed canary journeys.
// Host and browser clocks have different origins; compare durations only.
export function summarizeObservations(report) {
  const tests = [];
  function walk(suite) {
    for (const spec of suite.specs ?? []) for (const test of spec.tests ?? []) {
      for (const attempt of test.results ?? []) {
        const attachment = name => {
          const a = (attempt.attachments ?? []).find(a => a.name === name);
          return a?.body ? JSON.parse(Buffer.from(a.body, 'base64').toString('utf8')) : undefined;
        };
        const journey = attachment('journey-result.json');
        const timings = attachment('snapshot-timings.json');
        const windows = (journey?.checks ?? []).filter(c => c.checkId.endsWith('.unchanged'));
        if (!windows.length && !timings) continue;
        const readings = (timings?.readings ?? []).filter(r => r.window !== undefined && r.intervalMs !== undefined);
        const slowest = [...readings].sort((a, b) => b.intervalMs - a.intervalMs).slice(0, 3).map(r => {
          const callbacks = (r.resolutions ?? []).filter(s => s.browserStartedAt !== undefined && s.browserFinishedAt !== undefined);
          return { window: r.window, intervalMs: r.intervalMs, snapshotMs: r.durationMs,
            hostGapBeforeMs: r.hostGapBeforeMs,
            dispatchSpanMs: r.resolutions?.length ? Math.max(...r.resolutions.map(s => s.startedMs)) - Math.min(...r.resolutions.map(s => s.startedMs)) : null,
            longestResolutionMs: r.resolutionMs.length ? Math.max(...r.resolutionMs) : null,
            browserCallbackSpanMs: callbacks.length ? Math.max(...callbacks.map(s => s.browserFinishedAt)) - Math.min(...callbacks.map(s => s.browserStartedAt)) : null,
            longestBrowserCallbackMs: callbacks.length ? Math.max(...callbacks.map(s => s.browserFinishedAt - s.browserStartedAt)) : null };
        });
        tests.push({ title: spec.title, status: attempt.status, retry: attempt.retry,
          outcome: journey?.outcome, timingAttachment: !!timings,
          failure: journey?.checks.find(c => c.status === 'fail' || c.status === 'blocked')?.messageCode,
          windows: windows.filter(c => c.observed.observationCount !== undefined).map(c => ({
            checkId: c.checkId, status: c.status, samples: c.observed.observationCount,
            durationMs: c.observed.observationWindowMs, gapMs: c.observed.maxObservationGapMs })),
          slowest, host: timings?.host });
      }
    }
    for (const child of suite.suites ?? []) walk(child);
  }
  for (const suite of report.suites ?? []) walk(suite);
  return { scope: 'Diagnostic durations only; this summary neither changes results nor certifies acceptance.',
    stats: report.stats, failedTests: tests.filter(t => t.status !== 'passed'), tests };
}

if (process.argv[1] && import.meta.url === new URL(process.argv[1], 'file:').href) {
  if (process.argv.length !== 3) throw new Error('Usage: node scripts/summarize-observations.mjs report.json');
  console.log(JSON.stringify(summarizeObservations(JSON.parse(await readFile(process.argv[2], 'utf8'))), null, 2));
}
