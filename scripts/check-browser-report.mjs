import { readFile } from 'node:fs/promises';
import { inspectReport, digest, semanticSignatures } from '../verification/signatures.mjs';

const [file, workerArgument, ...extra] = process.argv.slice(2);
if (!file || !/^[1-9]\d*$/.test(workerArgument ?? '') || extra.length) {
  throw new Error('Usage: node scripts/check-browser-report.mjs <report.json> <workers>');
}
const workers = Number(workerArgument);
if (!Number.isSafeInteger(workers)) throw new Error('Invalid worker count');
const report = JSON.parse(await readFile(file, 'utf8'));
const runIds = new Set();
const cases = inspectReport(report, workers, runIds);
console.log(JSON.stringify({
  status: 'passed', cases: cases.length, journeys: runIds.size,
  engineCases: cases.filter(value => value.kind === 'engine-observation').length,
  workers, signature: digest(semanticSignatures(cases)),
}, null, 2));
