import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runPortfolioBacktest } from './portfolio-backtest';

const observations = [
  {
    observedAt: '2020-01-01T00:00:00.000Z',
    ndxClose: 100,
    ndxReferenceHigh: 100,
    vixPercentile: 20,
    hedgeMarketValueEur: 10_000,
    transactionCostEur: 500
  },
  {
    observedAt: '2020-02-01T00:00:00.000Z',
    ndxClose: 80,
    ndxReferenceHigh: 100,
    vixPercentile: 90,
    hedgeMarketValueEur: 45_000,
    hedgeCashFlowEur: 5_000,
    transactionCostEur: 500
  }
];

describe('runPortfolioBacktest', () => {
  it('compares hedged and unhedged portfolio values including costs', () => {
    const result = runPortfolioBacktest(observations, {
      initialPortfolioValueEur: 100_000,
      initialHedgeValueEur: 10_000
    });

    assert.equal(result.finalUnhedgedValueEur, 80_000);
    assert.equal(result.finalHedgedValueEur, 129_000);
    assert.equal(result.totalTransactionCostsEur, 1_000);
    assert.equal(result.hedgeBenefitEur, 49_000);
    assert.ok(result.maximumHedgedDrawdownPercent > result.maximumUnhedgedDrawdownPercent);
  });

  it('sorts observations chronologically', () => {
    const result = runPortfolioBacktest([...observations].reverse(), {
      initialPortfolioValueEur: 100_000
    });
    assert.equal(result.points[0].observedAt, observations[0].observedAt);
  });

  it('rejects negative transaction costs', () => {
    assert.throws(() => runPortfolioBacktest([
      { ...observations[0], transactionCostEur: -1 }
    ], { initialPortfolioValueEur: 100_000 }));
  });
});
