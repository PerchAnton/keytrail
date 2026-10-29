# Compatibility

Initial tested target: Node.js **24.22.1**, Playwright Test **1.64.1**, Chromium/headless
shell **156.0.8078.4**, Playwright browser revision **1248**. Development uses pnpm
**11.25.0**, TypeScript **7.0.2** and esbuild **0.28.2**, pinned by the lockfile.

The Playwright peer range is the exact tested version. Future Playwright versions,
Node majors, Firefox, WebKit and Windows are not claimed. Linux CI and macOS run the
dialog, tabs and form tests and clean ESM/CJS consumers. GitHub Actions reports the actual outcome;
see [verification](verification.md) for recorded results. The isolated React portal
example pins React/React DOM **19.3.1**, type declarations **19.3.0**, and runs in
development StrictMode. This is an example environment, not a React peer requirement.

The only installed runtime dependency is the Playwright peer. Node built-ins and a
standalone JSON Schema validator are used at runtime. Ajv compiles the validator during
the build; its small Unicode helper is bundled with the validator. Consumers do not
install Ajv. See [third-party notices](../THIRD_PARTY_NOTICES.md).
