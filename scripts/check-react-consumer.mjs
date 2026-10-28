import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { cp, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { tmpdir } from 'node:os';

export async function checkReactConsumer({ root, archive, storeDirectory, version }) {
  const consumer = await mkdtemp(join(tmpdir(), 'keytrail-react-consumer-'));
  const run = (args, expectedStatus = 0, extraEnv = {}) => {
    const result = spawnSync('pnpm', args, { cwd: consumer, env: { ...process.env, ...extraEnv },
      encoding: 'utf8', timeout: 120000, maxBuffer: 4 * 1024 * 1024 });
    assert.ifError(result.error);
    assert.equal(result.signal, null);
    assert.equal(result.status, expectedStatus, `${args.join(' ')}\n${result.stdout}\n${result.stderr}`);
    return result;
  };
  try {
    await cp(join(root, 'examples/react-portal'), consumer, { recursive: true,
      filter: path => !['node_modules', 'dist', 'reports', 'test-results'].includes(basename(path)) });
    const pkg = JSON.parse(await readFile(join(consumer, 'package.json'), 'utf8'));
    pkg.devDependencies.keytrail = `file:${archive}`;
    await writeFile(join(consumer, 'package.json'), JSON.stringify(pkg, null, 2));
    run(['install', '--offline', '--ignore-scripts', '--no-frozen-lockfile', '--store-dir', storeDirectory]);
    const installed = JSON.parse(await readFile(join(consumer, 'node_modules/keytrail/package.json'), 'utf8'));
    assert.equal(installed.version, version);
    assert.equal(installed.dependencies?.react, undefined);
    run(['test:types']); run(['build']); run(['test']); run(['test:guard']);
    const negative = run(['test:guard'], 1, { KEYTRAIL_NEGATIVE_CONTROL: '1' });
    assert.match(negative.stdout + negative.stderr, /D03 FOCUS_MISMATCH/);
    assert.match(negative.stdout + negative.stderr, /\[KeyTrail CI\]/);

    for (const [name, passed, failed] of [['teaching', 3, 0], ['guarded', 1, 0], ['negative', 0, 1]]) {
      const folder = join(consumer, 'reports', name);
      const results = JSON.parse(await readFile(join(folder, 'results.json'), 'utf8'));
      assert.equal(results.stats.expected, passed); assert.equal(results.stats.unexpected, failed);
      assert.equal(results.stats.flaky, 0); assert.equal(results.stats.skipped, 0);
      const html = await readFile(join(folder, 'html/index.html'), 'utf8');
      assert.match(html, /<!DOCTYPE html>/i);
      const junit = await readFile(join(folder, 'junit.xml'), 'utf8');
      const totals = junit.match(/<testsuites\s[^>]*>/)?.[0];
      assert(totals, 'JUnit totals are present');
      const count = name => Number(totals.match(new RegExp(` ${name}="(\\d+)"`))?.[1] ?? 0);
      assert.equal(count('tests'), passed + failed);
      // Playwright classifies a custom thrown assertion as a JUnit error.
      assert.equal(count('failures') + count('errors'), failed);
      assert.equal(count('skipped'), 0);
      if (failed) {
        assert.match(junit, /D03 FOCUS_MISMATCH/);
        assert.match(junit, /<(?:error|failure) /);
        const tests = results.suites.flatMap(function visit(suite) {
          return [...(suite.specs ?? []).flatMap(s => s.tests), ...(suite.suites ?? []).flatMap(visit)];
        });
        const attachment = tests[0].results[0].attachments.find(a => a.name === 'journey-result.json');
        assert(attachment, 'The failed test must retain its journey attachment');
        const report = JSON.parse(attachment.body ? Buffer.from(attachment.body, 'base64').toString('utf8') : await readFile(attachment.path, 'utf8'));
        assert.equal(report.outcome, 'failed'); assert.equal(report.coverage.complete, false);
        const pending = report.checks.filter(c => c.status === 'not_run');
        assert(pending.length > 0 && pending.every(c => c.blockedBy === 'D03.initial'));
        await writeFile(join(folder, 'journey-result.json'), JSON.stringify(report, null, 2) + '\n');
      }
    }
    const reports = join(root, 'artifacts/consumers/react-portal');
    await rm(reports, { recursive: true, force: true });
    await cp(join(consumer, 'reports'), join(reports, 'reports'), { recursive: true });
    await cp(join(consumer, 'test-results'), join(reports, 'test-results'), { recursive: true });
    return { offlineInstall: true, react: pkg.dependencies.react, reactDom: pkg.dependencies['react-dom'],
      types: true, strictMode: true, browserTests: 3, guardedJourneys: 1, negativeExitCode: 1,
      html: true, junit: true, failedAttachment: true, dependencyReferences: true };
  } finally { await rm(consumer, { recursive: true, force: true }); }
}
