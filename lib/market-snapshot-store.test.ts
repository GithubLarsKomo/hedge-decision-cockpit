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

test('persists only rows that are not already present', async () => {
  const createCalls: unknown[] = [];
  let findCall = 0;
  const store = {
    marketSnapshot: {
      async findMany() {
        findCall += 1;
        if (findCall <= 2) {
          return [{
            contentHash: first.contentHash,
            source: first.source,
            observedAt: new Date(first.observedAt)
          }];
        }
        return [];
      },
      async createMany(args: unknown) {
        createCalls.push(args);
        return { count: (args as { data: unknown[] }).data.length };
      }
    }
  };

  const result = await persistMarketSnapshots(store, [first, second]);
  assert.deepEqual(result, { requested: 2, inserted: 1, skipped: 1 });
  assert.equal(createCalls.length, 1);
  assert.equal((createCalls[0] as { data: unknown[] }).data.length, 1);
  assert.equal(
    ((createCalls[0] as { data: Array<{ contentHash: string }> }).data[0]).contentHash,
    second.contentHash
  );
});

test('does not call the database for an empty batch', async () => {
  let called = false;
  const store = {
    marketSnapshot: {
      async findMany() {
        called = true;
        return [];
      },
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
      async findMany() {
        throw new Error('must not be called');
      },
      async createMany() {
        throw new Error('must not be called');
      }
    }
  };

  await assert.rejects(() => persistMarketSnapshots(store, [first, first]), /Duplicate content hash/);
});
