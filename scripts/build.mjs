import { build } from 'esbuild';
import Ajv2020 from 'ajv/dist/2020.js';
import standaloneCode from 'ajv/dist/standalone/index.js';
import { execFileSync } from 'node:child_process';
import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

await rm('dist', { recursive: true, force: true });
await mkdir('dist');
await mkdir('artifacts/generated', { recursive: true });
const ajv = new Ajv2020({ strict: true, code: { source: true }, allErrors: false });
const validator = ajv.compile(JSON.parse(await readFile('schema/journey-result.v1.json', 'utf8')));
await writeFile('artifacts/generated/schema-validator.cjs', standaloneCode(ajv, validator));
await writeFile('artifacts/generated/schema-validator.d.cts', 'declare function validate(value: unknown): boolean;\nexport = validate;\n');
const options = { platform: 'node', target: 'node24', bundle: true,
  external: ['@playwright/test', '@playwright/test/*'] };
execFileSync(process.execPath, ['node_modules/typescript/bin/tsc', '-p', 'tsconfig.json'], { stdio: 'inherit' });
async function cjsTypes(dir) {
  for (const f of await readdir(dir, { withFileTypes: true })) {
    const path = join(dir, f.name);
    if (f.isDirectory()) await cjsTypes(path);
    else if (path.endsWith('.d.ts')) {
      const text = await readFile(path, 'utf8');
      await writeFile(path.replace(/\.d\.ts$/, '.d.cts'), text.replace(/(from\s+['"]\.[^'"]+)\.js(['"])/g, '$1.cjs$2'));
    }
  }
}
await cjsTypes('dist');
for (const format of ['esm', 'cjs']) {
  await build({ entryPoints: ['src/index.ts', 'src/ci-guard.ts'], outdir: 'dist', outExtension: { '.js': format === 'esm' ? '.js' : '.cjs' },
    ...options, format });
}
await build({ entryPoints: { serialize: 'src/reporting/serialize.ts', validate: 'src/reporting/validate.ts', formValidation: 'src/contracts/form-errors.ts', formPlan: 'src/engine/form-errors-plan.ts', validation: 'src/contracts/dialog.ts', tabsValidation: 'src/contracts/tabs.ts', tabsPlan: 'src/engine/tabs-plan.ts', plan: 'src/engine/plan.ts', result: 'src/reporting/result.ts' },
  outdir: 'artifacts/unit', ...options, format: 'esm' });
