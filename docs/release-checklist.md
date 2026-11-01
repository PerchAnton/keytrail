# First alpha release checklist

This page records the `0.1.0-alpha.6` handoff. For the first beta candidate,
see [the beta scope and release checks](releases/0.1.0-beta.1.md).

**Frozen candidate (31 October 2026): `1187fde`.**
The [candidate/0.1.0-alpha.6 tag](https://github.com/PerchAnton/keytrail/tree/candidate/0.1.0-alpha.6)
remains at this commit. [Candidate CI](https://github.com/PerchAnton/keytrail/actions/runs/41219489046)
passed three separate macOS 15 ARM allocations and Linux: **172 tests per job**,
one worker, zero retries/skips, and both real package consumers in every job.
ARM maximum passing-window gaps were **87.7 / 65.6 / 50.7 ms**; Linux was **23.9 ms**.
The **100 ms** limit is unchanged. [Verified CI record](evidence/ci-main-1187fde.json).
The [benchmark](performance.md) was measured at `f9c492b`: **108/108**, with
input hashes matching this candidate. Earlier failures and measurements keep their
source identities. Short checks do not guarantee shared-runner latency.
Final source-bound reliability completed on 31 October 2026 UTC (1 November in Kyiv):
**100 × 172 sequential executions + 172 four-worker checks**, zero retries/skips.
[Independent validation](evidence/reliability-validation-1187fde.json).
The release archive gate, owner sign-off and publication authorization remain separate.

**Final reliability verified:** The frozen `1187fde` candidate completed **100 × 172 = 17,200** sequential test executions and **172** matching four-worker checks, with a **100 ms** limit and zero retries/skips. All 101 raw reports were independently validated. Development still defaults to four rounds. See the [protocol and retained results](reliability.md). Ordinary CI checks the real package and clean consumers without claiming final acceptance.

Candidate: **0.1.0-alpha.6**, ruleset **0.4.0**, schema **1**. The earlier alpha
numbers were source checkpoints, not published packages. This document prepares
the first publication; it does not assert that a release exists.

## Frozen candidate snapshot (`1187fde`)

The [handoff guide](release-handoff.md) and [readiness record](https://github.com/PerchAnton/keytrail/blob/3620f256aea5997938f2565236af381cfe79a91a/docs/evidence/release-readiness.json)
identify the preserved main-CI archive and the fresh benchmark. Linux passed 172/172
checks and three separate macOS ARM machines passed 516/516, with real package
consumers in every job. The benchmark passed 108/108; both overhead calculations
meet the 20% target for every workload. The [interactive candidate review](evidence/browser-review-1187fde.json) records
keyboard and report checks at `1187fde`; it does not imply owner sign-off.
The final source-bound reliability series has now passed independently.

This is a **frozen candidate with verified final reliability**. `releaseReady`
remains false; the preserved development archive still has `finalAcceptance: false`.
Do not repeat sufficient development rounds for changes
to documentation or the release-evidence checker. New archive bytes still require
their own package-consumer verification and checksum. The preserved Linux archive
has **115 files / 395,737 bytes**, SHA-256
`42f45c5eac7958d55b3b23b40ea0c484b85c56fdcd01f6b22a716e39b9d26967`.
These updated instructions postdate that archive; keep the candidate tag fixed.
A package rebuilt with these documents must not inherit the old archive checksum.

## Inspect remaining evidence without running tests

From the repository root:

```sh
node scripts/check-release-readiness.mjs
node scripts/check-release-readiness.mjs --json
```

This read-only command checks the saved acceptance policy, final repeatability,
three benchmark records and CI-guard evidence against the current inputs. It lists
all blocked records in one run. It does not build, run browser tests, start the
100-round series, delete existing artifacts or publish anything. Exit 0 means the
saved evidence passed validation; exit 1 means evidence is pending or invalid;
exit 2 means the command could not inspect the checkout or its options.

An evidence result alone is not release approval: the exact archive still needs
the real `--release` consumer gate, owner review and publication authorization.
Raw-report validation is complete and recorded separately. The release gate uses
the same evidence validator.
Historical results and development package records cannot satisfy final acceptance.
For this snapshot, **all six saved-evidence checks pass and the command exits 0**.
The completed final series is recorded, not repeated by this documentation update.

## Development checks

Use the pinned environment in [compatibility](compatibility.md), a clean checkout
and the committed lockfiles:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm --dir examples/react-portal install --frozen-lockfile --ignore-scripts
pnpm exec playwright install chromium
pnpm check
pnpm verify:reliability # Four rounds plus the separate four-worker comparison
```

On Linux, add `--with-deps` to the Chromium install when system libraries are
missing. On macOS, `caffeinate -is pnpm check` prevents sleep during browser runs.
Dependency installation and the React consumer lockfile preparation need a registry
connection. For each consumer, the package check prepares a lockfile and registry metadata
without installing node_modules, then uses a separate empty directory for the frozen
offline installation. This preserves native TypeScript and esbuild platform dependencies. Both
tarball consumers install offline from the populated store. No account, API key
or external service is needed to run their browser tests.

| Gate | Evidence / command |
| --- | --- |
| Public API, types, limits and errors agree | [Dialog](api.md), [tabs](tabs.md), [form errors](form-errors.md), [rules/codes](rules.md), [limits](limits.md); strict TypeScript checks |
| Correct and defective fixtures | 172 browser regression tests; all three scenario families |
| Failures cannot silently pass CI | 52 subprocess guard cases including dependency failure, skip, retry and interrupted runs |
| Release evidence fails closed | `node --test scripts/tests/*.test.mjs`; stale or incomplete hashes, short series, retries, invalid benchmarks and contradictory guard exits are rejected |
| Source-bound reliability | `1187fde`: 100 × 172 sequential checks + 172 four-worker checks, zero retries/skips; [proof and protocol](reliability.md) |
| Equivalent native measurements | Recorded `f9c492b`: 108/108 tests, three workloads, 30 measured pairs each; [method, samples and runner](performance.md) |
| Vanilla tarball consumer | ESM/CJS imports and declarations; 6 browser tests and 3 guarded journeys |
| React portal tarball consumer | StrictMode, real portal/remount, 3 browser tests, 1 guarded journey, separate failing process |
| Reporter compatibility | HTML and JUnit from passing and failing React runs; original failed attachment and `not_run` dependency links retained |
| Package inventory | License, notices, schema and exports; no test results, node_modules or local configuration |
| Archive identity | `artifacts/package-verification.json` and `artifacts/SHA256SUMS` from the exact tested `.tgz` |
| Hosted platform checks | Candidate `1187fde`: Linux 172 and ARM 516 passed with package consumers; the commit ultimately selected for release needs matching checks |
| Human review | Inspect HTML failure report and try the example with a keyboard; passing automation is not a conformance assessment |

`pnpm check` runs build, types, unit, guard, one browser suite and actual package
consumers. `pnpm verify:reliability` is the separate four-round development check.
Neither command claims final acceptance or requires a five-hour series.

## Completed reliability and remaining archive gate

The explicitly requested final series for `1187fde` completed on 31 October 2026
UTC (1 November in Kyiv): 100 full rounds, the four-worker comparison and independent
validation of all 101 raw reports. The 100 ms bound and zero retries are unchanged.
The benchmark input hashes still match; no new benchmark or full series is needed
for these documentation changes.

Next, identify the release snapshot and run `node scripts/check-package.mjs --release`.
It packs a new archive containing the updated documents and tests its real consumers.
Preserve its new checksum and release-level verification record. The existing Linux
archive remains development-verified; do not reuse its checksum or upgrade its record.
This gate and publication authorization are still pending.

## Review the output

CI uploads the candidate `.tgz`, verification JSON, checksum file and React reports
under the platform evidence artifact. All public files remain English. React and
its bundler are example-only dependencies, not installed library dependencies.

Read `package-verification.json` before using the archive. A failed package check
removes stale success/checksum records; the presence of an archive alone is not
proof of a successful gate. The record binds the archive bytes, package version,
platform, verification level and consumer results. Require `finalAcceptance: true`
for the final release gate. Checksums are integrity checks, not signatures.

## Publication remains a separate step

- Keep the reviewed `candidate/0.1.0-alpha.6` tag at `1187fde`. Any later release
  snapshot needs its own identity; do not move the existing tag. Verify that the
  selected release inputs and archive have matching evidence.
- Check registry name availability, ownership and release authentication at that time.
- Use the exact tested tarball; rebuilding after verification changes its identity.
- Publish as an npm prerelease with the **alpha** dist-tag; do not update `latest`.
- Attach that archive, checksum and verification record to the GitHub prerelease.
- Verify a clean registry installation and the dist-tag, then update the status in
  README/changelog. Announce tested scope and limitations, not stable compatibility.

No credential, publish token, npm publication or GitHub release is created by the
preparation commands. Draft notes are in [first-alpha notes](releases/0.1.0-alpha.6.md).
