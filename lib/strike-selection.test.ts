import assert from 'node:assert/strict';
import test from 'node:test';
import { selectPutStrike } from './strike-selection';

test('selects the eligible put strike closest to target moneyness', () => {
  const selected = selectPutStrike(
    20_000,
    [{ strike: 16_000 }, { strike: 17_000 }, { strike: 18_000 }],
    {
      targetMoneynessPercent: 85,
      minimumMoneynessPercent: 75,
      maximumMoneynessPercent: 95
    }
  );

  assert.equal(selected.strike, 17_000);
  assert.equal(selected.moneynessPercent, 85);
  assert.equal(selected.distanceFromTarget, 0);
});

test('uses the lower strike as deterministic tie breaker', () => {
  const selected = selectPutStrike(
    20_000,
    [{ strike: 16_000 }, { strike: 18_000 }],
    {
      targetMoneynessPercent: 85,
      minimumMoneynessPercent: 75,
      maximumMoneynessPercent: 95
    }
  );

  assert.equal(selected.strike, 16_000);
});

test('rejects sets without an eligible put strike', () => {
  assert.throws(
    () => selectPutStrike(
      20_000,
      [{ strike: 10_000 }, { strike: 12_000 }],
      {
        targetMoneynessPercent: 85,
        minimumMoneynessPercent: 75,
        maximumMoneynessPercent: 95
      }
    ),
    /No eligible put strike candidate/
  );
});

test('validates prices, strikes and moneyness bounds', () => {
  assert.throws(
    () => selectPutStrike(0, [{ strike: 17_000 }], {
      targetMoneynessPercent: 85,
      minimumMoneynessPercent: 75,
      maximumMoneynessPercent: 95
    }),
    /underlyingPrice/
  );

  assert.throws(
    () => selectPutStrike(20_000, [{ strike: -1 }], {
      targetMoneynessPercent: 85,
      minimumMoneynessPercent: 75,
      maximumMoneynessPercent: 95
    }),
    /strike/
  );

  assert.throws(
    () => selectPutStrike(20_000, [{ strike: 17_000 }], {
      targetMoneynessPercent: 85,
      minimumMoneynessPercent: 96,
      maximumMoneynessPercent: 95
    }),
    /cannot exceed/
  );
});
