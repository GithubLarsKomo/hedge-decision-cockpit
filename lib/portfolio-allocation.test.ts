import test from 'node:test';
import assert from 'node:assert/strict';
import { computePortfolioSnapshotFingerprint, validatePortfolioSnapshot } from './portfolio-snapshot';
import { computeMonthlyPortfolioAllocation } from './portfolio-allocation';

function snapshot(overrides: Record<string, unknown> = {}) {
  const payload = {
    schema_version: 'portfolio-snapshot/1.0' as const,
    snapshot_id: '2026-09',
    revision: 1,
    as_of: '2026-09-30',
    generated_at: '2026-09-30T20:00:00+02:00',
    strategy: {
      name: 'gpo-private-replication',
      version: '2026-09',
      source_observation_date: '2026-09-30',
      estimation_status: 'observed' as const,
      confidence: 'high' as const
    },
    portfolio: {
      currency: 'EUR',
      market_value: 100000,
      monthly_contribution: 1000,
      additional_cash_available: 0,
      target_equity_weight: 0.8,
      current_equity_weight: 0.8,
      equity_gap_amount: 0
    },
    exposures: [
      {
        exposure_id: 'a',
        target_weight: 0.5,
        current_weight: 0.45,
        gap_amount: 5000,
        target_source: 'observed' as const,
        mapped_instruments: ['ETF-A'],
        active_purchase_instrument: 'ETF-A',
        mapping_version: '2026-09'
      },
      {
        exposure_id: 'b',
        target_weight: 0.3,
        current_weight: 0.28,
        gap_amount: 2000,
        target_source: 'observed' as const,
        mapped_instruments: ['ETF-B'],
        active_purchase_instrument: 'ETF-B',
        mapping_version: '2026-09'
      },
      {
        exposure_id: 'c',
        target_weight: 0.2,
        current_weight: 0.27,
        gap_amount: -7000,
        target_source: 'observed' as const,
        mapped_instruments: ['ETF-C'],
        mapping_version: '2026-09'
      }
    ],
    purchase_scenarios: [],
    source_fingerprints: []
  };

  Object.assign(payload, overrides);
  const input_fingerprint = computePortfolioSnapshotFingerprint(payload);
  return validatePortfolioSnapshot({ ...payload, input_fingerprint });
}

test('computes deterministic drift and allocates contribution only to underweights', () => {
  const result = computeMonthlyPortfolioAllocation(snapshot());

  assert.equal(result.allocatedContribution, 1000);
  assert.equal(result.residualContribution, 0);
  assert.equal(result.totalPositiveGap, 7000);
  assert.equal(result.exposures[0].gapAmount, 5000);
  assert.equal(result.exposures[1].gapAmount, 2000);
  assert.equal(result.exposures[2].gapAmount, -7000);
  assert.equal(result.exposures[2].contributionAllocation, 0);
  assert.equal(result.exposures[0].driftPercentagePoints, -5);
  assert.equal(result.exposures[0].relativeDrift, -0.1);
  assert.equal(result.exposures.reduce((sum, row) => sum + row.contributionAllocation, 0), 1000);
});

test('never allocates more than the positive gap and reports residual contribution', () => {
  const value = snapshot({
    portfolio: {
      currency: 'EUR',
      market_value: 10000,
      monthly_contribution: 5000,
      additional_cash_available: 0,
      target_equity_weight: 0.8,
      current_equity_weight: 0.8,
      equity_gap_amount: 0
    },
    exposures: [
      {
        exposure_id: 'a',
        target_weight: 0.5,
        current_weight: 0.49,
        gap_amount: 100,
        target_source: 'observed',
        mapped_instruments: ['ETF-A'],
        mapping_version: '2026-09'
      }
    ]
  });

  const result = computeMonthlyPortfolioAllocation(value);
  assert.equal(result.allocatedContribution, 100);
  assert.equal(result.residualContribution, 4900);
  assert.equal(result.exposures[0].contributionAllocation, 100);
});

test('allocates nothing when there are no positive gaps', () => {
  const value = snapshot({
    exposures: [
      {
        exposure_id: 'a',
        target_weight: 0.5,
        current_weight: 0.5,
        gap_amount: 0,
        target_source: 'observed',
        mapped_instruments: ['ETF-A'],
        mapping_version: '2026-09'
      }
    ]
  });

  const result = computeMonthlyPortfolioAllocation(value);
  assert.equal(result.allocatedContribution, 0);
  assert.equal(result.residualContribution, 1000);
  assert.equal(result.totalPositiveGap, 0);
});

test('rounding remains deterministic and exact to cents', () => {
  const value = snapshot({
    portfolio: {
      currency: 'EUR',
      market_value: 100,
      monthly_contribution: 1,
      additional_cash_available: 0,
      target_equity_weight: 0.8,
      current_equity_weight: 0.8,
      equity_gap_amount: 0
    },
    exposures: [
      {
        exposure_id: 'a', target_weight: 0.34, current_weight: 0.3, gap_amount: 4,
        target_source: 'observed', mapped_instruments: ['A'], mapping_version: '1'
      },
      {
        exposure_id: 'b', target_weight: 0.33, current_weight: 0.29, gap_amount: 4,
        target_source: 'observed', mapped_instruments: ['B'], mapping_version: '1'
      },
      {
        exposure_id: 'c', target_weight: 0.33, current_weight: 0.29, gap_amount: 4,
        target_source: 'observed', mapped_instruments: ['C'], mapping_version: '1'
      }
    ]
  });
  const first = computeMonthlyPortfolioAllocation(value);
  const second = computeMonthlyPortfolioAllocation(value);
  assert.deepEqual(first, second);
  assert.equal(first.exposures.reduce((sum, row) => sum + row.contributionAllocation, 0), 1);
});
