# Verification

The current source candidate is `0.1.0-alpha.5`, ruleset 0.3.0, schema 1.
Measurements use synthetic fixtures, not customer data. A passing regression test
may deliberately observe a failed or blocked journey; it does not mean that its
component is accessible.

| Check | Recorded result |
| --- | --- |
| TypeScript | Strict library, integration and benchmark checks passed |
| Unit tests | 30 passed |
| Browser suite | 153 passed with one worker; 153 passed with four workers |
| Worker isolation | Identical semantic observations; 300 distinct journey UUIDs; three engine-only tests per run |
| Canary isolation | Six cases: successful and exceptional paths for each scenario; five distinct markers |
| Handle lifetime | Coherent focus, re-resolution after replacement, late sibling cleanup after an early error |
| CI guard | 48 actual subprocess exit-code cases; [record](evidence/ci-guard.json) |
| Performance | All three fixed workloads below the 20% median overhead target; [protocol and raw samples](performance.md) |
| Full repeatability | The 100-round acceptance run is in progress; not yet accepted |
| Package consumers | Current candidate verification follows the completed acceptance record |

## Performance

![Paired overhead and median/p95 timing results](assets/performance.svg)

Thirty alternating measured pairs per workload, after five warmups per arm.
The shared runner was an Apple M3 (8 logical CPUs), macOS arm64/Darwin 27.2.0,
Node 24.22.1, Playwright 1.64.1, Chromium 156.0.8078.4, on 28 October 2026.
Every pair also passed semantic equivalence checks; three known defects agreed on
the first mismatch and dependent checks. Manual tabs include required observation
windows, which dominate duration. These figures do not establish a universal speed
advantage or replace checks in a consumer application.

## Repeatability and safety

[The full-suite protocol](reliability.md) retains every raw run, rejects retries,
checks attachment identity, and prevents combining different source/environment
snapshots. The package gate requires a completed 100-round record and passing
performance records for the current source. Historical focused runs are not counted
as full-suite repetitions.

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
source hashes, packs the archive, installs it into a clean offline consumer, checks
ESM/CJS imports and declarations, and runs six browser examples plus three guarded
journeys. Archive size/hash are written outside the package to avoid a
self-referential archive checksum.

[DEV08 history](verification-dev08.md) retains the earlier focused-repeat evidence,
including the diagnosed host-sleep timeouts and hosted outer-timeout correction.
DEV10's React consumer and full release checklist remain separate work. No npm
package or GitHub release has been published.
