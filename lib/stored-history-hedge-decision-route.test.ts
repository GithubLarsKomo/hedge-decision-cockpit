import assert from 'node:assert/strict';
import test from 'node:test';
import { NextRequest } from 'next/server';
import { POST } from '../app/api/hedge-decisions/from-history/route';

test('stored-history hedge decision endpoint rejects invalid bearer authentication', async () => {
  const previous = process.env.N8N_INGEST_TOKEN;
  process.env.N8N_INGEST_TOKEN = 'test-secret';
  try {
    const request = new NextRequest('http://localhost/api/hedge-decisions/from-history', {
      method: 'POST',
      headers: {
        authorization: 'Bearer wrong-secret',
        'content-type': 'application/json'
      },
      body: JSON.stringify({ source: 'nasdaq-fred-daily' })
    });
    const response = await POST(request);
    assert.equal(response.status, 401);
    const body = await response.json();
    assert.equal(body.error, 'Unauthorized');
    assert.equal(typeof body.requestId, 'string');
  } finally {
    if (previous === undefined) delete process.env.N8N_INGEST_TOKEN;
    else process.env.N8N_INGEST_TOKEN = previous;
  }
});
