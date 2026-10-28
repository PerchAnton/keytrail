import { createHash } from 'node:crypto';
import { closeSync, constants, fstatSync, openSync, readSync } from 'node:fs';
import type { FullConfig, FullResult, Reporter, Suite, TestCase, TestResult } from '@playwright/test/reporter';
import { validJourneyResult } from './reporting/validate.js';

export type CiGuardOptions = { projectName?: string };
const MAX_BYTES = 5 * 1024 * 1024;
type Code = 'CONFIG_INVALID' | 'EMPTY_SUITE' | 'INTERNAL_ERROR' | 'RUN_ERROR' | 'TEST_NOT_RUN'
  | 'TEST_UNEXPECTED' | 'ATTEMPT_REPEATED' | 'TEST_STATUS' | 'EXPECTED_STATUS'
  | 'ATTACHMENT_COUNT' | 'ATTACHMENT_TYPE' | 'ATTACHMENT_SOURCE' | 'ATTACHMENT_READ'
  | 'ATTACHMENT_SIZE' | 'REPORT_JSON' | 'REPORT_INVALID' | 'TEST_REF' | 'ATTEMPT_REF'
  | 'RUN_REPEATED' | 'JOURNEY_INCOMPLETE';
class Violation extends Error {
  constructor(readonly code: Code) { super(code); }
}
function readAttachment(attachment: TestResult['attachments'][number]): Buffer {
  if (attachment.contentType !== 'application/json') throw new Violation('ATTACHMENT_TYPE');
  const { body, path } = attachment;
  if ((body === undefined) === (path === undefined)) throw new Violation('ATTACHMENT_SOURCE');
  if (body !== undefined) {
    if (!Buffer.isBuffer(body)) throw new Violation('ATTACHMENT_SOURCE');
    if (body.length > MAX_BYTES) throw new Violation('ATTACHMENT_SIZE');
    return body;
  }
  if (typeof path !== 'string' || !path) throw new Violation('ATTACHMENT_SOURCE');
  let fd: number | undefined;
  try {
    // NONBLOCK prevents special files such as FIFOs from hanging the runner.
    fd = openSync(path, constants.O_RDONLY | constants.O_NONBLOCK);
    const stat = fstatSync(fd);
    if (!stat.isFile()) throw new Violation('ATTACHMENT_READ');
    if (stat.size > MAX_BYTES) throw new Violation('ATTACHMENT_SIZE');
    // The extra byte detects a file that grows after fstat without an unbounded read.
    const buffer = Buffer.alloc(MAX_BYTES + 1);
    let size = 0;
    while (size < buffer.length) {
      const bytes = readSync(fd, buffer, size, buffer.length - size, null);
      if (!bytes) break;
      size += bytes;
    }
    if (size > MAX_BYTES) throw new Violation('ATTACHMENT_SIZE');
    return buffer.subarray(0, size);
  } catch (error) {
    throw error instanceof Violation ? error : new Violation('ATTACHMENT_READ');
  } finally { if (fd !== undefined) closeSync(fd); }
}

/** Put this reporter last. It fails the selected project on any incomplete attempt. */
export default class CiGuard implements Reporter {
  private projectName = 'journey';
  private violations = 0;
  private begun = false;
  private tests = new Map<string, Set<number>>();
  private runs = new Set<string>();
  constructor(options: CiGuardOptions = {}) {
    try {
      if (!options || typeof options !== 'object' ||
          (options.projectName !== undefined && (typeof options.projectName !== 'string' || !options.projectName.trim()))) {
        this.record('CONFIG_INVALID');
      } else this.projectName = options.projectName ?? 'journey';
    } catch { this.record('CONFIG_INVALID'); }
  }
  printsToStdio(): boolean { return true; }
  private record(code: Code, testId?: string, attempt?: number): void {
    this.violations++;
    if (this.violations > 20) return;
    try {
      const ref = typeof testId === 'string' ? ` testRef=${createHash('sha256').update(testId).digest('hex')}` : '';
      const retry = Number.isSafeInteger(attempt) && attempt! >= 0 ? ` attempt=${attempt}` : '';
      process.stderr.write(`[KeyTrail CI] ${code}${ref}${retry}\n`);
    } catch { /* The verdict stays failed even when diagnostic output is unavailable. */ }
  }
  onBegin(_config: FullConfig, suite: Suite): void {
    try {
      this.begun = true;
      for (const test of suite.allTests()) {
        if (test.parent.project()?.name !== this.projectName) continue;
        if (this.tests.has(test.id)) this.record('TEST_UNEXPECTED');
        this.tests.set(test.id, new Set());
      }
      if (!this.tests.size) this.record('EMPTY_SUITE');
    } catch { this.record('INTERNAL_ERROR'); }
  }
  onTestEnd(test: TestCase, result: TestResult): void {
    try {
      if (test.parent.project()?.name !== this.projectName) return;
      const attempts = this.tests.get(test.id);
      if (!attempts) { this.record('TEST_UNEXPECTED'); return; }
      const fail = (code: Code) => this.record(code, test.id, result.retry);
      if (attempts.has(result.retry)) fail('ATTEMPT_REPEATED');
      attempts.add(result.retry);
      if (result.status !== 'passed') fail('TEST_STATUS');
      if (test.expectedStatus !== 'passed') fail('EXPECTED_STATUS');
      const attachments = result.attachments.filter(a => a.name === 'journey-result.json');
      if (attachments.length !== 1) { fail('ATTACHMENT_COUNT'); return; }
      const bytes = readAttachment(attachments[0]!);
      let report: unknown;
      try { report = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
      catch { fail('REPORT_JSON'); return; }
      if (!validJourneyResult(report)) { fail('REPORT_INVALID'); return; }
      if (report.run.testRef !== createHash('sha256').update(test.id).digest('hex')) fail('TEST_REF');
      if (report.run.attempt !== result.retry) fail('ATTEMPT_REF');
      if (this.runs.has(report.run.runId)) fail('RUN_REPEATED');
      this.runs.add(report.run.runId);
      if (report.outcome !== 'passed' || !report.coverage.complete) fail('JOURNEY_INCOMPLETE');
    } catch (error) { this.record(error instanceof Violation ? error.code : 'INTERNAL_ERROR'); }
  }
  onError(): void { this.record('RUN_ERROR'); }
  async onEnd(result: FullResult): Promise<{ status: FullResult['status'] }> {
    try {
      if (!this.begun || !this.tests.size) this.record('EMPTY_SUITE');
      for (const [id, attempts] of this.tests) if (!attempts.size) this.record('TEST_NOT_RUN', id);
    } catch { this.record('INTERNAL_ERROR'); }
    return { status: result.status === 'passed' && this.violations ? 'failed' : result.status };
  }
}
