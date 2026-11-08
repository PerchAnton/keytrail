// A downstream-style 0.1.0 consumer kept unchanged for the 1.x contract.
// Compile against the built package, not private source modules.
import {
  assertDialogJourney, assertTabsJourney, assertFormErrorsJourney,
  JourneyAssertionError,
  type DialogContract, type TabsContract, type FormErrorsContract,
  type JourneyResult, type CheckStatus,
} from 'keytrail';
import CiGuard, { type CiGuardOptions } from 'keytrail/ci-guard';
import type { Page, TestInfo } from '@playwright/test';

export async function runExistingContracts(page: Page, info: TestInfo,
  dialog: DialogContract, tabs: TabsContract, form: FormErrorsContract): Promise<void> {
  const options: CiGuardOptions = { projectName: 'journey' };
  new CiGuard(options);
  try {
    const result: JourneyResult = await assertDialogJourney(page, info, dialog);
    const schema: '1' = result.schemaVersion;
    void schema;
    await assertTabsJourney(page, info, tabs);
    await assertFormErrorsJourney(page, info, form);
  } catch (error: unknown) {
    if (error instanceof JourneyAssertionError) {
      const result: JourneyResult = error.result;
      const sameCode: typeof error.code = result.checks[0]!.messageCode;
      void sameCode;
    }
    throw error;
  }
}

export function label(status: CheckStatus): string {
  switch (status) {
    case 'pass': return 'passed';
    case 'fail': return 'failed';
    case 'blocked': return 'blocked';
    case 'not_run': return 'not run';
    default: { const exhaustive: never = status; return exhaustive; }
  }
}
