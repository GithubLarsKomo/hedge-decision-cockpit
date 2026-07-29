import assert from 'node:assert/strict';
import test from 'node:test';

import { recommendHedgeContracts } from './hedge-sizing';

test('recommends contracts from target coverage and option delta', () => {
  const result = recommendHedgeContracts({
    portfolioValueEur: 1_000_000,
    targetCoverageRatio: 0.5,
    underlyingPrice: 20_000,
    optionDelta: -0.5,
    contractMultiplier: 1,
    eurPerQuoteCurrency: 0.9
  });

  assert.equal(result.targetHedgeNotionalEur, 500_000);
  assert.equal(result.hedgeNotionalPerContractEur, 9_000);
  assert.equal(result.recommendedContracts, 56);
  assert.equal(result.achievedHedgeNotionalEur, 504_000);
  assert.equal(result.achievedCoverageRatio, 0.504);
  assert.equal(result.residualNotionalEur, -4_000);
});

test('supports conservative rounding down and protective rounding up', () => {
  const common = {
    portfolioValueEur: 100_000,
    targetCoverageRatio: 0.5,
    underlyingPrice: 1_000,
    optionDelta: -0.6,
    contractMultiplier: 100
  } as const;

  assert.equal(recommendHedgeContracts({ ...common, rounding: 'down' }).recommendedContracts, 0);
  assert.equal(recommendHedgeContracts({ ...common, rounding: 'up' }).recommendedContracts, 1);
});

test('applies a maximum contract limit and reports the cap', () => {
  const result = recommendHedgeContracts({
    portfolioValueEur: 2_000_000,
    targetCoverageRatio: 0.75,
    underlyingPrice: 10_000,
    optionDelta: -0.5,
    contractMultiplier: 1,
    maxContracts: 100
  });

  assert.equal(result.recommendedContracts, 100);
  assert.equal(result.capped, true);
  assert.equal(result.achievedCoverageRatio, 0.25);
});

test('allows a zero target coverage without requiring contracts', () => {
  const result = recommendHedgeContracts({
    portfolioValueEur: 500_000,
    targetCoverageRatio: 0,
    underlyingPrice: 15_000,
    optionDelta: -0.4
  });

  assert.equal(result.recommendedContracts, 0);
  assert.equal(result.achievedCoverageRatio, 0);
});

test('rejects invalid portfolio, coverage, delta and caps', () => {
  assert.throws(() => recommendHedgeContracts({
    portfolioValueEur: 0,
    targetCoverageRatio: 0.5,
    underlyingPrice: 100,
    optionDelta: -0.5
  }), /portfolioValueEur must be positive/);

  assert.throws(() => recommendHedgeContracts({
    portfolioValueEur: 100,
    targetCoverageRatio: 1.1,
    underlyingPrice: 100,
    optionDelta: -0.5
  }), /targetCoverageRatio/);

  assert.throws(() => recommendHedgeContracts({
    portfolioValueEur: 100,
    targetCoverageRatio: 0.5,
    underlyingPrice: 100,
    optionDelta: 0
  }), /optionDelta/);

  assert.throws(() => recommendHedgeContracts({
    portfolioValueEur: 100,
    targetCoverageRatio: 0.5,
    underlyingPrice: 100,
    optionDelta: -0.5,
    maxContracts: 1.5
  }), /maxContracts/);
});
