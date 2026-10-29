import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { readFile, writeFile, mkdir, rm, access, readdir } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { createHash } from 'node:crypto';

const require = createRequire(import.meta.url);
const cli = require.resolve('@playwright/test/cli');
const cases = [
  ['window-pass', 0], ['observation-gap', 1, 'JOURNEY_INCOMPLETE'], ['gap-pass', 1, 'REPORT_INVALID'], ['missing-window', 1, 'REPORT_INVALID'],
  ['body', 0], ['path', 0], ['limit-body', 0], ['limit-path', 0], ['workers-repeat', 0], ['dependency-pass', 0],
  ['missing', 1, 'ATTACHMENT_COUNT'], ['duplicate', 1, 'ATTACHMENT_COUNT'], ['mime', 1, 'ATTACHMENT_TYPE'],
  ['both-sources', 1, 'ATTACHMENT_SOURCE'], ['read-failure', 1, 'ATTACHMENT_READ'], ['directory', 1, 'ATTACHMENT_READ'],
  ['internal-error', 1, 'INTERNAL_ERROR'], ['write-failure', 1, 'TEST_STATUS'],
  ['bad-json', 1, 'REPORT_JSON'], ['bad-utf8', 1, 'REPORT_JSON'],
  ['large-body', 1, 'ATTACHMENT_SIZE'], ['large-path', 1, 'ATTACHMENT_SIZE'],
  ...['schema', 'extra-field', 'coverage', 'coverage-total', 'outcome', 'duplicate-check', 'duplicate-step',
    'step-ref', 'code', 'rule-family', 'check-id', 'unreached', 'action'].map(id => [id, 1, 'REPORT_INVALID']),
  ['wrong-test', 1, 'TEST_REF'], ['wrong-attempt', 1, 'ATTEMPT_REF'],
  ['failed-report', 1, 'JOURNEY_INCOMPLETE'], ['incomplete', 1, 'JOURNEY_INCOMPLETE'],
  ['skip', 1, 'TEST_STATUS'], ['static-skip', 1, 'TEST_STATUS'], ['fixme', 1, 'EXPECTED_STATUS'],
  ['expected-failure', 1, 'EXPECTED_STATUS'], ['timeout', 1, 'TEST_STATUS'], ['retry', 1, 'TEST_STATUS'], ['retry-incomplete', 1, 'JOURNEY_INCOMPLETE'],
  ['empty-suite', 1, 'EMPTY_SUITE'], ['wrong-project', 1, 'EMPTY_SUITE'], ['invalid-options', 1, 'CONFIG_INVALID'],
  ['dependency-failure', 1, 'TEST_NOT_RUN'], ['global-timeout', 1, 'RUN_ERROR'], ['interrupted', 130, 'TEST_STATUS'],
];
const records = [];
await mkdir('artifacts', { recursive: true });
const ready = resolve('artifacts/guard-ready');
for (const [id, expectedExit, expectedCode] of cases) {
  await rm(ready, { force: true });
  const args = [cli, 'test', '--config', 'tests/guard/playwright.config.mjs'];
  if (id === 'empty-suite') args.push('--grep', 'not-a-test', '--pass-with-no-tests');
  if (id === 'workers-repeat') args.push('--workers', '4', '--repeat-each', '4');
  let log = '';
  const child = spawn(process.execPath, args, { env: { ...process.env, KEYTRAIL_GUARD_CASE: id, KEYTRAIL_GUARD_READY: ready }, stdio: ['ignore', 'pipe', 'pipe'] });
  child.stdout.on('data', chunk => { log += chunk; }); child.stderr.on('data', chunk => { log += chunk; });
  const timeout = setTimeout(() => child.kill('SIGKILL'), 35000);
  let interrupt;
  if (id === 'interrupted') interrupt = setInterval(async () => {
    try { await access(ready); clearInterval(interrupt); child.kill('SIGINT'); } catch {}
  }, 50);
  const actualExit = await new Promise((resolve, reject) => { child.on('error', reject); child.on('close', (code, signal) => resolve(signal ?? code)); });
  clearTimeout(timeout); clearInterval(interrupt);
  const lines = log.split('\n').filter(line => line.startsWith('[KeyTrail CI]'));
  const codes = [...new Set(lines.map(line => line.split(' ')[2]))].sort();
  assert.equal(actualExit, expectedExit, `${id}: ${log.slice(-8000)}`);
  if (expectedCode) assert(codes.includes(expectedCode), `${id}: expected ${expectedCode}; got ${codes}`);
  else assert.deepEqual(codes, [], `${id}: ${log.slice(-8000)}`);
  assert(!lines.some(line => /synthetic-private|fixture\.spec|secret|payload|\/Users\/|\/home\//.test(line)), id);
  records.push({ case: id, expectedExit, actualExit, codes });
  console.log(`${id}: exit ${actualExit}`);
}
const hashes = {};
for (const directory of ['src', 'tests/guard']) {
  async function walk(dir) {
    for (const entry of await readdir(dir, { withFileTypes: true })) {
      const path = join(dir, entry.name);
      if (entry.isDirectory()) await walk(path);
      else hashes[path] = createHash('sha256').update((await readFile(path, 'utf8')).replaceAll('\r\n', '\n')).digest('hex');
    }
  }
  await walk(directory);
}
for (const path of ['scripts/check-guard.mjs', 'scripts/build.mjs', 'schema/journey-result.v1.json']) {
  hashes[path] = createHash('sha256').update((await readFile(path, 'utf8')).replaceAll('\r\n', '\n')).digest('hex');
}
const pkg = JSON.parse(await readFile('package.json', 'utf8'));
const proof = { recordedAt: new Date().toISOString(), version: pkg.version, node: process.version,
  platform: process.platform, playwright: pkg.peerDependencies['@playwright/test'],
  scope: 'Actual Playwright subprocess exit codes using synthetic reports and fault injection; browser consumers checked separately.',
  sourceHashes: hashes, cases: records };
await writeFile('artifacts/guard-verification.json', JSON.stringify(proof, null, 2) + '\n');
