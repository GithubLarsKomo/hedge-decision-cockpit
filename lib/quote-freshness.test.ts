import assert from 'node:assert/strict';
import test from 'node:test';
import { filterFreshQuotes } from './quote-freshness';

test('keeps only quotes inside the configured age window', () => {
  const quotes = filterFreshQuotes(
    '2026-07-29T20:00:00Z',
    [
      { symbol: 'NDX260821P20000', quotedAt: '2026-07-29T19:59:50Z', bid: 100 },
      { symbol: 'NDX260821P19500', quotedAt: '2026-07-29T19:58:00Z', bid: 80 }
    ],
    { maximumAgeSeconds: 30 }
  );

  assert.deepEqual(quotes, [
    {
      symbol: 'NDX260821P20000',
      quotedAt: '2026-07-29T19:59:50.000Z',
      bid: 100,
      ageSeconds: 10
    }
  ]);
});

test('sorts freshest quotes first and uses symbol as deterministic tie breaker', () => {
  const quotes = filterFreshQuotes(
    '2026-07-29T20:00:00Z',
    [
      { symbol: 'B', quotedAt: '2026-07-29T19:59:55Z' },
      { symbol: 'C', quotedAt: '2026-07-29T19:59:58Z' },
      { symbol: 'A', quotedAt: '2026-07-29T19:59:55Z' }
    ],
    { maximumAgeSeconds: 30 }
  );

  assert.deepEqual(quotes.map(quote => quote.symbol), ['C', 'A', 'B']);
});

test('allows a bounded future timestamp skew', () => {
  const quotes = filterFreshQuotes(
    '2026-07-29T20:00:00Z',
    [
      { symbol: 'ALLOWED', quotedAt: '2026-07-29T20:00:03Z' },
      { symbol: 'REJECTED', quotedAt: '2026-07-29T20:00:06Z' }
    ],
    { maximumAgeSeconds: 30, maximumFutureSkewSeconds: 5 }
  );

  assert.equal(quotes.length, 1);
  assert.equal(quotes[0].symbol, 'ALLOWED');
  assert.equal(quotes[0].ageSeconds, -3);
});

test('applies age and future-skew limits without rounding', () => {
  const quotes = filterFreshQuotes(
    '2026-07-29T20:00:00.000Z',
    [
      { symbol: 'EXACT_AGE', quotedAt: '2026-07-29T19:59:30.000Z' },
      { symbol: 'TOO_OLD', quotedAt: '2026-07-29T19:59:29.999Z' },
      { symbol: 'EXACT_FUTURE', quotedAt: '2026-07-29T20:00:05.000Z' },
      { symbol: 'TOO_FUTURE', quotedAt: '2026-07-29T20:00:05.001Z' }
    ],
    { maximumAgeSeconds: 30, maximumFutureSkewSeconds: 5 }
  );

  assert.deepEqual(
    quotes.map(quote => [quote.symbol, quote.ageSeconds]),
    [['EXACT_FUTURE', -5], ['EXACT_AGE', 30]]
  );
});

test('rejects invalid timestamps and thresholds', () => {
  assert.throws(
    () => filterFreshQuotes('invalid', [], { maximumAgeSeconds: 30 }),
    /observedAt must be a valid ISO timestamp/
  );
  assert.throws(
    () => filterFreshQuotes('2026-07-29T20:00:00Z', [{ symbol: 'X', quotedAt: 'invalid' }], { maximumAgeSeconds: 30 }),
    /quotedAt must be a valid ISO timestamp/
  );
  assert.throws(
    () => filterFreshQuotes('2026-07-29T20:00:00Z', [], { maximumAgeSeconds: -1 }),
    /maximumAgeSeconds must be a non-negative integer/
  );
});
