import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { POST } from '../app/api/market-observations/import/route';

test('raw market observation ingest rejects invalid bearer authentication before persistence', async () => {
  const previous = process.env.N8N_INGEST_TOKEN;
  process.env.N8N_INGEST_TOKEN = 'test-secret';
  try {
    const request = new NextRequest('http://localhost/api/market-observations/import', {
      method: 'POST',
      headers: {
        authorization: 'Bearer wrong-secret',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        observedAt: '2026-08-03T20:00:00.000Z',
        source: 'provider-a',
        ndxClose: 100,
        vixClose: 20
      })
    });
    const response = await POST(request);
    assert.equal(response.status, 401);
    assert.deepEqual(await response.json(), { error: 'Unauthorized' });
  } finally {
    if (previous === undefined) delete process.env.N8N_INGEST_TOKEN;
    else process.env.N8N_INGEST_TOKEN = previous;
  }
});
