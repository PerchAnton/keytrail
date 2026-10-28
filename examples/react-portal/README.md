# React portal example

A custom ARIA dialog rendered by React **19.3.1** into `#portal-root`, a sibling of
`#app` in the same document. Development StrictMode is enabled. The application
implements focus entry, wrapping, Escape, background inertness and return focus.
KeyTrail sends keys and observes; it does not repair the component.

This is a small synthetic teaching component, not a production dialog library.
It has no backend, credentials, external assets or saved user data.

## Run the installed-package check

From the repository root, after installing the root dependencies and Chromium:

```sh
pnpm --dir examples/react-portal install --frozen-lockfile --ignore-scripts
pnpm test:package
pnpm exec playwright show-report artifacts/consumers/react-portal/reports/teaching/html
```

The check copies this example into a fresh temporary directory and installs the
actual KeyTrail tarball offline. It type-checks, builds and runs the example there,
without resolving KeyTrail from the source checkout. React dependencies have their
own lockfile; they are not added to the library's dependencies.

## Run it yourself

Copy this directory into a new folder outside the repository. In that copy:

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm add --save-dev /absolute/path/to/keytrail-0.1.0-alpha.5.tgz
pnpm exec playwright install chromium
pnpm test:types
pnpm build
pnpm test
pnpm test:guard
pnpm start
```

Open <http://127.0.0.1:4173>. `PORT` can select another local port. Start from the top
of the page, Tab to **Edit profile**, press Enter, cycle with Tab/Shift+Tab and close
with Escape. Tests use an ephemeral localhost port for every worker, with cleanup.
The server only serves three fixed built assets. Build before starting it.

## What each variant proves

| Variant | Application behavior | Expected KeyTrail result |
| --- | --- | --- |
| Corrected | Input receives focus, both cycles wrap, Escape returns to opener | Complete passing journey, also after closing and remounting the portal |
| `?defect=initial-focus` | Close receives focus instead of the input | `D03.initial` / `FOCUS_MISMATCH`; later observations stay `not_run` with `blockedBy: D03.initial` |
| `?defect=return-focus` | Dialog unmounts without returning focus | `D07.returned` / `FOCUS_MISMATCH`, observed focus `body` |

All three teaching tests pass because the two detector demonstrations explicitly
assert their expected failures. In application tests, let the assertion throw.
`pnpm test:guard` selects only the corrected component. It runs standard HTML,
JUnit and JSON reporters, then the KeyTrail guard **last**.

The separate negative control does not catch the error and must exit **1**:

```sh
KEYTRAIL_NEGATIVE_CONTROL=1 pnpm test:guard
```

This command is expected to fail. The package check verifies that exit code, the
JUnit failure, the HTML artifact, and the original attachment's dependency links.
The negative file is excluded from the default teaching suite. See
[reading reports](../../docs/reports.md) for output paths and interpretation.

React's [portal documentation](https://react.dev/reference/react-dom/createPortal)
explains DOM placement. This example covers a portal in the main document only;
it does not add iframe, Shadow DOM or native `<dialog>` support.
