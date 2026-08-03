import assert from 'node:assert/strict';
import test from 'node:test';
import {
  enrichRawMarketObservations,
  ingestRawMarketObservations,
  parseRawMarketObservationIngestBody,
  type RawMarketObservationStore
} from './raw-market-observation-ingest';

function storeWithHistory(historyBySource: Record<string, Array<{ observedAt: Date; ndxClose: number }>>, createCount?: number) {
  const queries: unknown[] = [];
  const created: unknown[] = [];
  const store: RawMarketObservationStore = {
    marketSnapshot: {
      async findMany(args) {
        queries.push(args);
        return historyBySource[args.where.source] ?? [];
      },
      async createMany(args) {
        created.push(...args.data);
        return { count: createCount ?? args.data.length };
      }
    }
  };
  return { store, queries, created };
}

test('backfill can start from an empty database and derives rolling highs within the same batch', async () => {
  const { store } = storeWithHistory({});
  const snapshots = await enrichRawMarketObservations(store, [
    { observedAt: '2025-01-02T00:00:00Z', source: 'provider-a', ndxClose: 100, vixClose: 15 },
    { observedAt: '2025-06-02T00:00:00Z', source: 'provider-a', ndxClose: 120, vixClose: 18 },
    { observedAt: '2026-01-02T00:00:00Z', source: 'provider-a', ndxClose: 90, vixClose: 25 }
  ]);

  assert.deepEqual(snapshots.map(snapshot => snapshot.ndxReferenceHigh), [100, 120, 120]);
  assert.ok(Math.abs(snapshots[2].ndxDrawdownPercent - (-25)) < 1e-12);
});

test('uses only persisted history from the same source and trailing two-year window', async () => {
  const { store, queries } = storeWithHistory({
    'provider-a': [
      { observedAt: new Date('2024-08-03T00:00:00Z'), ndxClose: 140 },
      { observedAt: new Date('2025-08-03T00:00:00Z'), ndxClose: 150 }
    ],
    'provider-b': [{ observedAt: new Date('2025-08-03T00:00:00Z'), ndxClose: 999 }]
  });

  const snapshots = await enrichRawMarketObservations(store, [
    { observedAt: '2026-08-03T00:00:00Z', source: 'provider-a', ndxClose: 100, vixClose: 20 }
  ]);

  assert.equal(snapshots[0].ndxReferenceHigh, 150);
  assert.deepEqual(queries, [{
    where: {
      source: 'provider-a',
      observedAt: {
        gte: new Date('2024-08-03T00:00:00.000Z'),
        lte: new Date('2026-08-03T00:00:00.000Z')
      }
    },
    orderBy: { observedAt: 'asc' },
    select: { observedAt: true, ndxClose: true }
  }]);
});

test('chronologically enriches an out-of-order raw batch', async () => {
  const { store } = storeWithHistory({});
  const snapshots = await enrichRawMarketObservations(store, [
    { observedAt: '2026-01-03T00:00:00Z', source: 'provider-a', ndxClose: 90, vixClose: 20 },
    { observedAt: '2026-01-01T00:00:00Z', source: 'provider-a', ndxClose: 100, vixClose: 20 },
    { observedAt: '2026-01-02T00:00:00Z', source: 'provider-a', ndxClose: 120, vixClose: 20 }
  ]);

  assert.deepEqual(snapshots.map(snapshot => snapshot.observedAt), [
    '2026-01-01T00:00:00.000Z',
    '2026-01-02T00:00:00.000Z',
    '2026-01-03T00:00:00.000Z'
  ]);
  assert.deepEqual(snapshots.map(snapshot => snapshot.ndxReferenceHigh), [100, 120, 120]);
});

test('raw contract rejects externally supplied reference high and duplicate identities', () => {
  assert.throws(() => parseRawMarketObservationIngestBody({
    observedAt: '2026-08-03T00:00:00Z',
    source: 'provider-a',
    ndxClose: 100,
    ndxReferenceHigh: 110,
    vixClose: 20
  }), /must not supply ndxReferenceHigh/);

  assert.throws(() => parseRawMarketObservationIngestBody({ observations: [
    { observedAt: '2026-08-03T00:00:00Z', source: 'provider-a', ndxClose: 100, vixClose: 20 },
    { observedAt: '2026-08-03T00:00:00Z', source: 'provider-a', ndxClose: 100, vixClose: 20 }
  ] }), /Duplicate raw source and timestamp/);
});

test('persists through the existing idempotent MarketSnapshot store', async () => {
  const { store, created } = storeWithHistory({}, 0);
  const result = await ingestRawMarketObservations(store, {
    observedAt: '2026-08-03T00:00:00Z',
    source: 'provider-a',
    ndxClose: 100,
    vixClose: 20
  });

  assert.deepEqual(result, { requested: 1, inserted: 0, skipped: 1 });
  assert.equal(created.length, 1);
});
