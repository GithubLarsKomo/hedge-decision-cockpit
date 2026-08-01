import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, it } from 'node:test';
import { prisma } from './prisma';
import { runMonthlyPortfolioWorkflow } from './monthly-portfolio-workflow';
import type { HedgeContext } from './portfolio-decision-variants';
import type { MonthlyPortfolioInput } from './portfolio-snapshot-generator';

function exampleInput(): MonthlyPortfolioInput {
  return JSON.parse(
    readFileSync(join(process.cwd(), 'fixtures', 'portfolio-snapshot', 'monthly-input.json'), 'utf8')
  ) as MonthlyPortfolioInput;
}

const hedgeContext: HedgeContext = {
  risk_regime: 'elevated',
  recommended_hedge_ratio: 0.25,
  hedge_notional_eur: 49500,
  confidence: 'medium',
  reasons: ['volatility above threshold', 'negative trend confirmation']
};

describe('monthly portfolio workflow', () => {
  beforeEach(async () => {
    await prisma.importedPortfolioSnapshot.deleteMany();
  });

  it('generates, persists, allocates and produces decision variants', async () => {
    const result = await runMonthlyPortfolioWorkflow(exampleInput());
    assert.equal(result.import.created, true);
    assert.equal(result.import.snapshotId, result.snapshot.snapshot_id);
    assert.equal(result.import.inputFingerprint, result.snapshot.input_fingerprint);
    assert.equal(result.allocation.currency, result.snapshot.portfolio.currency);
    assert.equal(
      result.allocation.allocatedContribution + result.allocation.residualContribution,
      result.allocation.monthlyContribution
    );
    assert.deepEqual(
      result.decisionVariants.variants.map((variant) => variant.variantId),
      ['contribution-only', 'deploy-extra-cash']
    );
  });

  it('is idempotent when the same monthly input is run twice', async () => {
    const first = await runMonthlyPortfolioWorkflow(exampleInput());
    const second = await runMonthlyPortfolioWorkflow(exampleInput());
    assert.equal(first.import.created, true);
    assert.equal(second.import.created, false);
    assert.equal(second.import.id, first.import.id);
    assert.equal(second.snapshot.input_fingerprint, first.snapshot.input_fingerprint);
    assert.deepEqual(second.allocation, first.allocation);
    assert.deepEqual(second.decisionVariants, first.decisionVariants);
  });

  it('preserves optional hedge context in workflow decision variants without execution semantics', async () => {
    const result = await runMonthlyPortfolioWorkflow(exampleInput(), hedgeContext);
    const hedgeVariant = result.decisionVariants.variants.at(-1);
    assert.equal(hedgeVariant?.variantId, 'deploy-extra-cash-with-hedge-context');
    assert.deepEqual(hedgeVariant?.hedgeContext, hedgeContext);
    assert.equal('order' in result.decisionVariants, false);
    assert.equal('selectedVariant' in result.decisionVariants, false);
  });
});
