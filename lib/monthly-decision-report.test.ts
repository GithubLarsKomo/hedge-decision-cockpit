import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, it } from 'node:test';
import { prisma } from './prisma';
import { buildMonthlyDecisionReport, stableSerializeMonthlyDecisionReport } from './monthly-decision-report';
import type { MonthlyPortfolioInput } from './portfolio-snapshot-generator';
import type { HedgeContext } from './portfolio-decision-variants';

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(join(process.cwd(), path), 'utf8'));
}

function exampleInput(): MonthlyPortfolioInput {
  const input = readJson('fixtures/portfolio-snapshot/monthly-input.json') as MonthlyPortfolioInput;

  return {
    ...input,
    snapshot_id: `${input.snapshot_id}-decision-report`
  };
}

const hedgeContext: HedgeContext = {
  risk_regime: 'elevated',
  recommended_hedge_ratio: 0.15,
  hedge_notional_eur: 12500,
  confidence: 'medium',
  reasons: ['drawdown', 'volatility']
};

describe('monthly decision report', () => {
  beforeEach(async () => {
    await prisma.importedPortfolioSnapshot.deleteMany({
      where: { snapshotId: '2026-08-decision-report' }
    });
  });

  it('combines the canonical monthly workflow with canonical decision variants', async () => {
    const report = await buildMonthlyDecisionReport(exampleInput(), hedgeContext);

    assert.equal(report.import.created, true);
    assert.equal(report.snapshot.snapshot_id, report.decisionVariants.snapshotId);
    assert.equal(report.snapshot.revision, report.decisionVariants.revision);
    assert.equal(report.allocation.currency, report.decisionVariants.currency);
    assert.equal(report.decisionVariants.variants.length, 3);
    assert.deepEqual(report.decisionVariants.variants[2].hedgeContext, hedgeContext);
    assert.equal('selectedVariant' in report, false);
    assert.equal('order' in report, false);
  });

  it('applies local GPO targets and ETF mapping through the canonical report path', async () => {
    const report = await buildMonthlyDecisionReport(exampleInput(), hedgeContext, {
      gpoTargetAllocation: readJson('fixtures/gpo-target-allocation/2026-08.json'),
      etfMapping: readJson('fixtures/etf-mapping/2026-08.json')
    });

    const exposure = report.snapshot.exposures[0];
    assert.equal(exposure.target_weight, 1);
    assert.equal(exposure.active_purchase_instrument, 'IE00BETTERFIT1');
    assert.ok(exposure.mapped_instruments.includes('IE00LEGACY01'));
    assert.ok(report.snapshot.source_fingerprints.some((value) => value.startsWith('gpo-target-allocation:')));
    assert.ok(report.snapshot.source_fingerprints.some((value) => value.startsWith('etf-mapping:')));
    assert.deepEqual(report.decisionVariants.variants.at(-1)?.hedgeContext, hedgeContext);
  });

  it('is idempotent and stably serializable after the snapshot already exists', async () => {
    await buildMonthlyDecisionReport(exampleInput(), hedgeContext);
    const first = await buildMonthlyDecisionReport(exampleInput(), hedgeContext);
    const second = await buildMonthlyDecisionReport(exampleInput(), hedgeContext);

    assert.equal(first.import.created, false);
    assert.equal(second.import.created, false);
    assert.equal(first.import.id, second.import.id);
    assert.equal(
      stableSerializeMonthlyDecisionReport(first),
      stableSerializeMonthlyDecisionReport(second)
    );
  });
});
