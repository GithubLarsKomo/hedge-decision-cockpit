import assert from 'node:assert/strict';
import test from 'node:test';
import { normalizeMarketSnapshot } from './market-snapshot';
import { persistMarketSnapshots, toMarketSnapshotCreateData } from './market-snapshot-store';

const first = normalizeMarketSnapshot({
  observedAt: '2020-03-16T20:00:00Z',
  source: 'historical-import',
  ndxClose: 7020,
  ndxReferenceHigh: 9736,
  vixClose: 82.69,
  vxnClose: 80.08,
  riskFreeRate: 0.003,
  dividendYield: 0.01
});

const second = normalizeMarketSnapshot({
  observedAt: '2020-03-17T20:00:00Z',
  source: 'historical-import',
  ndxClose: 7473,
  ndxReferenceHigh: 9736,
  vixClose: 75.91,
  vxnClose: 72.5
});

test('maps normalized snapshots to persistence values', () => {
  const data = toMarketSnapshotCreateData(first);
  assert.equal(data.observedAt.toISOString(), first.observedAt);
  assert.equal(data.contentHash, first.contentHash);
  assert.equal(data.ndxDrawdownPercent, first.ndxDrawdownPercent);
});

test('persists a batch idempotently and reports skipped rows', async () => {
  let received: unknown;
  const store = {
    marketSnapshot: {
      async createMany(args: unknown) {
        received = args;
        return { count: 1 };
      }
    }
  };

  const result = await persistMarketSnapshots(store, [first, second]);
  assert.deepEqual(result, { requested: 2, inserted: 1, skipped: 1 });
  assert.equal((received as { skipDuplicates: boolean }).skipDuplicates, true);
  assert.equal((received as { data: unknown[] }).data.length, 2);
});

test('does not call the database for an empty batch', async () => {
  let called = false;
  const store = {
    marketSnapshot: {
      async createMany() {
        called = true;
        return { count: 0 };
      }
    }
  };

  assert.deepEqual(await persistMarketSnapshots(store, []), { requested: 0, inserted: 0, skipped: 0 });
  assert.equal(called, false);
});

test('rejects duplicate hashes before database access', async () => {
  const store = {
    marketSnapshot: {
      async createMany() {
        throw new Error('must not be called');
      }
    }
  };

  await assert.rejects(() => persistMarketSnapshots(store, [first, first]), /Duplicate content hash/);
});