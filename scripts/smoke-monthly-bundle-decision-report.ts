import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  buildMonthlyBundleDecisionReport,
  stableSerializeMonthlyBundleDecisionReport
} from '../lib/monthly-bundle-decision-report';
import { computeEtfMappingFingerprint } from '../lib/etf-nearest-neighbour-mapping';
import { computeGpoSourceEvidenceFingerprint } from '../lib/gpo-source-evidence';
import { computeGpoTargetAllocationFingerprint } from '../lib/gpo-target-allocation';
import { computePortfolioSnapshotFingerprint } from '../lib/portfolio-snapshot';

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

async function main(): Promise<void> {
  const bundle = fixtureBundle();
  const first = await buildMonthlyBundleDecisionReport(bundle);
  const second = await buildMonthlyBundleDecisionReport(bundle);

  assert.match(first.bundleFingerprint, /^sha256:[a-f0-9]{64}$/);
  assert.equal(first.snapshot.snapshot_id, '2026-08');
  assert.equal(first.provenance.etfMappingReview?.as_of, '2026-09-30');
  assert.equal('order' in first, false);
  assert.equal('selectedVariant' in first, false);
  assert.equal(
    stableSerializeMonthlyBundleDecisionReport(first),
    stableSerializeMonthlyBundleDecisionReport(second)
  );

  process.stdout.write(
    `MONTHLY_BETA_SMOKE_OK bundle=${first.bundleFingerprint} snapshot=${first.snapshot.snapshot_id}\n`
  );
}

main().catch((error) => {
  console.error(`MONTHLY_BETA_SMOKE_FAILED: ${error instanceof Error ? error.message : String(error)}`);
  process.exit(1);
});
