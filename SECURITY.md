# Security and sensitive data

Use synthetic test data. The library's own JSON and messages are deliberately limited;
external Playwright artifacts can still contain page data. Read [the boundary](docs/limits.md).

Report sensitive issues through the repository's private security reporting feature
if available. Otherwise open an issue requesting a private contact without posting the
reproduction or sensitive material publicly. The alpha is not an authorization layer,
WCAG certification tool or sandbox for untrusted test code.
