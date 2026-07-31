import assert from 'node:assert/strict';
import test from 'node:test';
import { PortfolioObservation } from './portfolio-backtest';
import { compareStrategyScenarios, HedgeStrategyKind } from './strategy-comparison';

const market: PortfolioObservation[] = [
  {
    observedAt: '2020-01-02T00:00:00.000Z',
    ndxClose: 100,
    ndxReferenceHigh: 100,
    vixPercentile: 10
  },
  {
    observedAt: '2020-03-20T00:00:00.000Z',
    ndxClose: 70,
    ndxReferenceHigh: 100,
    vixPercentile: 95
  },
  {
    observedAt: '2020-06-01T00:00:00.000Z',
    ndxClose: 90,
    ndxReferenceHigh: 100,
    vixPercentile: 55
  }
];

function scenario(id: string, kind: HedgeStrategyKind, hedgeValues: number[], costs: number[] = [0, 0, 0]) {
  return {
    id,
    kind,
    observations: market.map((observation, index) => ({
      ...observation,
      hedgeMarketValueEur: hedgeValues[index],
      transactionCostEur: costs[index]
    }))
  };
}

test('compares hedge scenarios against an explicit no-hedge baseline', () => {
  const result = compareStrategyScenarios(
    [
      scenario('none', 'NO_HEDGE', [0, 0, 0]),
      scenario('long-put', 'LONG_PUT', [10_000, 45_000, 20_000], [1_000, 0, 0]),
      scenario('put-spread', 'PUT_SPREAD', [7_000, 30_000, 12_000]),
      scenario('collar', 'COLLAR', [2_000, 20_000, 8_000]),
      scenario('staged', 'STAGED_REALIZATION', [8_000, 35_000, 16_000])
    ],
    { initialPortfolioValueEur: 100_000 }
  );

  assert.equal(result.baselineId, 'none');
  assert.equal(result.bestFinalValueId, 'long-put');
  assert.equal(result.lowestDrawdownId, 'staged');
  assert.equal(result.rows.length, 5);
  assert.equal(result.rows.find(row => row.id === 'long-put')?.totalTransactionCostsEur, 1_000);
});

test('uses stable input order for equal comparison metrics', () => {
  const result = compareStrategyScenarios(
    [scenario('none', 'NO_HEDGE', [0, 0, 0]), scenario('first', 'LONG_PUT', [0, 0, 0])],
    { initialPortfolioValueEur: 100_000 }
  );

  assert.equal(result.bestFinalValueId, 'none');
  assert.equal(result.lowestDrawdownId, 'none');
});

test('rejects missing baselines and duplicate identifiers', () => {
  assert.throws(
    () => compareStrategyScenarios([scenario('a', 'LONG_PUT', [0, 0, 0]), scenario('b', 'COLLAR', [0, 0, 0])], { initialPortfolioValueEur: 100_000 }),
    /NO_HEDGE baseline/
  );

  assert.throws(
    () => compareStrategyScenarios([scenario('same', 'NO_HEDGE', [0, 0, 0]), scenario('same', 'LONG_PUT', [0, 0, 0])], { initialPortfolioValueEur: 100_000 }),
    /Duplicate strategy scenario id/
  );
});
