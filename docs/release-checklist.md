# First alpha release checklist

Candidate: **0.1.0-alpha.6**, ruleset **0.4.0**, schema **1**. The earlier alpha
numbers were source checkpoints, not published packages. This document prepares
the first publication; it does not assert that a release exists.

## Reproduce the candidate

Use the pinned environment in [compatibility](compatibility.md), a clean checkout
and the committed lockfiles:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm --dir examples/react-portal install --frozen-lockfile --ignore-scripts
pnpm exec playwright install chromium
pnpm check
```

On Linux, add `--with-deps` to the Chromium install when system libraries are
missing. On macOS, `caffeinate -is pnpm check` prevents sleep during browser runs.
Dependency installation and the React consumer lockfile preparation need a registry
connection. The package check prepares metadata without installing node_modules,
then uses a separate empty consumer for the frozen offline installation. Both
tarball consumers install offline from the populated store. No account, API key
or external service is needed to run their browser tests.

| Gate | Evidence / command |
| --- | --- |
| Public API, types, limits and errors agree | [Dialog](api.md), [tabs](tabs.md), [form errors](form-errors.md), [rules/codes](rules.md), [limits](limits.md); strict TypeScript checks |
| Correct and defective fixtures | 163 browser regression tests; all three scenario families |
| Failures cannot silently pass CI | 52 subprocess guard cases including dependency failure, skip, retry and interrupted runs |
| Source-bound reliability | Complete: 100 × 163 executions and matching 163-case four-worker comparison, no retries; [proof and protocol](reliability.md) |
| Equivalent native measurements | Three workloads, 30 measured pairs each; [method, samples and runner](performance.md) |
| Vanilla tarball consumer | ESM/CJS imports and declarations; 6 browser tests and 3 guarded journeys |
| React portal tarball consumer | StrictMode, real portal/remount, 3 browser tests, 1 guarded journey, separate failing process |
| Reporter compatibility | HTML and JUnit from passing and failing React runs; original failed attachment and `not_run` dependency links retained |
| Package inventory | License, notices, schema and exports; no test results, node_modules or local configuration |
| Archive identity | `artifacts/package-verification.json` and `artifacts/SHA256SUMS` from the exact tested `.tgz` |
| Hosted platform checks | Pending for the final alpha.6 candidate; Linux and macOS CI must refer to the commit selected for release |
| Human review | Inspect HTML failure report and try the example with a keyboard; passing automation is not a conformance assessment |

`pnpm check` runs the checks and consumers once. It validates the existing
source-bound reliability and benchmark evidence; it does not rerun 45 or 100 rounds.
Alpha.6 now has fresh 100-round evidence. The historical 45 rounds belong to
alpha.5 and are not reused after the core changes. Local completion does not clear
the remaining hosted-platform and human-review steps or publish a package.

## Review the output

CI uploads the candidate `.tgz`, verification JSON, checksum file and React reports
under the platform evidence artifact. All public files remain English. React and
its bundler are example-only dependencies, not installed library dependencies.

Read `package-verification.json` before using the archive. A failed package check
removes stale success/checksum records; the presence of an archive alone is not
proof of a successful gate. The record binds the archive bytes, package version,
platform and consumer results. Checksums are integrity checks, not signatures.

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
