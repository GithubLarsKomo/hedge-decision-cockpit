import assert from 'node:assert/strict';
import test from 'node:test';
import { selectExpiry } from './expiry-roll';
import { evaluateRollRule } from './roll-rule';

test('selects the eligible expiry closest to the target duration', () => {
  const selected = selectExpiry(
    '2026-01-02T00:00:00Z',
    [
      { expiry: '2026-01-16T00:00:00Z' },
      { expiry: '2026-02-20T00:00:00Z' },
      { expiry: '2026-03-20T00:00:00Z' }
    ],
    { targetDaysToExpiry: 45, minimumDaysToExpiry: 20, maximumDaysToExpiry: 90 }
  );

  assert.equal(selected.expiry, '2026-02-20T00:00:00.000Z');
  assert.equal(selected.daysToExpiry, 49);
  assert.equal(selected.distanceFromTarget, 4);
});

test('uses the shorter duration as deterministic tie breaker', () => {
  const selected = selectExpiry(
    '2026-01-01T00:00:00Z',
    [{ expiry: '2026-01-21T00:00:00Z' }, { expiry: '2026-01-31T00:00:00Z' }],
    { targetDaysToExpiry: 25, minimumDaysToExpiry: 1, maximumDaysToExpiry: 60 }
  );
  assert.equal(selected.daysToExpiry, 20);
});

test('rejects expiry sets without an eligible contract', () => {
  assert.throws(
    () => selectExpiry(
      '2026-01-01T00:00:00Z',
      [{ expiry: '2026-01-05T00:00:00Z' }],
      { targetDaysToExpiry: 30, minimumDaysToExpiry: 14, maximumDaysToExpiry: 60 }
    ),
    /No eligible expiry candidate/
  );
});

test('evaluates scheduled, drawdown and combined roll triggers', () => {
  assert.deepEqual(
    evaluateRollRule(6, -4, { kind: 'scheduled', rollWhenDaysToExpiryAtOrBelow: 7 }),
    { shouldRoll: true, reasons: ['scheduled-expiry-threshold'] }
  );
  assert.deepEqual(
    evaluateRollRule(30, -12, { kind: 'drawdown', rollWhenDrawdownPercentAtOrBelow: -10 }),
    { shouldRoll: true, reasons: ['drawdown-threshold'] }
  );
  assert.deepEqual(
    evaluateRollRule(5, -15, {
      kind: 'combined',
      rollWhenDaysToExpiryAtOrBelow: 7,
      rollWhenDrawdownPercentAtOrBelow: -10
    }),
    { shouldRoll: true, reasons: ['scheduled-expiry-threshold', 'drawdown-threshold'] }
  );
});

test('returns no roll when no threshold is met', () => {
  assert.deepEqual(
    evaluateRollRule(20, -3, {
      kind: 'combined',
      rollWhenDaysToExpiryAtOrBelow: 7,
      rollWhenDrawdownPercentAtOrBelow: -10
    }),
    { shouldRoll: false, reasons: [] }
  );
});
