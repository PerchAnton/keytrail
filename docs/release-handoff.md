# Review the first release candidate

The reviewed development snapshot is `8f119df5a745b9971f486eb2c054f3c2c3e220ea`
for **KeyTrail 0.1.0-alpha.6**. It is not a published release or final acceptance.
The [readiness record](evidence/release-readiness.json) identifies completed checks,
the exact package archive and the work still deferred.

## What is already verified

[Main CI](https://github.com/PerchAnton/keytrail/actions/runs/41104556559) passed
one Linux round (169 tests) and three macOS ARM rounds (507 tests). ARM passing-window
maxima were 26.0, 46.8 and 31.0 ms; Linux's maximum was 32.1 ms. The limit remains
100 ms and retries remain disabled. Both platforms also passed the real tarball
checks in separate vanilla and React consumers.

The [local development record](evidence/development-atomic-observations.json)
contains four rounds (676 tests), a four-worker comparison (169 tests) and 800
unique journey IDs. Its input hashes match the merged source. Main CI has its own
640 unique journey IDs; these verification sets are not a final 100-round series.

A [browser review](evidence/browser-review.json) exercised the standalone dialog,
manual tabs, form correction and React portal/remount. The saved negative HTML
report shows the first mismatch and opens its original JSON attachment. This
exploratory review does not replace owner review, pinned-browser qualification or
an accessibility conformance assessment. See [the report walkthrough](reports.md).

## Preserve the tested archive

Download `linux-evidence` from the main CI run above. Keep these files together:

- `keytrail-0.1.0-alpha.6.tgz`
- `package-verification.json`
- `SHA256SUMS`

The archive contains 96 files and is **277,781 bytes**. Its SHA-256 is:

```text
0280a1b20eb9ed2513c6a6d0573fd43336aac8ed18ae38ddab1a6ae703d6bc13
```

Check the checksum from the artifact directory with `shasum -a 256 -c SHA256SUMS`
on macOS or `sha256sum -c SHA256SUMS` on Linux. Read the original verification
record: it must identify this archive and both consumers. Its level is
`development` and `finalAcceptance` is **false**. Keep those values unchanged.
A rebuild creates a different artifact and needs its own verification record.
Checksums establish integrity, not signatures or publication authorization.

The optional local review bundle adds the four raw CI reports, environment and
guard records, the existing local proof, standard HTML/JUnit consumer reports,
a screenshot, a manifest and a checksum list. It preserves the tarball bytes;
it is not a replacement package or a GitHub release.

## Remaining release decisions and checks

1. Select and freeze the final reviewed source.
2. When explicitly requested, collect its 100-round final repeatability evidence
   and full equivalent-native benchmark. The earlier `0300552` evidence remains
   historical, and the short benchmark pilot cannot satisfy this gate.
3. Pass `node scripts/check-package.mjs --release` against fresh final evidence.
4. Complete owner review of the examples and failure report.
5. Confirm registry ownership/authentication and publication authorization, then
   publish the exact verified archive with the `alpha` dist-tag and verify a clean
   registry installation.

On 30 October 2026, the npm registry returned 404 for `keytrail`, and GitHub listed
no releases or tags. That establishes that no package record was found; it does
not reserve the name or establish publication permissions. Recheck at publication.
No registry or GitHub release was created during this preparation.
