import assert from 'node:assert/strict';
import test from 'node:test';
import { computeDrawdownPercent } from './market-metrics';

test('computeDrawdownPercent returns deterministic percentage from current and high', () => {
  assert.ok(Math.abs(computeDrawdownPercent(900, 1000) - (-10)) < 1e-12);
  assert.equal(computeDrawdownPercent(1000, 1000), 0);
});

test('computeDrawdownPercent rejects non-positive inputs', () => {
  assert.throws(() => computeDrawdownPercent(0, 1000), /current must be positive/);
  assert.throws(() => computeDrawdownPercent(900, 0), /referenceHigh must be positive/);
});
