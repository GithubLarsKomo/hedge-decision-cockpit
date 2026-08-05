import http from 'node:http';

const host = '127.0.0.1';
const port = Number(process.env.FRED_SCHEDULER_SMOKE_PORT ?? 3200);
const expectedToken = process.env.FRED_SCHEDULER_SMOKE_TOKEN ?? 'test-token-for-ci';

const server = http.createServer((request, response) => {
  if (request.method === 'GET' && request.url === '/health') {
    response.writeHead(200, { 'content-type': 'text/plain' });
    response.end('ok');
    return;
  }

  const chunks = [];
  request.on('data', chunk => chunks.push(chunk));
  request.on('end', () => {
    const body = Buffer.concat(chunks).toString('utf8');
    const valid = request.method === 'POST'
      && request.url === '/api/market-data/fred/sync'
      && request.headers.authorization === `Bearer ${expectedToken}`
      && request.headers['content-type'] === 'application/json'
      && body === '{}';

    if (!valid) {
      response.writeHead(400, { 'content-type': 'application/json' });
      response.end(JSON.stringify({ error: 'Unexpected scheduler request.' }));
      return;
    }

    response.writeHead(200, { 'content-type': 'application/json' });
    response.end(JSON.stringify({
      source: 'fred:NASDAQ100+VIXCLS',
      observationStart: '2026-07-26',
      observationEnd: '2026-08-05',
      requested: 7,
      inserted: 0,
      skipped: 7
    }));
  });
});

server.listen(port, host, () => {
  console.log(`fred scheduler smoke server listening on http://${host}:${port}`);
});

for (const signal of ['SIGINT', 'SIGTERM']) {
  process.on(signal, () => server.close(() => process.exit(0)));
}
