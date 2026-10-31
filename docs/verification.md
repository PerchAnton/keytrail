# Verification

**Latest status (31 October 2026): macOS 15 ARM still reproduces observation gaps.**
The second fresh allocation passed **169/170** tests and blocked at
`T05.backward.002.unchanged` on **130.3 ms**. Its package stage was skipped.
The first and third allocations each passed **170/170** and both package consumers;
their maximum passing-window gaps were **74.7 / 50.4 ms**. Linux passed **170/170**
and both consumers. All three ARM jobs ran sequentially on distinct runner IDs.
[Source-bound allocation results](evidence/ci-fresh-arm-allocations.json).
The 100 ms limit, one worker and zero test retries are unchanged. This comparison
changes CI allocation, not production runtime; pinning macOS 15 has not removed
the failure. [Diagnosis and scope](ci-concurrency.md#fresh-macos-15-arm-allocations).
The [benchmark](performance.md) retains its measured `1b42666` identity.
Final 100-round acceptance and publication remain deferred.

**Development verification:** The default repeatability check runs four full rounds and a separate four-worker comparison. Final 100-round acceptance remains deferred until the candidate is frozen; [protocol and retained results](reliability.md). Ordinary CI checks the real package and clean consumers without claiming final acceptance.

The current source candidate is `0.1.0-alpha.6`, ruleset 0.4.0, schema 1.
Measurements use synthetic fixtures, not customer data. A passing regression test
may deliberately observe a failed or blocked journey; it does not mean that its
component is accessible.

| Check | Recorded result |
| --- | --- |
| TypeScript | Strict library, integration and benchmark checks passed |
| Unit tests | 39 passed, including verification-mode and resume-boundary checks |
| Browser suite | Fresh allocations: ARM 170/170, 169/170, 170/170; Linux 170/170. Original 130.3 ms failure retained; no test retries/skips |
| Worker isolation (historical `7e48291`) | 169/169 on four local workers; matching semantic signatures; 800 distinct journey IDs across all five runs |
| Canary isolation | Six cases: successful and exceptional paths for each scenario; five distinct markers |
| Observation lifetime | Coherent focus, detached replacement, changed locator bindings, absent targets, late sibling cleanup and final map disposal |
| CI guard | 52 actual subprocess exit-code cases; [current guard record](evidence/ci-guard.json) |
| Performance | Recorded `1b42666`: 108/108 tests; median paired overhead: dialog 4.8%, manual tabs -4.0%, forms (`insertText`) 2.8%; [samples and validation](performance.md) |
| Repeatability (historical) | `7e48291`: 4 × 169 = 676 sequential checks plus 169 four-worker checks; [development proof](evidence/development-atomic-observations.json). Final 100-round acceptance remains deferred; [historical proof](evidence/reliability.json) |
| Package consumers | Linux and ARM allocations 1/3 passed both clean offline consumers; allocation 2 skipped after its browser failure. ESM/CJS declarations; vanilla: 6 browser tests + 3 guarded journeys; React: 3 browser tests + 1 guarded journey + expected exit-1 control. [Archive hashes and results](evidence/ci-fresh-arm-allocations.json); final acceptance remains false |
| Hosted platforms | Three distinct macOS 15 ARM runner IDs and non-overlapping job times verified. One failed; [combined record](evidence/ci-fresh-arm-allocations.json). Original inputs `5aa44e0`, third allocation `82a8254` with identical execution hashes |

## Recorded performance (`1b42666`)

![Paired overhead and median/p95 timing results](assets/performance.svg)

Thirty alternating measured pairs per workload, after five warmups per arm.
The local runner was an Apple M3 (8 logical CPUs), macOS arm64/Darwin 27.2.0,
Node 24.22.1, Playwright 1.64.1, Chromium 156.0.8078.4, on 31 October 2026. This benchmark ran independently of final reliability acceptance;
no new 100-round series was run. The [earlier October 31 result](history/performance-da7e663-2026-10-31.md)
and [October 29 result](history/performance-2026-10-29.md) are preserved separately.
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
The atomic-registration four-round proof validates its recorded runtime, before the
consecutive-read change. Repeatability records remain tied to their own source hashes.

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
sleep. Run performance measurements without concurrent verification jobs. The default `pnpm test:package` packs the archive and installs it into two clean offline consumers; it
checks ESM/CJS imports and declarations, and runs the vanilla and React examples.
Only `node scripts/check-package.mjs --release` also requires fresh final evidence
and matching source hashes. Use the read-only readiness command in the
[release checklist](release-checklist.md) to inspect those gates without running them.
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
The [report guide](reports.md) explains the saved artifacts. Earlier transport revisions have their own four-round development evidence; these
do not certify the current consecutive-read scheduler. Consumer checks remain additional
evidence, not extra sequential rounds.
No npm package or GitHub release has been published; see the [release checklist](release-checklist.md).
