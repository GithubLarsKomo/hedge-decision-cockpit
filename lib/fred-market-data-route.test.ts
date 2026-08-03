import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { POST } from '../app/api/market-data/fred/sync/route';

test('FRED sync endpoint rejects invalid bearer authentication before provider access', async () => {
  const previousToken = process.env.N8N_INGEST_TOKEN;
  const previousFredKey = process.env.FRED_API_KEY;
  process.env.N8N_INGEST_TOKEN = 'test-secret';
  delete process.env.FRED_API_KEY;
  try {
    const request = new NextRequest('http://localhost/api/market-data/fred/sync', {
      method: 'POST',
      headers: {
        authorization: 'Bearer wrong-secret',
        'content-type': 'application/json'
      },
      body: '{}'
    });
    const response = await POST(request);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'Unauthorized' });
  } finally {
    if (previousToken === undefined) delete process.env.N8N_INGEST_TOKEN;
    else process.env.N8N_INGEST_TOKEN = previousToken;
    if (previousFredKey === undefined) delete process.env.FRED_API_KEY;
    else process.env.FRED_API_KEY = previousFredKey;
  }
});
