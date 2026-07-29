import assert from 'node:assert/strict';
import test from 'node:test';
import { recommendHedgeContracts } from './hedge-sizing';

test('sizes protective put contracts and reports overhedging separately', () => {
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
  assert.equal(result.residualNotionalEur, 0);
  assert.equal(result.overhedgeNotionalEur, 4_000);
});

test('supports rounding and caps', () => {
  const common = {
    portfolioValueEur: 100_000,
    targetCoverageRatio: 0.5,
    underlyingPrice: 1_000,
    optionDelta: -0.6,
    contractMultiplier: 100
  } as const;

  const roundedDown = recommendHedgeContracts({ ...common, rounding: 'down' });
  assert.equal(roundedDown.recommendedContracts, 0);
  assert.equal(roundedDown.residualNotionalEur, 50_000);
  assert.equal(roundedDown.overhedgeNotionalEur, 0);

  const roundedUp = recommendHedgeContracts({ ...common, rounding: 'up' });
  assert.equal(roundedUp.recommendedContracts, 1);
  assert.equal(roundedUp.residualNotionalEur, 0);
  assert.equal(roundedUp.overhedgeNotionalEur, 10_000);

  const capped = recommendHedgeContracts({ ...common, rounding: 'up', maxContracts: 0 });
  assert.equal(capped.recommendedContracts, 0);
  assert.equal(capped.achievedHedgeNotionalEur, 0);
  assert.equal(capped.residualNotionalEur, 50_000);
  assert.equal(capped.overhedgeNotionalEur, 0);
  assert.equal(capped.capped, true);
});

test('uses standard contract and FX defaults', () => {
  const result = recommendHedgeContracts({
    portfolioValueEur: 100_000,
    targetCoverageRatio: 0.5,
    underlyingPrice: 1_000,
    optionDelta: -0.5
  });

  assert.equal(result.hedgeNotionalPerContractEur, 50_000);
  assert.equal(result.rawContracts, 1);
  assert.equal(result.recommendedContracts, 1);
  assert.equal(result.residualNotionalEur, 0);
  assert.equal(result.overhedgeNotionalEur, 0);
});

test('returns zero contracts for zero target coverage', () => {
  const result = recommendHedgeContracts({
    portfolioValueEur: 100_000,
    targetCoverageRatio: 0,
    underlyingPrice: 1_000,
    optionDelta: -0.5
  });

  assert.equal(result.recommendedContracts, 0);
  assert.equal(result.achievedCoverageRatio, 0);
  assert.equal(result.residualNotionalEur, 0);
  assert.equal(result.overhedgeNotionalEur, 0);
});

test('rejects invalid inputs and non-protective deltas', () => {
  assert.throws(() => recommendHedgeContracts({ portfolioValueEur: 0, targetCoverageRatio: 0.5, underlyingPrice: 100, optionDelta: -0.5 }), /portfolioValueEur/);
  assert.throws(() => recommendHedgeContracts({ portfolioValueEur: 100, targetCoverageRatio: 1.1, underlyingPrice: 100, optionDelta: -0.5 }), /targetCoverageRatio/);
  assert.throws(() => recommendHedgeContracts({ portfolioValueEur: 100, targetCoverageRatio: 0.5, underlyingPrice: 100, optionDelta: 0 }), /optionDelta/);
  assert.throws(() => recommendHedgeContracts({ portfolioValueEur: 100, targetCoverageRatio: 0.5, underlyingPrice: 100, optionDelta: 0.5 }), /protective put/);
});
