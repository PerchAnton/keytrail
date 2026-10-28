import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { readdir, readFile, writeFile, mkdir, rm } from 'node:fs/promises';
import { join } from 'node:path';

await rm('dist', { recursive: true, force: true });
await mkdir('dist');
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
  await build({ entryPoints: ['src/index.ts'], outfile: `dist/index.${format === 'esm' ? 'js' : 'cjs'}`,
    format, platform: 'node', target: 'node24', bundle: true, packages: 'external' });
}
await build({ entryPoints: { validation: 'src/contracts/dialog.ts', tabsValidation: 'src/contracts/tabs.ts', tabsPlan: 'src/engine/tabs-plan.ts', plan: 'src/engine/plan.ts', result: 'src/reporting/result.ts' },
  outdir: 'artifacts/unit', format: 'esm', platform: 'node', target: 'node24', bundle: true, packages: 'external' });
