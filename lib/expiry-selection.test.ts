import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluateRoll, selectExpiry } from './expiry-selection';

test('selects the eligible expiry closest to the target DTE', () => {
  const selected = selectExpiry(
    [
      { expiry: '2026-04-17T00:00:00.000Z' },
      { expiry: '2026-05-15T00:00:00.000Z' },
      { expiry: '2026-06-19T00:00:00.000Z' }
    ],
    '2026-03-16T00:00:00.000Z',
    { targetDaysToExpiry: 60, minimumDaysToExpiry: 30, maximumDaysToExpiry: 100 }
  );

  assert.equal(selected.expiry, '2026-05-15T00:00:00.000Z');
});

test('uses the earlier expiry as deterministic tie breaker', () => {
  const selected = selectExpiry(
    [{ expiry: '2026-04-15' }, { expiry: '2026-05-15' }],
    '2026-03-15',
    { targetDaysToExpiry: 45, minimumDaysToExpiry: 20, maximumDaysToExpiry: 70 }
  );

  assert.equal(selected.expiry, '2026-04-15');
});

test('rejects invalid selection rules and missing eligible expiries', () => {
  assert.throws(
    () => selectExpiry([], '2026-03-15', { targetDaysToExpiry: 20, minimumDaysToExpiry: 30, maximumDaysToExpiry: 60 }),
    /inside the allowed expiry range/
  );
  assert.throws(
    () => selectExpiry([{ expiry: '2026-03-20' }], '2026-03-15', { targetDaysToExpiry: 45, minimumDaysToExpiry: 30, maximumDaysToExpiry: 60 }),
    /No eligible expiry candidate/
  );
});

test('rolls at the expiry threshold before the holding-period rule', () => {
  const decision = evaluateRoll(
    '2026-04-10',
    '2026-04-17',
    { rollAtOrBelowDaysToExpiry: 7, maximumHoldingDays: 30 },
    '2026-03-01'
  );

  assert.deepEqual(decision, {
    shouldRoll: true,
    reason: 'expiry-threshold',
    daysToExpiry: 7,
    holdingDays: 40
  });
});

test('supports holding-period rolls and no-roll decisions', () => {
  assert.equal(
    evaluateRoll('2026-04-01', '2026-06-19', { maximumHoldingDays: 30 }, '2026-03-01').reason,
    'maximum-holding-period'
  );
  assert.equal(
    evaluateRoll('2026-03-20', '2026-06-19', { rollAtOrBelowDaysToExpiry: 14 }, '2026-03-01').shouldRoll,
    false
  );
});
