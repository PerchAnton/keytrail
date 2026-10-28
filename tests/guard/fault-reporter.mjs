// Test-only fault injection into the reporter API, before the guard sees a result.
export default class FaultReporter {
  onTestEnd(test, result) {
    const mode = process.env.KEYTRAIL_GUARD_CASE;
    if (mode === 'both-sources') result.attachments[0].path = '/synthetic-private-path-canary';
    if (mode === 'read-failure') { delete result.attachments[0].body; result.attachments[0].path = '/synthetic-private-path-canary'; }
    if (mode === 'directory') { delete result.attachments[0].body; result.attachments[0].path = process.cwd(); }
    if (mode === 'internal-error') Object.defineProperty(result, 'attachments', { get() { throw new Error('synthetic-private-error-canary'); } });
  }
}
