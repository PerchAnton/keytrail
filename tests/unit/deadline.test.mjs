import { test } from 'node:test';
import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { Driver } from '../../artifacts/unit/driver.js';

test('the total scenario deadline is cumulative and caps each operation', async t => {
  let now = 100;
  t.mock.method(performance, 'now', () => now);
  const page = new EventEmitter(); page.isClosed = () => false;
  const driver = new Driver(page, [], {}, { timeoutMs: 250, scenarioTimeoutMs: 1000 }, now);
  try {
    assert.equal(driver.remaining(), 250);
    now = 700; assert.equal(driver.remaining(), 250);
    now = 950; assert.equal(driver.remaining(), 150);
    now = 1099; assert.equal(driver.remaining(), 1);
    now = 1100;
    assert.throws(() => driver.guard(), { code: 'SCENARIO_TIMEOUT' });
    assert.throws(() => driver.remaining(), { code: 'SCENARIO_TIMEOUT' });
    assert.equal(driver.steps.length, 0);
  } finally { await driver.dispose(); }
});
