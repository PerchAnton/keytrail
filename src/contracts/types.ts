import type { Locator } from '@playwright/test';

export type Target = Readonly<{ id: string; locator: Locator }>;
export type CommonContract = Readonly<{
  id: string;
  contractVersion?: string;
  entry?: Readonly<{ maxTabs?: number }>;
  timeoutMs?: number;
  scenarioTimeoutMs?: number;
  observationWindowMs?: number;
}>;
export type DialogContract = CommonContract & Readonly<{
  trigger: Target;
  dialog: Target;
  openKey: 'Enter' | 'Space';
  initialFocus: Target;
  tabOrder: readonly Target[];
  closeKey: 'Escape';
  returnFocus: Target;
}>;
export type AppliedConfig = {
  maxTabs: number; timeoutMs: number; scenarioTimeoutMs: number; observationWindowMs: number;
};
export type CheckStatus = 'pass' | 'fail' | 'blocked' | 'not_run';
export type Focus = string;
export type MessageCode = 'OK' | 'NOT_RUN' | 'CONFIG_INVALID' | 'TARGET_AMBIGUOUS'
  | 'TARGET_ALIAS' | 'UNSUPPORTED_CONTEXT' | 'UNSUPPORTED_DIALOG' | 'PAGE_CLOSED'
  | 'NAVIGATION' | 'POPUP' | 'ENTRY_LIMIT' | 'SCENARIO_TIMEOUT' | 'ACTION_LIMIT'
  | 'EXPECTATION_TIMEOUT' | 'FOCUS_MISMATCH' | 'FOCUS_OUTSIDE_DIALOG' | 'ROLE_MISMATCH'
  | 'NAME_MISSING' | 'MODAL_MISMATCH' | 'BROWSER_ERROR' | 'REPORT_WRITE_FAILED';
/** Only technical identifiers and measured facts belong in this allowlist. */
export type SafeObservation = {
  focus?: Focus; visible?: boolean; role?: 'dialog'; hasAccessibleName?: boolean;
  modal?: boolean; inside?: boolean; count?: number; maxTabs?: number; matched?: boolean;
};
export type CheckResult = {
  checkId: string; ruleId: string; stepId: string | null; status: CheckStatus;
  messageCode: MessageCode; expected: SafeObservation; observed: SafeObservation;
  basis: 'contract' | 'apg_guidance'; blockedBy?: string; guidanceUrl?: string;
};
export type StepResult = {
  stepId: string; actionKind: 'press'; key: 'Tab' | 'Shift+Tab' | 'Enter' | 'Space' | 'Escape';
  targetId: string | null; beforeFocus: Focus; afterFocus: Focus; elapsedMs: number;
  observationWindowMs: number;
};
export type JourneyResult = {
  schemaVersion: '1'; rulesetVersion: string; packageVersion: string;
  run: { runId: string; testRef: string; attempt: number; startedAt: string; durationMs: number;
    nodeVersion: string; playwrightVersion: string; browserVersion: string };
  scenario: { id: string; kind: 'dialog'; contractVersion: string };
  config: AppliedConfig; outcome: 'passed' | 'failed' | 'blocked';
  coverage: { planned: number; passed: number; failed: number; blocked: number; notRun: number;
    complete: boolean; entryEvidence: 'tab' | 'already_focused' | 'unreached' };
  checks: CheckResult[]; steps: StepResult[]; limitations: string[];
};
