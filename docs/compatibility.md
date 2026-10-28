# Compatibility

Initial tested target: Node.js **24.22.1**, Playwright Test **1.64.1**, Chromium/headless
shell **156.0.8078.4**, Playwright browser revision **1248**. Development uses pnpm
**11.25.0**, TypeScript **7.0.2** and esbuild **0.28.2**, pinned by the lockfile.

The Playwright peer range is the exact tested version. Future Playwright versions,
Node majors, Firefox, WebKit and Windows are not claimed. Linux CI and macOS run the
dialog/tabs tests and clean ESM/CJS consumers. GitHub Actions reports the actual outcome;
see [verification](verification.md) for recorded results.

Runtime depends only on the Playwright peer and Node built-ins. ajv is a development
dependency for schema verification; it is not shipped as a runtime dependency.
