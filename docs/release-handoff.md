# Review the first release candidate

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
Final 100-round acceptance and publication remain deferred.

The frozen source is **KeyTrail 0.1.0-alpha.6** at
`1187fde7e0307705354864e739cb1cccce134165`. The annotated candidate tag remains
at that commit. These instructions were updated after the freeze; they describe
the preserved archive and do not change its contents or verification level.
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

The [candidate review](evidence/browser-review-1187fde.json) checked dialog focus
cycles and return, manual tab activation, form recovery and both intentional React
defects. The preserved HTML/JSON/JUnit reports agree: the corrected journey passes
18/18 checks; wrong initial focus fails `D03.initial` and leaves 12 dependent checks
`not_run`. The separate return-focus defect fails `D07.returned`.
This interactive review does not measure sampling cadence, provide owner sign-off
or replace final acceptance. The [earlier review](evidence/browser-review.json)
remains tied to `8f119df`. Use the [report walkthrough](reports.md) to inspect the
first mismatch and dependent checks.

## Preserve the tested main-CI archive

Download **linux-evidence** from [candidate CI 41219489046](https://github.com/PerchAnton/keytrail/actions/runs/41219489046). Keep
`keytrail-0.1.0-alpha.6.tgz`, `package-verification.json` and `SHA256SUMS` together.
The preserved Linux archive has **115 files**, **395,737 bytes**, SHA-256:

```text
42f45c5eac7958d55b3b23b40ea0c484b85c56fdcd01f6b22a716e39b9d26967
```

For example, download into a new directory, then verify its checksum on macOS:

```sh
gh run download 41219489046 --repo PerchAnton/keytrail \
  --name linux-evidence --dir candidate-1187fde-linux
cd candidate-1187fde-linux
shasum -a 256 -c SHA256SUMS
```

On Linux use `sha256sum -c SHA256SUMS`. Inspect `package-verification.json` as
well as the checksum: it records **development** verification and
`finalAcceptance: false`, both real consumers, and the expected negative exit 1.
The `evidenceSourceHashes: false` flag means the final release-evidence gate was
not applied during this development package check; it is not final acceptance.
The separate [CI proof](evidence/ci-main-1187fde.json) binds the run to source hashes.

This archive was built at `1187fde`; it still contains the documentation available
at that commit. A new archive incorporating these updated instructions will have
different bytes and requires its own package verification and checksum. Never
assign the checksum above to a rebuilt archive or move the existing candidate tag.
Archive hashes live outside the archive to avoid self-reference. Checksums establish
integrity, not signatures or approval.

The macOS artifacts have their own verified checksum
`ef22a9f1b567ad336c24c78493ac10c8e07194800f2c39b49aa6a8d74963389e`.
Do not substitute it for the Linux archive's checksum. The previous `f9c492b`
archive remains in the [historical snapshot](evidence/release-readiness-f9c492b.json)
and [earlier CI proof](evidence/ci-main-f9c492b.json); it is not this candidate.

## What still blocks publication

Run `node scripts/check-release-readiness.mjs` to inspect evidence without starting
tests. Policy, the three benchmarks and guard evidence pass for these inputs.
**Final reliability remains blocked** because the preserved 100-round proof belongs
to `0300552`. Exit 1 is expected while this final stage is deferred.

1. Keep the frozen candidate tag at `1187fde`. Complete owner sign-off on the
   examples and HTML report. Record a new identity if a later release snapshot
   is selected; these documentation changes do not retag the preserved candidate.
2. Only when explicitly requested, collect the frozen source's 100-round final
   series and independently validate the raw reports. Keep the 100 ms bound and
   zero retries. Remeasure performance if its input hashes change.
3. Once matching final evidence is available, pass
   `node scripts/check-package.mjs --release` for the selected release snapshot.
   Preserve that exact verified archive, verification JSON and checksum. Its record
   must have `verificationLevel: release` and `finalAcceptance: true`.
   The preserved development archive does not satisfy this gate.
4. Confirm registry ownership/authentication and publication authorization. Publish
   that exact archive with the **alpha** dist-tag, verify a clean registry install,
   then attach matching files to the GitHub prerelease.

The candidate review on 31 October received npm HTTP 404 and found no GitHub
releases. The candidate tag exists, but it is not a release. A registry 404 does
not reserve the name or establish publication permissions. Recheck registry access
at publication. No publication or final 100-round test was performed in this update.
