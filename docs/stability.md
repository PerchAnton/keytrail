# Compatibility and support for 0.1.x

0.1.0 is the first non-prerelease. Patch releases in 0.1.x preserve the documented
exports, contract defaults, result schema 1, ruleset 0.4.0 and rule identifiers.
Incompatible changes require a new minor, migration notes and regressions. A
future 1.0 requires a separate long-term compatibility decision.

The supported environment remains Node 24, the exact Playwright 1.64.1 peer and
its Chromium, Linux and macOS ARM. Other browsers and Windows are not claimed.
Keep exact pins and run your application's keyboard tests before upgrading.
Report timings, environment metadata and prose are not stable machine interfaces.

Maintenance by PerchAnton is best effort, targeting the latest 0.1.x patch.
There is no SLA, fixed support term, independent security audit or accessibility
certification. Deprecations must document an alternative before removal. Report
bugs with synthetic fixtures, exact versions and the original failing report.

## Acceptance and migration

Stable uses the same ten complete final rounds plus a separate four-worker run,
zero retries/skips and the unchanged 100 ms observation gap. New source or
verification inputs need matching proof. The completed beta.2 series remains
historical evidence and is not relabelled as a stable run. Both exact-archive
consumers, benchmark and CI guard remain separate gates.

No contract or result-schema migration from beta.2 is intended. Package-version
metadata changes to 0.1.0. Existing reports keep their original version. Native
Playwright tests remain useful; these checks do not certify accessibility.

Publish the exact qualified archive with npm's latest tag and a GitHub release
with prerelease=false. Preserve the beta tag and older release assets. Verify
registry bytes and a clean install before claiming publication. No workflow
publishes automatically; the owner authorized this release on 7 November 2026.
