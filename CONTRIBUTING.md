# Contributing

Public documentation, examples, issue templates and release notes are written in English.

Start with a synthetic fixture, the declared expectation and the observed result.
Include Node, Playwright and browser versions, checkId, messageCode and a safe report.
Do not include private page data. Use branches named `keytrail/<task>`.

Run `pnpm install --frozen-lockfile --ignore-scripts`, install Chromium, then `pnpm check`.
After changing source or tests, refresh both [verification records](docs/verification.md)
before the package check. Evidence must describe the source being packed.
Tests must exercise real keyboard behavior and exact failing observations. Keep browser
actions separate from read-only observations; do not force focus to repair a component.
Maintain ESM/CJS consumer checks and the schema together with public types.

Keep the scope in [the roadmap](docs/roadmap.md). Runtime APIs are experimental. During
0.x, incompatible API changes require a minor version change and migration guidance.
A new rule that can fail a previously passing contract changes rulesetVersion; an
incompatible result shape changes schemaVersion. Never replace released versions.

Original contributions are licensed under Apache-2.0. Third-party dependencies retain
their own licenses. An npm release requires reviewed source, green CI on that commit,
an inspected archive, checksums and a clean consumer run. This repository does not
automatically publish packages. First-alpha preparation does not imply publication.
