import { build } from 'esbuild';
import { copyFile, mkdir } from 'node:fs/promises';
await mkdir('dist', { recursive: true });
await build({ entryPoints: ['app.tsx'], bundle: true, outdir: 'dist', format: 'esm',
  // Keep development StrictMode effect checks in this teaching fixture.
  define: { 'process.env.NODE_ENV': '"development"' } });
await copyFile('index.html', 'dist/index.html');
