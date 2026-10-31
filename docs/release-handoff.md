# Review the first release candidate

**Observation follow-up (31 October 2026):** main `02ee0953` failed macOS ARM with a 109.8 ms gap. The candidate now starts consecutive browser reads without a host timer inside manual windows. Earlier repeatability and benchmark records remain historical for their recorded sources; they do not certify this scheduler change. Short CI validation is pending. Final 100-round acceptance remains deferred. [Diagnosis and scope](ci-concurrency.md#consecutive-window-reads).

The reviewed development snapshot is `da7e66378619816cd9c7e065df95f0e2a6e67661`
for **KeyTrail 0.1.0-alpha.6**. It is not a published release or final acceptance.
The [readiness record](evidence/release-readiness.json) identifies completed checks,
the exact package archive and the work still deferred.

## What is already verified

[Main CI](https://github.com/PerchAnton/keytrail/actions/runs/41172735137) passed
one Linux round (169 tests) and three macOS ARM rounds (507 tests). ARM passing-window
maxima were 41.4, 69.3 and 62.6 ms; Linux's maximum was 20.4 ms. The limit remains
100 ms and retries remain disabled. Both platforms also passed the real tarball
checks in separate vanilla and React consumers.

The [local development record](evidence/development-atomic-observations.json)
contains four rounds (676 tests), a four-worker comparison (169 tests) and 800
unique journey IDs. Its input hashes match the merged source. Main CI has its own
640 unique journey IDs; these verification sets are not a final 100-round series.

The earlier `8f119df` [browser review](evidence/browser-review.json) exercised the standalone dialog,
manual tabs, form correction and React portal/remount. The saved negative HTML
report shows the first mismatch and opens its original JSON attachment. This
exploratory review does not replace owner review, pinned-browser qualification or
an accessibility conformance assessment. See [the report walkthrough](reports.md).

## Preserve the tested archive

Download `linux-evidence` from the main CI run above. Keep these files together:

- `keytrail-0.1.0-alpha.6.tgz`
- `package-verification.json`
- `SHA256SUMS`

The archive contains 100 files and is **355,410 bytes**. Its SHA-256 is:

```text
da3f8891d390e9701bafe4aa58e5b1e91def5d2f23b8da9d86202ab536f0b558
```

Check the checksum from the artifact directory with `shasum -a 256 -c SHA256SUMS`
on macOS or `sha256sum -c SHA256SUMS` on Linux. Read the original verification
record: it must identify this archive and both consumers. Its level is
`development` and `finalAcceptance` is **false**. Keep those values unchanged.
A rebuild creates a different artifact and needs its own verification record.
Checksums establish integrity, not signatures or publication authorization.

The earlier local review bundle remains bound to `8f119df` and its original
archive; it is retained as history. Use the `da7e663` CI artifact above for the
newer snapshot. Do not mix either archive with the other verification record.

## Remaining release decisions and checks

Run `node scripts/check-release-readiness.mjs` from the repository root to list
the saved evidence still missing for this source. The command is read-only and
does not start the deferred checks. Its successful exit would certify only the
saved evidence checks, not publication readiness; see the [checklist](release-checklist.md).

1. Select and freeze the final reviewed source.
2. When explicitly requested, collect its 100-round final repeatability evidence.
   The full [current-source benchmark](performance.md) now passes;
   remeasure if its input hashes change. The earlier `0300552` reliability evidence
   remains historical and cannot satisfy final acceptance.
3. Pass `node scripts/check-package.mjs --release` against fresh final evidence.
4. Complete owner review of the examples and failure report.
5. Confirm registry ownership/authentication and publication authorization, then
   publish the exact verified archive with the `alpha` dist-tag and verify a clean
   registry installation.

On 30 October 2026, the npm registry returned 404 for `keytrail`, and GitHub listed
no releases or tags. That establishes that no package record was found; it does
not reserve the name or establish publication permissions. Recheck at publication.
No registry or GitHub release was created during this preparation.
