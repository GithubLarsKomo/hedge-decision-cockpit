import assert from 'node:assert/strict';
import test from 'node:test';
import { recommendHedgeContracts } from './hedge-sizing';

test('sizes contracts from coverage and delta', () => {
  const result = recommendHedgeContracts({
    portfolioValueEur: 1_000_000,
    targetCoverageRatio: 0.5,
    underlyingPrice: 20_000,
    optionDelta: -0.5,
    contractMultiplier: 1,
    eurPerQuoteCurrency: 0.9
  });
  assert.equal(result.recommendedContracts, 56);
  assert.equal(result.achievedCoverageRatio, 0.504);
});

test('supports rounding and caps', () => {
  const common = {
    portfolioValueEur: 100_000,
    targetCoverageRatio: 0.5,
    underlyingPrice: 1_000,
    optionDelta: -0.6,
    contractMultiplier: 100
  } as const;
  assert.equal(recommendHedgeContracts({ ...common, rounding: 'down' }).recommendedContracts, 0);
  assert.equal(recommendHedgeContracts({ ...common, rounding: 'up' }).recommendedContracts, 1);
  assert.equal(recommendHedgeContracts({ ...common, rounding: 'up', maxContracts: 0 }).capped, true);
});

test('rejects invalid inputs', () => {
  assert.throws(() => recommendHedgeContracts({ portfolioValueEur: 0, targetCoverageRatio: 0.5, underlyingPrice: 100, optionDelta: -0.5 }), /portfolioValueEur/);
  assert.throws(() => recommendHedgeContracts({ portfolioValueEur: 100, targetCoverageRatio: 1.1, underlyingPrice: 100, optionDelta: -0.5 }), /targetCoverageRatio/);
  assert.throws(() => recommendHedgeContracts({ portfolioValueEur: 100, targetCoverageRatio: 0.5, underlyingPrice: 100, optionDelta: 0 }), /optionDelta/);
});
