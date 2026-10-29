# Equivalent-work benchmark

**Refresh pending:** the records below predate the final polling-cadence and
benchmark-diagnostics changes. The local verification job reruns measurements after
the 100-round series. These historical numbers do not clear the current release gate.

This benchmark measures three synthetic Chromium journeys: an ordinary custom ARIA
dialog, a horizontal manual-activation tab list, and a two-field form with live error
clearing using `inputMode: "insertText"`. The opt-in per-character `type` mode is
not measured by these samples. It measures overhead against a fixture-specific native Playwright reference.
It does not measure real-world adoption, WCAG conformance or screen-reader behavior.

## Recorded results — 29 October 2026

![Measured overhead and timings](assets/performance.svg)

| Workload | Native median / p95 (ms) | KeyTrail median / p95 (ms) | Median paired overhead | Ratio of medians |
| --- | --- | --- | --- | --- |
| Dialog | 294.9 / 305.0 | 315.9 / 332.6 | 8.4% | 7.1% |
| Manual tabs | 2369.2 / 2446.7 | 2328.9 / 2386.4 | 0.0% | -1.7% |
| Form errors (insertText) | 304.5 / 319.8 | 317.4 / 339.7 | 4.5% | 4.2% |

All three pass the 20% target under both calculations. Apple M3 (8 logical CPUs),
macOS arm64 / Darwin 27.2.0, Node 24.22.1, Playwright 1.64.1, Chromium 156.0.8078.4.
Raw pairs and source hashes: [dialog](evidence/benchmark-dialog.json),
[tabs](evidence/benchmark-tabs.json), [forms](evidence/benchmark-formErrors.json).
Values are rounded to one decimal place; the tabs paired median is -0.011% before
rounding. This near-zero difference does not establish a speed advantage.
The chart can be regenerated with `python scripts/render-performance.py` in a
Python environment containing Matplotlib; it is an optional documentation tool.

## What the reference does

Both arms use the same page, keyboard action sequence, target resolution, focus and
role observations, time/action budgets, manual-activation observation windows, and
JSON result attachment. Both manual-tabs implementations require initial/final
snapshots and enforce the 100 ms gap threshold using browser timestamps. Setup and page teardown are outside the measured interval.
The reference calls Playwright directly; it does not call KeyTrail's assertions,
driver, planner or serializer. Both arms validate the common report schema.

The [manifests](../benchmarks/manifests) were extracted once from verified fixture
traces and reviewed as fixed workloads. They specify the actions and expectations;
they contain no observed values or passing statuses. The reference reads the actual
browser state for each check. Every measured pair must agree on check IDs, statuses,
codes, expected/observed values, dependency references and action/focus traces, with
time and UUID fields excluded. A known defect per scenario must also produce the
same first failure and incomplete checks before measurements are accepted.

The native implementation supports only these three fixed fixtures. It is not a
second general-purpose journey library. Contract generality, unsupported modes and
fault handling are covered by KeyTrail's integration suite, not by these timing
samples. For a single short test, ordinary Playwright assertions may remain clearer.

## Protocol

Run on an otherwise idle machine with sleep disabled for the command:

```sh
pnpm build
pnpm benchmark
# macOS: caffeinate -is pnpm benchmark
```

Each arm has five warmups and 30 measured samples per scenario. Arm order alternates
AB/BA, with each arm first in 15 measured pairs. Each pair gets a fresh Playwright
test/context and each arm a new page. Measurements include contract setup, browser
work, report construction/validation and an identical in-memory attachment sink.
The sink checks the actual serialized result but excludes reporter filesystem I/O.
The real attachment path is covered separately by the integration and package tests.
There are 108 tests: three negative controls and 105 warmup/measurement pairs.

Median uses the average of the two middle values; p95 uses nearest rank. The primary
overhead is the median of the 30 paired percentages `(KeyTrail/native - 1) * 100`.
The ratio of the two medians is also published; the 20% target must pass under both
calculations. A fast result from one fixture does not offset a miss in another.
Raw pairs, versions, CPU and OS are retained with the summary.

Manual tabs deliberately include required negative observation windows. They dominate
elapsed time and can make percentage overhead look small; report milliseconds as
well. These measurements do not establish a universal speed advantage. A separate
machine, browser version or component can give different results.

An initial development experiment reused one Playwright test for all measurement
pairs. Accumulating internal step history distorted later measurements. Those numbers
were discarded before acceptance; this protocol resets that history for every pair.
