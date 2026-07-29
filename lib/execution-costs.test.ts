import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { estimateExecution, estimateStrategyExecution } from './execution-costs';

describe('estimateExecution', () => {
  it('models buy-side spread, slippage and commission', () => {
    const result = estimateExecution({
      side: 'buy',
      theoreticalPrice: 10,
      bid: 9.8,
      ask: 10.2,
      contracts: 2,
      slippageBps: 25,
      commissionPerContract: 1.5
    });

    assert.equal(result.referencePrice, 10.2);
    assert.ok(result.executedPrice > result.referencePrice);
    assert.ok(result.spreadCostEur > 0);
    assert.ok(result.slippageCostEur > 0);
    assert.equal(result.commissionEur, 3);
    assert.ok(result.netCashFlowEur < 0);
  });

  it('models sell-side proceeds after costs', () => {
    const result = estimateExecution({
      side: 'sell',
      theoreticalPrice: 5,
      bid: 4.9,
      ask: 5.1,
      contracts: 1,
      slippageBps: 10,
      commissionPerContract: 2
    });

    assert.ok(result.executedPrice < result.referencePrice);
    assert.ok(result.netCashFlowEur > 0);
    assert.ok(result.totalExecutionCostEur > 0);
  });

  it('aggregates multi-leg strategy costs and cash flows', () => {
    const result = estimateStrategyExecution([
      { label: 'long put', side: 'buy', theoreticalPrice: 8, ask: 8.2, contracts: 1 },
      { label: 'short put', side: 'sell', theoreticalPrice: 3, bid: 2.9, contracts: 1 }
    ]);

    assert.equal(result.legs.length, 2);
    assert.ok(result.totalExecutionCostEur > 0);
    assert.ok(result.netCashFlowEur < 0);
  });

  it('rejects crossed markets', () => {
    assert.throws(() => estimateExecution({
      side: 'buy', theoreticalPrice: 10, bid: 10.5, ask: 10.4, contracts: 1
    }), /Bid must not exceed ask/);
  });
});
