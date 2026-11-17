import { defineConfig } from 'vite';
import { fileURLToPath } from 'node:url';
import { svelte } from '@sveltejs/vite-plugin-svelte';
export default defineConfig({ plugins: [svelte()],
  // NG-ZORRO exports this asset under the style condition. Resolve only that CSS
  // asset, so other packages still select their JavaScript entry points.
  resolve: { alias: { 'ng-zorro-antd/ng-zorro-antd.css': fileURLToPath(new URL('./node_modules/ng-zorro-antd/ng-zorro-antd.min.css', import.meta.url)) } },
  build: { target: 'es2022' }, define: { __VUE_OPTIONS_API__: true, __VUE_PROD_DEVTOOLS__: false, __VUE_PROD_HYDRATION_MISMATCH_DETAILS__: false } });
