# Standalone dialog and tabs demonstrations

`profile.html` is a synthetic dialog with two Tab stops. `profile.journey.spec.ts`
runs it, then removes only its return-focus statement to demonstrate `D07 FOCUS_MISMATCH`.
Both Playwright tests pass because the second explicitly expects that teaching defect.
In application tests, let KeyTrail's assertion throw instead of catching it.

The repository command `pnpm test:package` installs the actual archive into a fresh
temporary consumer, copies these files and runs the tests using that installed package.
To run manually in your own project, install the local `.tgz` and
`@playwright/test@1.64.1`, copy this directory, install Chromium, then run:

```sh
npx playwright test --config playwright.config.ts
npx playwright show-report
```

No server or credentials are needed. You can also open `profile.html` in a browser
and traverse it using Tab, Shift+Tab, Enter and Escape. The component's own code moves
focus; the KeyTrail driver only sends keyboard input and reads state.

`tabs.html` demonstrates manual activation with Enter/Space, arrow navigation and
Home/End. Its test also injects premature selection and expects `T05 PREMATURE_ACTIVATION`.
All six example tests run from the installed archive; three intentionally detect defects.

## Form errors

`form-errors.journey.spec.ts` loads `form-errors.html`. It submits a synthetic invalid
email, checks the declared message and focus, corrects the value through the keyboard,
and confirms that the error disappears. Its second fixture deliberately leaves the
message visible and expects `F06.clear.001` / `ERROR_NOT_CLEARED`.

The example does not contact a server. Mock submissions in real application setup.
The [form API](../../docs/form-errors.md) describes summary links, focus policies and limits.
