import assert from 'node:assert/strict';
import test from 'node:test';
import { aggregateHoldingsByExposure } from './exposure-mapping-aggregation';

const exposures = [{ exposureId: 'world-equity' }, { exposureId: 'bonds' }];
const mappings = [
  {
    instrumentId: 'ETF-OLD',
    exposureId: 'world-equity',
    mappingVersion: '2026-08',
    purchaseEligible: false
  },
  {
    instrumentId: 'ETF-NEW',
    exposureId: 'world-equity',
    mappingVersion: '2026-08',
    purchaseEligible: true
  },
  {
    instrumentId: 'BOND-ETF',
    exposureId: 'bonds',
    mappingVersion: '2026-08',
    purchaseEligible: true
  }
];

test('aggregates multiple holdings into one exposure while keeping legacy holdings non-active', () => {
  const result = aggregateHoldingsByExposure({
    holdings: [
      { instrumentId: 'ETF-OLD', marketValue: 3000 },
      { instrumentId: 'ETF-NEW', marketValue: 7000 },
      { instrumentId: 'BOND-ETF', marketValue: 5000 }
    ],
    exposures,
    mappings,
    mappingVersion: '2026-08'
  });

  const world = result.exposures.find((row) => row.exposureId === 'world-equity');
  assert.ok(world);
  assert.equal(world.currentAmount, 10000);
  assert.equal(world.currentWeight, 2 / 3);
  assert.deepEqual(world.mappedInstruments, ['ETF-NEW', 'ETF-OLD']);
  assert.equal(world.activePurchaseInstrument, 'ETF-NEW');
  assert.deepEqual(world.instruments, [
    { instrumentId: 'ETF-NEW', marketValue: 7000, purchaseEligible: true },
    { instrumentId: 'ETF-OLD', marketValue: 3000, purchaseEligible: false }
  ]);
});

test('uses explicit total portfolio value for weights without changing mapped amounts', () => {
  const result = aggregateHoldingsByExposure({
    holdings: [{ instrumentId: 'ETF-NEW', marketValue: 4000 }],
    exposures,
    mappings,
    mappingVersion: '2026-08',
    portfolioMarketValue: 10000
  });

  const world = result.exposures.find((row) => row.exposureId === 'world-equity');
  assert.equal(world?.currentAmount, 4000);
  assert.equal(world?.currentWeight, 0.4);
});

test('rejects unmapped holdings', () => {
  assert.throws(
    () =>
      aggregateHoldingsByExposure({
        holdings: [{ instrumentId: 'UNKNOWN', marketValue: 100 }],
        exposures,
        mappings,
        mappingVersion: '2026-08'
      }),
    /unmapped holding: UNKNOWN/
  );
});

test('rejects duplicate mappings', () => {
  assert.throws(
    () =>
      aggregateHoldingsByExposure({
        holdings: [],
        exposures,
        mappings: [...mappings, { ...mappings[0] }],
        mappingVersion: '2026-08'
      }),
    /duplicate instrument mapping: ETF-OLD/
  );
});

test('rejects multiple active purchase instruments for one exposure', () => {
  assert.throws(
    () =>
      aggregateHoldingsByExposure({
        holdings: [],
        exposures,
        mappings: mappings.map((mapping) =>
          mapping.instrumentId === 'ETF-OLD' ? { ...mapping, purchaseEligible: true } : mapping
        ),
        mappingVersion: '2026-08'
      }),
    /multiple active purchase instruments for exposure: world-equity/
  );
});

test('rejects mapping version mismatches and negative holdings', () => {
  assert.throws(
    () =>
      aggregateHoldingsByExposure({
        holdings: [],
        exposures,
        mappings,
        mappingVersion: '2026-09'
      }),
    /mapping version mismatch/
  );

  assert.throws(
    () =>
      aggregateHoldingsByExposure({
        holdings: [{ instrumentId: 'ETF-NEW', marketValue: -1 }],
        exposures,
        mappings,
        mappingVersion: '2026-08'
      }),
    /invalid market value/
  );
});
