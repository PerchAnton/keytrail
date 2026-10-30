# Verification

**Development verification:** The default repeatability check runs four full rounds and a separate four-worker comparison. Final 100-round acceptance and release performance evidence are deferred until the candidate is frozen; [protocol and retained results](reliability.md). Ordinary CI checks the real package and clean consumers without claiming final acceptance.

The current source candidate is `0.1.0-alpha.6`, ruleset 0.4.0, schema 1.
Measurements use synthetic fixtures, not customer data. A passing regression test
may deliberately observe a failed or blocked journey; it does not mean that its
component is accessible.

| Check | Recorded result |
| --- | --- |
| TypeScript | Strict library, integration and benchmark checks passed |
| Unit tests | 39 passed, including verification-mode and resume-boundary checks |
| Browser suite | Historical `6a9cc6a`: 167/167 in each of four local rounds; hosted results are separated below; no retries |
| Worker isolation | Historical `6a9cc6a`: 167/167 on four local workers; matching semantic signatures; 800 distinct journey IDs across all five runs |
| Canary isolation | Six cases: successful and exceptional paths for each scenario; five distinct markers |
| Handle lifetime | Coherent focus, re-resolution after replacement, late sibling cleanup after an early error |
| CI guard | 52 actual subprocess exit-code cases; [record](evidence/ci-guard.json) |
| Performance | Historical `0300552`: 108/108 tests; median paired overhead: dialog 8.4%, manual tabs 0.8%, forms (`insertText`) 4.6%; [historical samples](performance.md) |
| Repeatability | Historical runtime at `6a9cc6a`: 4 × 167 = 668, plus 167 four-worker checks; [development proof](evidence/development-window-reads.json). Final 100-round acceptance is deferred; historical `0300552`: 100/100; [source-bound proof](evidence/reliability.json) |
| Package consumers | Development package checks run independently of final evidence. Historical `0300552`: two clean offline installations; ESM/CJS declarations; vanilla: 6 browser tests + 3 guarded journeys; React: 3 browser tests + 1 guarded journey + expected exit-1 control. The exact archive and result are recorded by `pnpm test:package` |
| Hosted platforms | Prior ARM and Intel macOS runs have real gaps; private-store validation on both images is pending. Linux passed all stages at `8ce3b66`. [Comparison](ci-concurrency.md) |

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

The historical proof and [version-bound policy](evidence/acceptance-policy.json) agree
on the source hashes at `0300552`, 100 completed rounds and the final isolation signature.
The 101 raw reports contain 16,463 test executions, including 303 engine-only
tests without a journey attachment. All 16,160 journey IDs are distinct.

The canary tests inspect only KeyTrail's own JSON, messages and stdout/stderr.
External Playwright artifacts are outside that guarantee. Budget, focus-loss and
no-action-after-return regressions execute in each full round.

The source now resolves locators into a private browser map on every observation,
reads focus and containment together, and clears stored nodes before returning.
It waits for sibling reads even on failure and disposes the map at journey end.
No target binding is cached; [mechanism and regressions](ci-concurrency.md).
The earlier repeatability evidence is historical for this changed runtime.

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
The [report guide](reports.md) explains the saved artifacts. The changed observation transport requires its own short development evidence. Consumer checks remain additional
evidence, not extra sequential rounds.
No npm package or GitHub release has been published; see the [release checklist](release-checklist.md).
