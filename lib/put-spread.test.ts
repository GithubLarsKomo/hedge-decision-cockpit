import assert from 'node:assert/strict';
import test from 'node:test';
import { constructPutSpread } from './put-spread';

test('selects the short strike closest to the target spread width', () => {
  const spread = constructPutSpread(
    { strike: 20_000, premium: 620 },
    [
      { strike: 19_000, premium: 340 },
      { strike: 18_000, premium: 190 },
      { strike: 17_000, premium: 105 }
    ],
    { targetWidthPercent: 10, minimumWidthPercent: 4, maximumWidthPercent: 20 }
  );

  assert.equal(spread.longStrike, 20_000);
  assert.equal(spread.shortStrike, 18_000);
  assert.equal(spread.widthPercent, 10);
  assert.equal(spread.netDebitPerUnit, 430);
  assert.equal(spread.breakEven, 19_570);
});

test('calculates euro contract economics with multiplier and FX', () => {
  const spread = constructPutSpread(
    { strike: 100, premium: 8 },
    [{ strike: 90, premium: 3 }],
    {
      targetWidthPercent: 10,
      minimumWidthPercent: 5,
      maximumWidthPercent: 15,
      contractMultiplier: 100,
      fxEurPerQuoteCurrency: 0.9
    }
  );

  assert.equal(spread.netDebitPerContractEur, 450);
  assert.equal(spread.maximumPayoffPerContractEur, 900);
  assert.equal(spread.maximumProfitPerContractEur, 450);
});

test('uses the higher short strike as deterministic tie breaker', () => {
  const spread = constructPutSpread(
    { strike: 100, premium: 7 },
    [{ strike: 92, premium: 4 }, { strike: 88, premium: 2 }],
    { targetWidthPercent: 10, minimumWidthPercent: 5, maximumWidthPercent: 15 }
  );

  assert.equal(spread.shortStrike, 92);
});

test('rejects candidates outside width limits or above the long strike', () => {
  assert.throws(
    () => constructPutSpread(
      { strike: 100, premium: 7 },
      [{ strike: 101, premium: 8 }, { strike: 70, premium: 1 }],
      { targetWidthPercent: 10, minimumWidthPercent: 5, maximumWidthPercent: 20 }
    ),
    /No eligible short put candidate/
  );
});

test('rejects negative net debit spreads', () => {
  assert.throws(
    () => constructPutSpread(
      { strike: 100, premium: 4 },
      [{ strike: 90, premium: 5 }],
      { targetWidthPercent: 10, minimumWidthPercent: 5, maximumWidthPercent: 15 }
    ),
    /No eligible short put candidate/
  );
});
