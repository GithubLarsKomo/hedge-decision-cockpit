import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, it } from 'node:test';
import { NextRequest } from 'next/server';
import { POST } from '../app/api/portfolio-snapshots/import/route';
import { prisma } from './prisma';
import { computePortfolioSnapshotFingerprint } from './portfolio-snapshot';

function fixture(): Record<string, unknown> {
  return JSON.parse(readFileSync(join(process.cwd(), 'fixtures', 'portfolio-snapshot', 'valid.json'), 'utf8'));
}

function request(body: unknown, token = 'test-token-for-ci') {
  return new NextRequest('http://localhost/api/portfolio-snapshots/import', {
    method: 'POST',
    headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
    body: JSON.stringify(body)
  });
}

describe('portfolio snapshot import route', () => {
  beforeEach(async () => {
    process.env.N8N_INGEST_TOKEN = 'test-token-for-ci';
    await prisma.importedPortfolioSnapshot.deleteMany();
  });

  it('returns 201 for a new snapshot and 200 for an exact idempotent re-import', async () => {
    const snapshot = fixture();
    const created = await POST(request(snapshot));
    assert.equal(created.status, 201);
    assert.equal((await created.json()).created, true);

    const repeated = await POST(request(snapshot));
    assert.equal(repeated.status, 200);
    assert.equal((await repeated.json()).created, false);
  });

  it('returns 409 when the same snapshot revision has different valid content', async () => {
    const snapshot = fixture();
    assert.equal((await POST(request(snapshot))).status, 201);

    const changed = structuredClone(snapshot);
    const strategy = changed.strategy as Record<string, unknown>;
    strategy.version = 'conflicting-revision';
    changed.input_fingerprint = computePortfolioSnapshotFingerprint(changed);

    assert.equal((await POST(request(changed))).status, 409);
  });

  it('returns 422 for an invalid snapshot', async () => {
    const snapshot = fixture();
    snapshot.input_fingerprint = `sha256:${'0'.repeat(64)}`;
    assert.equal((await POST(request(snapshot))).status, 422);
  });

  it('returns 401 for an invalid bearer token', async () => {
    assert.equal((await POST(request(fixture(), 'wrong-token'))).status, 401);
  });
});
