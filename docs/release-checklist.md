# First alpha release checklist

**Development verification:** The default repeatability check runs four full rounds and a separate four-worker comparison. Final 100-round acceptance and release performance evidence are deferred until the candidate is frozen; [protocol and retained results](reliability.md). Ordinary CI checks the real package and clean consumers without claiming final acceptance.

Candidate: **0.1.0-alpha.6**, ruleset **0.4.0**, schema **1**. The earlier alpha
numbers were source checkpoints, not published packages. This document prepares
the first publication; it does not assert that a release exists.

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
connection. The package check prepares metadata without installing node_modules,
then uses a separate empty consumer for the frozen offline installation. Both
tarball consumers install offline from the populated store. No account, API key
or external service is needed to run their browser tests.

| Gate | Evidence / command |
| --- | --- |
| Public API, types, limits and errors agree | [Dialog](api.md), [tabs](tabs.md), [form errors](form-errors.md), [rules/codes](rules.md), [limits](limits.md); strict TypeScript checks |
| Correct and defective fixtures | 167 browser regression tests; all three scenario families |
| Failures cannot silently pass CI | 52 subprocess guard cases including dependency failure, skip, retry and interrupted runs |
| Source-bound reliability | Pending for changed source; prior 100 × 163 proof is historical; [proof and protocol](reliability.md) |
| Equivalent native measurements | Fresh measurements pending: three workloads, 30 measured pairs each; [method, samples and runner](performance.md) |
| Vanilla tarball consumer | ESM/CJS imports and declarations; 6 browser tests and 3 guarded journeys |
| React portal tarball consumer | StrictMode, real portal/remount, 3 browser tests, 1 guarded journey, separate failing process |
| Reporter compatibility | HTML and JUnit from passing and failing React runs; original failed attachment and `not_run` dependency links retained |
| Package inventory | License, notices, schema and exports; no test results, node_modules or local configuration |
| Archive identity | `artifacts/package-verification.json` and `artifacts/SHA256SUMS` from the exact tested `.tgz` |
| Hosted platform checks | Pending for the final alpha.6 candidate; Linux and macOS CI must refer to the commit selected for release |
| Human review | Inspect HTML failure report and try the example with a keyboard; passing automation is not a conformance assessment |

`pnpm check` runs build, types, unit, guard, one browser suite and actual package
consumers. `pnpm verify:reliability` is the separate four-round development check.
Neither command claims final acceptance or requires a five-hour series.

## Deferred final acceptance

Once the candidate is frozen, explicitly run `pnpm verify:reliability --final`
and `pnpm benchmark`. Independently validate their raw outputs, refresh the
committed source-bound evidence, then run `node scripts/check-package.mjs --release`.
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
