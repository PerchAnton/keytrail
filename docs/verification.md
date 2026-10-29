# Verification

The current source candidate is `0.1.0-alpha.6`, ruleset 0.4.0, schema 1.
Measurements use synthetic fixtures, not customer data. A passing regression test
may deliberately observe a failed or blocked journey; it does not mean that its
component is accessible.

| Check | Recorded result |
| --- | --- |
| TypeScript | Strict library, integration and benchmark checks passed |
| Unit tests | 35 passed |
| Browser suite | 163 cases; final local revision verification in progress; prior attempts are recorded in the repeatability protocol |
| Worker isolation | Final comparison pending after 100 sequential rounds; three engine-only tests per round |
| Canary isolation | Six cases: successful and exceptional paths for each scenario; five distinct markers |
| Handle lifetime | Coherent focus, re-resolution after replacement, late sibling cleanup after an early error |
| CI guard | 52 actual subprocess exit-code cases; [record](evidence/ci-guard.json) |
| Performance | Fresh source-bound measurements pending after the local series; [protocol and historical samples](performance.md) |
| Repeatability | Fresh local 100-round series pending; 12 earlier alpha.6 rounds are retained separately |
| Package consumers | Pending refresh for alpha.6: two clean offline installations; ESM/CJS declarations; vanilla: 6 browser tests + 3 guarded journeys; React: 3 browser tests + 1 guarded journey + expected exit-1 control |

## Performance

![Paired overhead and median/p95 timing results](assets/performance.svg)

Thirty alternating measured pairs per workload, after five warmups per arm.
The shared runner was an Apple M3 (8 logical CPUs), macOS arm64/Darwin 27.2.0,
Node 24.22.1, Playwright 1.64.1, Chromium 156.0.8078.4, on 29 October 2026.
Every pair also passed semantic equivalence checks; three known defects agreed on
the first mismatch and dependent checks. Manual tabs include required observation
windows, which dominate duration. These figures do not establish a universal speed
advantage or replace checks in a consumer application.

## Repeatability and safety

[The full-suite protocol](reliability.md) retains every raw run, rejects retries,
checks attachment identity, and prevents combining different source/environment
snapshots. The local series targets 100 complete rounds on the final alpha.6 revision.
Twelve completed earlier local rounds and the hosted attempts are retained separately
and are not added to the new total.
The historical alpha.5 record accepted 45 rounds and excluded its interrupted 46th
round; it remains history rather than evidence for the changed runtime.

The release gate remains pending until the final proof and version-bound policy
agree on source hashes, completion count and the final isolation signature.

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
The [report guide](reports.md) explains the saved artifacts. Alpha.6 requires fresh runtime evidence because its core and regression inputs
changed. Consumer checks remain additional evidence, not extra sequential rounds.
No npm package or GitHub release has been published; see the [release checklist](release-checklist.md).
