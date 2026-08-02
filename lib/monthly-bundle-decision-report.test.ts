import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { beforeEach, describe, it } from 'node:test';
import { prisma } from './prisma';
import {
  buildMonthlyBundleDecisionReport,
  stableSerializeMonthlyBundleDecisionReport
} from './monthly-bundle-decision-report';
import {
  computeEtfMappingFingerprint
} from './etf-nearest-neighbour-mapping';
import { persistEtfMappingReviewRecord } from './etf-mapping-review-history';
import { computeGpoSourceEvidenceFingerprint } from './gpo-source-evidence';
import { computeGpoTargetAllocationFingerprint } from './gpo-target-allocation';
import { computePortfolioSnapshotFingerprint } from './portfolio-snapshot';

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(join(process.cwd(), path), 'utf8'));
}

function fixtureBundle() {
  const monthlyInput = readJson('fixtures/portfolio-snapshot/monthly-input.json');
  const gpoTargetAllocation = readJson('fixtures/gpo-target-allocation/2026-08.json');
  const gpoSourceEvidence = readJson('fixtures/gpo-source-evidence/2026-08.json');
  const etfMapping = readJson('fixtures/etf-mapping/2026-08.json');

  return {
    schema_version: 'monthly-portfolio-run-bundle/1.0',
    as_of: '2026-09-30',
    members: {
      monthly_portfolio_input: {
        value: monthlyInput,
        fingerprint: computePortfolioSnapshotFingerprint(monthlyInput)
      },
      gpo_target_allocation: {
        value: gpoTargetAllocation,
        fingerprint: computeGpoTargetAllocationFingerprint(gpoTargetAllocation)
      },
      gpo_source_evidence: {
        value: gpoSourceEvidence,
        fingerprint: computeGpoSourceEvidenceFingerprint(gpoSourceEvidence)
      },
      etf_mapping: {
        value: etfMapping,
        fingerprint: computeEtfMappingFingerprint(etfMapping)
      }
    },
    etf_mapping_review_policy: {
      review_interval_days: 30,
      overdue_grace_days: 7
    },
    hedge_context: {
      risk_regime: 'elevated',
      recommended_hedge_ratio: 0.15,
      hedge_notional_eur: 12500,
      confidence: 'medium',
      reasons: ['drawdown', 'volatility']
    }
  };
}

describe('monthly bundle decision report', () => {
  beforeEach(async () => {
    await prisma.importedPortfolioSnapshot.deleteMany({ where: { snapshotId: '2026-08' } });
    await prisma.etfMappingReviewRecord.deleteMany();
  });

  it('runs the canonical monthly report from a validated bundle and records the bundle fingerprint', async () => {
    const report = await buildMonthlyBundleDecisionReport(fixtureBundle());

    assert.match(report.bundleFingerprint, /^sha256:[a-f0-9]{64}$/);
    assert.equal(report.snapshot.snapshot_id, '2026-08');
    assert.equal(report.provenance.etfMappingReview?.as_of, '2026-09-30');
    assert.equal(report.decisionVariants.variants.at(-1)?.variantId, 'deploy-extra-cash-with-hedge-context');
    assert.equal(report.etfMappingHumanReview, undefined);
    assert.equal('order' in report, false);
    assert.equal('selectedVariant' in report, false);
  });

  it('surfaces only the latest matching human ETF mapping review without switching automatically', async () => {
    const bundle = fixtureBundle();
    const mappingFingerprint = bundle.members.etf_mapping.fingerprint;

    await persistEtfMappingReviewRecord({
      schema_version: 'etf-mapping-review-record/1.0',
      current_mapping: { mapping_version: '2026-08', mapping_fingerprint: mappingFingerprint },
      outcome: 'defer',
      reviewer: 'portfolio-owner',
      reviewed_at: '2026-09-01T09:30:00.000Z',
      rationale: 'Wait for more evidence.'
    });
    await persistEtfMappingReviewRecord({
      schema_version: 'etf-mapping-review-record/1.0',
      current_mapping: { mapping_version: '2026-08', mapping_fingerprint: mappingFingerprint },
      candidate_mapping: {
        mapping_version: '2026-09',
        mapping_fingerprint: `sha256:${'b'.repeat(64)}`
      },
      outcome: 'accept_replacement',
      reviewer: 'portfolio-owner',
      reviewed_at: '2026-09-29T09:30:00.000Z',
      rationale: 'Replacement approved for a future mapping version.'
    });

    const report = await buildMonthlyBundleDecisionReport(bundle);

    assert.equal(report.etfMappingHumanReview?.outcome, 'accept_replacement');
    assert.equal(report.etfMappingHumanReview?.currentMappingFingerprint, mappingFingerprint);
    assert.equal(report.etfMappingHumanReview?.reviewer, 'portfolio-owner');
    assert.equal(report.etfMappingHumanReview?.reviewedAt, '2026-09-29T09:30:00.000Z');
    assert.equal('order' in report, false);
    assert.equal('selectedVariant' in report, false);
  });

  it('does not leak review history from an unrelated mapping fingerprint', async () => {
    const bundle = fixtureBundle();
    await persistEtfMappingReviewRecord({
      schema_version: 'etf-mapping-review-record/1.0',
      current_mapping: {
        mapping_version: 'unrelated',
        mapping_fingerprint: `sha256:${'c'.repeat(64)}`
      },
      outcome: 'keep_current',
      reviewer: 'portfolio-owner',
      reviewed_at: '2026-09-29T10:00:00.000Z',
      rationale: 'Unrelated mapping review.'
    });

    const report = await buildMonthlyBundleDecisionReport(bundle);
    assert.equal(report.etfMappingHumanReview, undefined);
  });

  it('rejects an invalid member fingerprint before persistence', async () => {
    const bundle = fixtureBundle();
    bundle.members.gpo_target_allocation.fingerprint = '0'.repeat(64);

    await assert.rejects(() => buildMonthlyBundleDecisionReport(bundle));
    assert.equal(await prisma.importedPortfolioSnapshot.count({ where: { snapshotId: '2026-08' } }), 0);
  });

  it('is stably serializable for the same bundle and matching human review', async () => {
    const bundle = fixtureBundle();
    const mappingFingerprint = bundle.members.etf_mapping.fingerprint;
    await persistEtfMappingReviewRecord({
      schema_version: 'etf-mapping-review-record/1.0',
      current_mapping: { mapping_version: '2026-08', mapping_fingerprint: mappingFingerprint },
      outcome: 'keep_current',
      reviewer: 'portfolio-owner',
      reviewed_at: '2026-09-29T09:30:00.000Z',
      rationale: 'Current mapping remains appropriate.'
    });

    await buildMonthlyBundleDecisionReport(bundle);
    const first = await buildMonthlyBundleDecisionReport(bundle);
    const second = await buildMonthlyBundleDecisionReport(bundle);

    assert.equal(
      stableSerializeMonthlyBundleDecisionReport(first),
      stableSerializeMonthlyBundleDecisionReport(second)
    );
  });
});
