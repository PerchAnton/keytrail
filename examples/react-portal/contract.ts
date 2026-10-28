import type { Page } from '@playwright/test';
import type { DialogContract } from 'keytrail';

export function profileContract(page: Page): DialogContract {
  const trigger = { id: 'open-profile', locator: page.getByRole('button', { name: 'Edit profile', exact: true }) };
  const name = { id: 'display-name', locator: page.getByLabel('Display name') };
  const close = { id: 'close-profile', locator: page.getByRole('button', { name: 'Close', exact: true }) };
  return { id: 'react-profile', trigger,
    dialog: { id: 'profile', locator: page.getByRole('dialog', { name: 'Edit profile' }) },
    openKey: 'Enter', initialFocus: name, tabOrder: [name, close], closeKey: 'Escape', returnFocus: trigger };
}
