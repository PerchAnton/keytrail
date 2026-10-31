# First alpha release checklist

**Development verification:** The default repeatability check runs four full rounds and a separate four-worker comparison. Final 100-round acceptance remains deferred until the candidate is frozen; [protocol and retained results](reliability.md). Ordinary CI checks the real package and clean consumers without claiming final acceptance.

Candidate: **0.1.0-alpha.6**, ruleset **0.4.0**, schema **1**. The earlier alpha
numbers were source checkpoints, not published packages. This document prepares
the first publication; it does not assert that a release exists.

## Current preparation snapshot

The [handoff guide](release-handoff.md) and [readiness record](evidence/release-readiness.json)
bind the review archive to merged commit `da7e663`. Main CI passed Linux 169/169
and macOS ARM 507/507, including actual package consumers. The exact tested tarball
is preserved with its verification record and checksum; it was not rebuilt for
handoff. The browser examples and saved HTML failure report were inspected through
their interface. Owner sign-off remains separate.

This is **development-review-ready**, with `releaseReady: false` and
`finalAcceptance: false`. The full current-source benchmark has passed; final 100-round evidence,
the release package gate and publication remain deferred. Do not repeat already
sufficient development runs merely to update these documents.

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
the real `--release` consumer gate, independent raw-report validation, owner review
and publication authorization. The release gate uses the same evidence validator.
Historical results and development package records cannot satisfy final acceptance.

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
| Correct and defective fixtures | 169 browser regression tests; all three scenario families |
| Failures cannot silently pass CI | 52 subprocess guard cases including dependency failure, skip, retry and interrupted runs |
| Release evidence fails closed | `node --test scripts/tests/*.test.mjs`; stale hashes, short series, retries, invalid benchmarks and contradictory guard exits are rejected |
| Source-bound reliability | Pending for changed source; prior 100 × 163 proof is historical; [proof and protocol](reliability.md) |
| Equivalent native measurements | Current `da7e663`: 108/108 tests, three workloads, 30 measured pairs each; [method, samples and runner](performance.md) |
| Vanilla tarball consumer | ESM/CJS imports and declarations; 6 browser tests and 3 guarded journeys |
| React portal tarball consumer | StrictMode, real portal/remount, 3 browser tests, 1 guarded journey, separate failing process |
| Reporter compatibility | HTML and JUnit from passing and failing React runs; original failed attachment and `not_run` dependency links retained |
| Package inventory | License, notices, schema and exports; no test results, node_modules or local configuration |
| Archive identity | `artifacts/package-verification.json` and `artifacts/SHA256SUMS` from the exact tested `.tgz` |
| Hosted platform checks | Main `da7e663`: Linux 169 and ARM 507 passed with package consumers; the commit ultimately selected for release needs matching checks |
| Human review | Inspect HTML failure report and try the example with a keyboard; passing automation is not a conformance assessment |

`pnpm check` runs build, types, unit, guard, one browser suite and actual package
consumers. `pnpm verify:reliability` is the separate four-round development check.
Neither command claims final acceptance or requires a five-hour series.

## Deferred final acceptance

Once final acceptance is explicitly requested for the frozen candidate, run
`pnpm verify:reliability --final`. The current-source benchmark is already recorded;
repeat `pnpm benchmark` if its input hashes change. Independently validate the raw
outputs, refresh source-bound evidence, then run `node scripts/check-package.mjs --release`.
That gate requires 100 rounds and complete benchmark evidence. Short runs and
`verificationLevel: development` package records cannot satisfy it.

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

- Select the reviewed commit and require successful CI for it.
- Check registry name availability, ownership and release authentication at that time.
- Use the exact tested tarball; rebuilding after verification changes its identity.
- Publish as an npm prerelease with the **alpha** dist-tag; do not update `latest`.
- Attach that archive, checksum and verification record to the GitHub prerelease.
- Verify a clean registry installation and the dist-tag, then update the status in
  README/changelog. Announce tested scope and limitations, not stable compatibility.

No credential, publish token, npm publication or GitHub release is created by the
preparation commands. Draft notes are in [first-alpha notes](releases/0.1.0-alpha.6.md).
