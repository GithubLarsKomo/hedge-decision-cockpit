import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { computeEtfMappingFingerprint } from './etf-nearest-neighbour-mapping';
import { computeGpoSourceEvidenceFingerprint } from './gpo-source-evidence';
import { computeGpoTargetAllocationFingerprint } from './gpo-target-allocation';
import {
  computeMonthlyPortfolioRunBundleFingerprint,
  prepareMonthlyPortfolioRunBundle,
  validateMonthlyPortfolioRunBundle
} from './monthly-portfolio-run-bundle';
import type { MonthlyPortfolioInput } from './portfolio-snapshot-generator';

function readJson(path: string): unknown {
  return JSON.parse(readFileSync(join(process.cwd(), path), 'utf8'));
}

function fixtureBundle() {
  const monthlyInput = readJson('fixtures/portfolio-snapshot/monthly-input.json') as MonthlyPortfolioInput;
  const gpoTargetAllocation = readJson('fixtures/gpo-target-allocation/2026-08.json');
  const gpoSourceEvidence = readJson('fixtures/gpo-source-evidence/2026-08.json');
  const etfMapping = readJson('fixtures/etf-mapping/2026-08.json');

  return {
    schema_version: 'monthly-portfolio-run-bundle/1.0',
    as_of: '2026-09-30',
    members: {
      monthly_portfolio_input: {
        value: monthlyInput
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
  } as const;
}

describe('monthly portfolio run bundle', () => {
  it('validates and fingerprints the complete monthly semantic input deterministically', () => {
    const bundle = fixtureBundle();
    const validated = validateMonthlyPortfolioRunBundle(bundle);
    const first = computeMonthlyPortfolioRunBundleFingerprint(validated);
    const second = computeMonthlyPortfolioRunBundleFingerprint(JSON.parse(JSON.stringify(bundle)));

    assert.match(first, /^sha256:[a-f0-9]{64}$/);
    assert.equal(second, first);
  });

  it('rejects a member when its declared fingerprint does not match semantic content', () => {
    const bundle = fixtureBundle();
    const changed = {
      ...bundle,
      members: {
        ...bundle.members,
        gpo_target_allocation: {
          ...bundle.members.gpo_target_allocation,
          fingerprint: '0'.repeat(64)
        }
      }
    };

    assert.throws(() => validateMonthlyPortfolioRunBundle(changed));
  });

  it('prepares exactly the existing canonical workflow inputs without duplicating workflow logic', () => {
    const bundle = fixtureBundle();
    const prepared = prepareMonthlyPortfolioRunBundle(bundle);

    assert.deepEqual(prepared.input, bundle.members.monthly_portfolio_input.value);
    assert.deepEqual(prepared.hedgeContext, bundle.hedge_context);
    assert.deepEqual(prepared.preprocessing.gpoTargetAllocation, bundle.members.gpo_target_allocation.value);
    assert.deepEqual(prepared.preprocessing.gpoSourceEvidence, bundle.members.gpo_source_evidence.value);
    assert.deepEqual(prepared.preprocessing.etfMapping, bundle.members.etf_mapping.value);
    assert.deepEqual(prepared.preprocessing.etfMappingReview, {
      as_of: bundle.as_of,
      policy: bundle.etf_mapping_review_policy
    });
    assert.match(prepared.bundleFingerprint, /^sha256:[a-f0-9]{64}$/);
  });
});
