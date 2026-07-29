import assert from 'node:assert/strict';
import test from 'node:test';
import { filterFreshQuotes } from './quote-freshness';
import { filterLiquidOptions } from './options-liquidity';

test('first application test filters stale, wide and zero-price quotes', () => {
  const fresh = filterFreshQuotes(
    '2026-07-29T20:00:00.000Z',
    [
      { symbol: 'NDX-PUT-A', quotedAt: '2026-07-29T19:59:50.000Z', bid: 98, ask: 100, volume: 120, openInterest: 900 },
      { symbol: 'NDX-PUT-B', quotedAt: '2026-07-29T19:59:40.000Z', bid: 45, ask: 55, volume: 80, openInterest: 700 },
      { symbol: 'NDX-PUT-STALE', quotedAt: '2026-07-29T19:58:00.000Z', bid: 70, ask: 72, volume: 200, openInterest: 1200 },
      { symbol: 'NDX-PUT-ZERO', quotedAt: '2026-07-29T19:59:55.000Z', bid: 0, ask: 0, volume: 500, openInterest: 5000 }
    ],
    { maximumAgeSeconds: 30, maximumFutureSkewSeconds: 2 }
  );

  assert.deepEqual(fresh.map(quote => quote.symbol), ['NDX-PUT-ZERO', 'NDX-PUT-A', 'NDX-PUT-B']);

  const liquid = filterLiquidOptions(fresh, {
    maximumRelativeSpreadPercent: 5,
    minimumVolume: 100,
    minimumOpenInterest: 500
  });

  assert.deepEqual(liquid.map(quote => quote.symbol), ['NDX-PUT-A']);
});
