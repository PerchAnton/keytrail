# Review the first release candidate

**Latest development snapshot (31 October 2026): merged main `f9c492b`.**
[Main CI](https://github.com/PerchAnton/keytrail/actions/runs/41215267386) passed
three separate macOS 15 ARM allocations and Linux: **172 tests per job**, one
worker, zero retries/skips, and both real package consumers in every job.
ARM maximum passing-window gaps were **69.0 / 61.0 / 42.2 ms**; Linux was **32.7 ms**.
The **100 ms** limit is unchanged. [Verified CI record](evidence/ci-main-f9c492b.json).
The [fresh benchmark](performance.md) passed **108/108** with matching input hashes.
The earlier failures remain recorded; short successful checks do not guarantee
shared-runner latency. Final 100-round acceptance and publication remain deferred.

The measured runtime is **KeyTrail 0.1.0-alpha.6** at `f9c492b7676d02628e7b91250b81d358ef03a2c7`.
This is preparation for the first publication; no package or GitHub release exists.
The [readiness record](evidence/release-readiness.json) separates completed checks
from deferred final acceptance. Earlier source checkpoints keep their own evidence.

## What is ready

- Main CI: **688/688** browser executions, **644** distinct journey IDs, matching
  semantic signatures, source hashes, runner environments and both consumers in
  each of four jobs. The three ARM allocations ran sequentially on distinct VMs.
- Benchmark: **108/108**, five warmups and 30 alternating measured pairs per workload.
  Median paired overhead: **-9.2% / -6.8% / -12.6%** for dialog, manual tabs
  and form errors (`insertText`). Both calculations meet the 20% target. These are
  three synthetic fixtures on one Mac, not a general speed or accessibility claim.
- Release-evidence checker: **26 script tests**, including four new regressions.
  Missing source/recorder hashes and conflicting recording metadata fail closed.
- Vanilla and React portal consumers: installed archives, ESM/CJS, declarations,
  keyboard journeys, CI guard, HTML/JUnit and the deliberately failing control.

The [earlier browser review](evidence/browser-review.json) belongs to `8f119df`.
It does not replace owner review of the final candidate. Use the
[report walkthrough](reports.md) to inspect the first mismatch and dependent checks.

## Preserve the tested main-CI archive

Download **linux-evidence** from [main CI 41215267386](https://github.com/PerchAnton/keytrail/actions/runs/41215267386). Keep
`keytrail-0.1.0-alpha.6.tgz`, `package-verification.json` and `SHA256SUMS` together.
The preserved archive has **113 files**, **393,179 bytes**, SHA-256:

```text
c159e66d6f11288479c7ef5c760579bceee8fd842273b7c157daa3d288a6e3c1
```

It contains `f9c492b` before this documentation and evidence-checker refresh.
Any rebuilt archive needs its own external verification record and checksum;
do not apply this hash to it. Archive hashes live outside the archive to avoid
self-reference. Verify with `shasum -a 256 -c SHA256SUMS` on macOS or
`sha256sum -c SHA256SUMS` on Linux. This record has level `development` and
`finalAcceptance: false`. Checksums establish integrity, not signatures or approval.

## What still blocks publication

Run `node scripts/check-release-readiness.mjs` to inspect evidence without starting
tests. Policy, the three benchmarks and guard evidence pass for these inputs.
**Final reliability remains blocked** because the preserved 100-round proof belongs
to `0300552`. Exit 1 is expected while this final stage is deferred.

1. Review and freeze the candidate. Complete owner review of examples and the HTML
   failure report; automation is not an accessibility assessment.
2. Only when explicitly requested, collect the frozen source's 100-round final
   series and independently validate the raw reports. Keep the 100 ms bound and
   zero retries. Remeasure performance if its input hashes change.
3. Pass `node scripts/check-package.mjs --release`, preserving the exact verified
   archive, verification JSON and checksum. A development check cannot satisfy it.
4. Confirm registry ownership/authentication and publication authorization. Publish
   that exact archive with the **alpha** dist-tag, verify a clean registry install,
   then attach matching files to the GitHub prerelease.

The npm 404 recorded on 30 October is historical: it does not reserve a name or
establish publication permissions. GitHub still had no releases when checked on
31 October. Recheck registry state at publication. No publication or final
100-round test was performed in this preparation.
