import assert from 'node:assert/strict';
import test from 'node:test';
import { assessLiquidity, filterLiquidOptions } from './options-liquidity';

test('calculates midpoint and relative spread', () => {
  const result = assessLiquidity({ symbol: 'NDX-P-1', bid: 9, ask: 11, volume: 25, openInterest: 100 });
  assert.equal(result.midpoint, 10);
  assert.equal(result.absoluteSpread, 2);
  assert.equal(result.relativeSpreadPercent, 20);
});

test('filters quotes by spread, volume and open interest', () => {
  const result = filterLiquidOptions([
    { symbol: 'LIQUID', bid: 9.5, ask: 10.5, volume: 50, openInterest: 200 },
    { symbol: 'WIDE', bid: 5, ask: 10, volume: 100, openInterest: 500 },
    { symbol: 'LOW_VOLUME', bid: 9.8, ask: 10.2, volume: 2, openInterest: 300 },
    { symbol: 'LOW_OI', bid: 9.8, ask: 10.2, volume: 30, openInterest: 5 }
  ], { maximumRelativeSpreadPercent: 15, minimumVolume: 10, minimumOpenInterest: 50 });

  assert.deepEqual(result.map(item => item.symbol), ['LIQUID']);
});

test('sorts eligible quotes deterministically by spread then depth', () => {
  const result = filterLiquidOptions([
    { symbol: 'B', bid: 9.5, ask: 10.5, volume: 100, openInterest: 300 },
    { symbol: 'A', bid: 9.5, ask: 10.5, volume: 120, openInterest: 300 },
    { symbol: 'TIGHT', bid: 9.8, ask: 10.2, volume: 20, openInterest: 100 }
  ], { maximumRelativeSpreadPercent: 20, minimumVolume: 0, minimumOpenInterest: 0 });

  assert.deepEqual(result.map(item => item.symbol), ['TIGHT', 'A', 'B']);
});

test('handles a zero bid and ask without division errors', () => {
  const result = assessLiquidity({ symbol: 'ZERO', bid: 0, ask: 0, volume: 0, openInterest: 0 });
  assert.equal(result.relativeSpreadPercent, 0);
});

test('rejects crossed markets and invalid thresholds', () => {
  assert.throws(() => assessLiquidity({ symbol: 'BAD', bid: 11, ask: 10, volume: 1, openInterest: 1 }), /ask cannot be below bid/);
  assert.throws(() => filterLiquidOptions([], { maximumRelativeSpreadPercent: -1, minimumVolume: 0, minimumOpenInterest: 0 }), /maximumRelativeSpreadPercent/);
});
