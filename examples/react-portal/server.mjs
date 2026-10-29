import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';

export async function startServer(port = 0) {
  const assets = new Map(await Promise.all([
    ['/', 'index.html', 'text/html; charset=utf-8'],
    ['/app.js', 'app.js', 'text/javascript; charset=utf-8'],
    ['/app.css', 'app.css', 'text/css; charset=utf-8'],
  ].map(async ([path, file, type]) => [path, { body: await readFile(new URL(`dist/${file}`, import.meta.url)), type }])));
  const server = createServer((request, response) => {
    const path = (request.url ?? '/').split('?')[0];
    const asset = assets.get(path);
    if (!['GET', 'HEAD'].includes(request.method ?? '')) {
      response.writeHead(405, { Allow: 'GET, HEAD' }); response.end(); return;
    }
    if (!asset) { response.writeHead(404); response.end('Not found'); return; }
    response.writeHead(200, { 'Content-Type': asset.type, 'Cache-Control': 'no-store' });
    response.end(request.method === 'HEAD' ? undefined : asset.body);
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(port, '127.0.0.1', () => { server.off('error', reject); resolve(); });
  });
  const url = `http://127.0.0.1:${server.address().port}`;
  return { url, close: () => new Promise((resolve, reject) => {
    server.close(error => error ? reject(error) : resolve());
    server.closeAllConnections();
  }) };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT ?? 4173);
  if (!Number.isInteger(port) || port < 0 || port > 65535) throw new Error('PORT must be an integer from 0 to 65535');
  const server = await startServer(port);
  console.log(`React portal example: ${server.url}`);
  for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => void server.close());
}
