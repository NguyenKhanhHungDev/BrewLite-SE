import { createServer } from 'node:http';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

// This entry point is required for BFF IP throttling. Never trust client XFF.
// A future external ingress needs an explicitly reviewed proxy topology.
export function sanitizePeerHeaders(request) {
  request.headers['x-forwarded-for'] = request.socket.remoteAddress ?? '';
  delete request.headers['x-brewlite-client-ip'];
  delete request.headers['x-brewlite-proxy-secret'];
  delete request.headers['x-forwarded-host'];
  delete request.headers['x-forwarded-proto'];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { default: next } = await import('next');
  const dev = process.argv.includes('--dev');
  const hostname = process.env.BIND_ADDRESS ?? '0.0.0.0';
  const port = Number(process.env.PORT ?? 3000);
  const app = next({ dev, hostname, port });
  await app.prepare();
  const handler = app.getRequestHandler();
  const server = createServer((request, response) => {
    sanitizePeerHeaders(request);
    handler(request, response).catch(() => {
      if (!response.headersSent) response.writeHead(500);
      response.end();
    });
  });
  server.listen(port, hostname);
}
