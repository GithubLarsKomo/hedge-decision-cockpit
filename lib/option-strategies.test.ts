import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { collar, longPut, putSpread } from './option-strategies';

const base = {
  spot: 100,
  timeToExpiryYears: 0.5,
  volatility: 0.25,
  riskFreeRate: 0.02,
  dividendYield: 0.01,
  contracts: 2
};

describe('option strategies', () => {
  it('values a long put as a positive premium with negative delta', () => {
    const result = longPut({ ...base, strike: 95 });
    assert.ok(result.marketValue > 0);
    assert.ok(result.netDelta < 0);
  });

  it('prices a put spread cheaper than its long put leg', () => {
    const spread = putSpread({ ...base, longStrike: 100, shortStrike: 85 });
    const put = longPut({ ...base, strike: 100 });
    assert.ok(spread.marketValue > 0);
    assert.ok(spread.marketValue < put.marketValue);
  });

  it('combines protective put and short call in a collar', () => {
    const result = collar({ ...base, putStrike: 90, callStrike: 110 });
    assert.equal(result.legValues.length, 2);
    assert.ok(Number.isFinite(result.marketValue));
    assert.ok(result.netDelta < 0);
  });

  it('rejects inconsistent strikes', () => {
    assert.throws(() => putSpread({ ...base, longStrike: 85, shortStrike: 90 }));
    assert.throws(() => collar({ ...base, putStrike: 110, callStrike: 100 }));
  });
});
