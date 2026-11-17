import { build } from 'esbuild';
import { mkdir, copyFile, cp } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
execFileSync(process.execPath, ['scripts/build.mjs'], { cwd: fileURLToPath(new URL('../../', import.meta.url)), stdio: 'inherit' });
// Resolve the current checkout's built SDK against this consumer's single peer installation.
await cp(new URL('../../dist/', import.meta.url), new URL('artifacts/keytrail/', import.meta.url), { recursive: true });
await mkdir(new URL('dist/', import.meta.url), { recursive: true });
await build({ absWorkingDir: new URL('.', import.meta.url).pathname,
  entryPoints: ['app.jsx'], bundle: true, outdir: 'dist', format: 'esm',
  define: { 'process.env.NODE_ENV': '"development"', __VUE_OPTIONS_API__: 'true',
    __VUE_PROD_DEVTOOLS__: 'false', __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: 'false' },
  loader: { '.png': 'dataurl', '.svg': 'dataurl' } });
await copyFile(new URL('index.html', import.meta.url), new URL('dist/index.html', import.meta.url));
