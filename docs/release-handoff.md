# Review the first release candidate

**Current evidence (31 October 2026):** main `1b42666` passed three macOS ARM rounds
(510/510), one Linux round (170/170) and both package consumers per platform, with
zero retries. Maximum ARM observation gaps were 47.4 / 38.4 / 39.5 ms; Linux's
maximum was 26.3 ms, below the unchanged 100 ms limit. [Validated main CI](evidence/ci-main-1b42666.json).
The fresh [108-test benchmark](performance.md) matches this source. Earlier repeatability
proofs remain historical; final 100-round acceptance is still deferred. This short
sample does not guarantee host scheduling latency; [diagnosis and scope](ci-concurrency.md#consecutive-window-reads).

The measured development snapshot is `1b42666fddf8c6653ae3898cbe99a61c5b671980`
for **KeyTrail 0.1.0-alpha.6**. It is not a published release or final acceptance.
The [readiness record](evidence/release-readiness.json) identifies completed checks,
the preserved main-CI archive and the work still deferred.

## What was verified

[Main CI](https://github.com/PerchAnton/keytrail/actions/runs/41198529257) passed
one Linux round (170 tests) and three macOS ARM rounds (510 tests), with zero
retries and skips. Independent validation checked all four raw reports, 644 unique
journey IDs, source hashes, guard exits and both platforms' archive checksums.
Both platforms passed the real tarball checks in separate vanilla and React consumers.
[Current main-CI record](evidence/ci-main-1b42666.json).

The fresh [benchmark](performance.md) passed 108/108 tests: five warmups and 30
alternating measured pairs per workload, plus three negative controls. Independent
recomputation confirmed overhead of 4.8% / -4.0% / 2.8% for dialog, manual tabs and
form errors (`insertText`). Both calculations meet the 20% target. This evidence
is specific to three synthetic fixtures on the recorded Mac, not a general speed claim.

The [local atomic-registration proof](evidence/development-atomic-observations.json)
predates the consecutive-read scheduler. Its four rounds, four-worker comparison
and 800 unique journey IDs remain historical. Neither that proof nor current main
CI is a final 100-round series.

The earlier `8f119df` [browser review](evidence/browser-review.json) exercised the
standalone examples and React portal/remount, including the saved HTML failure
report and its original JSON attachment. It does not qualify the current scheduler
or replace owner review, pinned-browser qualification or an accessibility assessment.
See [the report walkthrough](reports.md).

## Preserve the tested main-CI archive

Download `linux-evidence` from main CI **41198529257**. Keep these files together:

- `keytrail-0.1.0-alpha.6.tgz`
- `package-verification.json`
- `SHA256SUMS`

This archive contains 103 files and is **360,802 bytes**. Its SHA-256 is:

```text
cc7994bc7027d4c2f9e64affece7362cbf2a365eb06e899b377cfd59191ffc85
```

It contains main `1b42666` before this benchmark documentation refresh. It is not
the archive of the refreshed documents. Any new build must retain its own external
`package-verification.json` and `SHA256SUMS`; do not apply this checksum to it.
Archive hashes are recorded outside the archive to avoid self-reference.

Check the checksum from the artifact directory with `shasum -a 256 -c SHA256SUMS`
on macOS or `sha256sum -c SHA256SUMS` on Linux. The original verification record
must identify this archive and both consumers. Its level is `development` and
`finalAcceptance` is **false**. Checksums establish integrity, not signatures or
publication authorization. Older review bundles keep their own records and hashes.

## Remaining release decisions and checks

Run `node scripts/check-release-readiness.mjs` to inspect the saved evidence without
starting tests. For the unchanged measured inputs, policy, all three benchmarks and
the guard record pass; final repeatability remains blocked by historical source
hashes. A successful saved-evidence check alone would not establish publication
readiness; see the [checklist](release-checklist.md).

1. Select and freeze the final reviewed source.
2. When explicitly requested, collect its 100-round final repeatability evidence.
   The current benchmark is already recorded; remeasure if its input hashes change.
   The earlier `0300552` reliability proof cannot satisfy current final acceptance.
3. Pass `node scripts/check-package.mjs --release` against fresh final evidence.
4. Complete owner review of the examples and failure report.
5. Confirm registry ownership/authentication and publication authorization, then
   publish the exact verified archive with the `alpha` dist-tag and verify a clean
   registry installation.

On 30 October 2026, the npm registry returned 404 for `keytrail`, and GitHub listed
no releases or tags. That historical check neither reserves the name nor establishes
publication permissions. Recheck at publication. No registry or GitHub release was
created during this preparation.
