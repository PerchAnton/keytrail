---
name: Bug report
about: Report a reproducible keyboard journey or package problem
title: ''
labels: ''
assignees: ''
---

## Environment

- KeyTrail version:
- Ruleset / schema version (from the attachment):
- Node.js / Playwright / browser versions:
- Operating system:
- Framework and version, if relevant:

## Minimal reproduction

Provide a small runnable component and journey contract using synthetic data.
Include the install/test command and any necessary setup. For packaging problems,
state whether you installed a registry version or a local tarball.

## Expected and observed behavior

Describe where focus should go and what actually happens. Include the first
`ruleId`, `checkId` and `messageCode` when a report is available.

## Sanitized report

Attach the relevant `journey-result.json` or a small sanitized excerpt, including
coverage and `blockedBy` links. Check technical IDs and external Playwright
artifacts for private data before sharing them. For sensitive issues, follow
[SECURITY.md](https://github.com/PerchAnton/keytrail/blob/main/SECURITY.md).
