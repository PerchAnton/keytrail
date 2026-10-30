# Verification

**Verification refresh pending:** The changed 165-case suite passed on one worker on Linux and macOS. Two workers still produced three macOS observation gaps, so ordinary CI uses one worker; [measurements and limits](ci-concurrency.md). Existing 100-round and benchmark records belong to `0300552` and remain historical. A new source-bound 100-round series, benchmark and tarball check are required before the changed candidate can pass its release gate.

The current source candidate is `0.1.0-alpha.6`, ruleset 0.4.0, schema 1.
Measurements use synthetic fixtures, not customer data. A passing regression test
may deliberately observe a failed or blocked journey; it does not mean that its
component is accessible.

| Check | Recorded result |
| --- | --- |
| TypeScript | Strict library, integration and benchmark checks passed |
| Unit tests | 36 passed |
| Browser suite | Current source: 165/165 locally and on Linux/macOS with one worker; no retries |
| Worker isolation | Current source: 165/165 on four local workers; semantic signatures match the one-worker run; 320 distinct journey IDs across the pair, with five engine-only cases per run |
| Canary isolation | Six cases: successful and exceptional paths for each scenario; five distinct markers |
| Handle lifetime | Coherent focus, re-resolution after replacement, late sibling cleanup after an early error |
| CI guard | 52 actual subprocess exit-code cases; [record](evidence/ci-guard.json) |
| Performance | Historical `0300552`: 108/108 tests; median paired overhead: dialog 8.4%, manual tabs 0.8%, forms (`insertText`) 4.6%; [historical samples](performance.md) |
| Repeatability | Historical `0300552`: 100/100 complete rounds; current source requires a fresh series; [source-bound proof](evidence/reliability.json) |
| Package consumers | Pending for changed source. Historical `0300552`: two clean offline installations; ESM/CJS declarations; vanilla: 6 browser tests + 3 guarded journeys; React: 3 browser tests + 1 guarded journey + expected exit-1 control. The exact archive and result are recorded by `pnpm test:package` |
| Hosted platforms | One-worker browser suites pass on both platforms; macOS/two-worker gaps remain recorded. Full job success awaits refreshed package evidence. [Comparison](ci-concurrency.md) |

## Historical performance (`0300552`)

![Paired overhead and median/p95 timing results](assets/performance.svg)

Thirty alternating measured pairs per workload, after five warmups per arm.
The shared runner was an Apple M3 (8 logical CPUs), macOS arm64/Darwin 27.2.0,
Node 24.22.1, Playwright 1.64.1, Chromium 156.0.8078.4, on 29 October 2026 UTC
(30 October in Kyiv). The benchmark ran after the reliability series.
Every pair also passed semantic equivalence checks; three known defects agreed on
the first mismatch and dependent checks. Manual tabs include required observation
windows, which dominate duration. These figures do not establish a universal speed
advantage or replace checks in a consumer application.

## Repeatability and safety

[The full-suite protocol](reliability.md) retains every raw run, rejects retries,
checks attachment identity, and prevents combining different source/environment
snapshots. The earlier alpha.6 local series at `0300552` completed all 100 rounds and its four-worker
comparison on 29 October 2026 at 22:31 UTC. Its identity is
`191d2d89449e23a319e221949729f6d069d4c57acbb6a432056867bc159b0fed`.
Twelve completed earlier local rounds and the hosted attempts are retained separately
and are not added to the new total.
The historical alpha.5 record accepted 45 rounds and excluded its interrupted 46th
round; it remains history rather than evidence for the changed runtime.

The final proof and [version-bound policy](evidence/acceptance-policy.json) now agree
on current source hashes, 100 completed rounds and the final isolation signature.
The 101 raw reports contain 16,463 test executions, including 303 engine-only
tests without a journey attachment. All 16,160 journey IDs are distinct.

The canary tests inspect only KeyTrail's own JSON, messages and stdout/stderr.
External Playwright artifacts are outside that guarantee. Budget, focus-loss and
no-action-after-return regressions execute in each full round.

The source optimization overlaps independent browser reads. It still resolves
fresh handles for every observation, reads focus and containment together, waits
for all reads even on failure, and disposes temporary handles before returning.
The native benchmark reference also overlaps its independent reads.

## Reproduction

```sh
pnpm build
pnpm test:types
pnpm test:unit
pnpm test:guard
pnpm benchmark
pnpm verify:reliability
```

On macOS, prefix the long browser commands with `caffeinate -is` to prevent host
sleep. Run performance measurements without concurrent verification jobs. After
recording the resulting evidence in `docs/evidence/`, `pnpm test:package` checks
source hashes, packs the archive, installs it into two clean offline consumers,
checks ESM/CJS imports and declarations, and runs the vanilla and React examples.
React lockfile preparation fetches registry metadata before the separate frozen offline install.
Install the separate React lockfile first as described in the [release checklist](release-checklist.md).
Archive size/hash are written outside the package to avoid a
self-referential archive checksum.

[DEV08 history](verification-dev08.md) retains the earlier focused-repeat evidence,
including the diagnosed host-sleep timeouts and hosted outer-timeout correction.
DEV10 adds a React portal in development StrictMode, closes/remounts the dialog,
and verifies wrong initial and return focus. Its separate negative process does
not catch the assertion: exit 1, HTML, JUnit and the original incomplete attachment
are checked. Playwright classifies `JourneyAssertionError` as a JUnit `error`, so
both error and failure counts are considered; neither is treated as success.
The [report guide](reports.md) explains the saved artifacts. Alpha.6 has fresh runtime
evidence for its changed core and regression inputs. Consumer checks remain additional
evidence, not extra sequential rounds.
No npm package or GitHub release has been published; see the [release checklist](release-checklist.md).
