import test from 'node:test';
import assert from 'node:assert/strict';
import { computePortfolioSnapshotFingerprint, validatePortfolioSnapshot } from './portfolio-snapshot';
import { computeMonthlyPortfolioAllocation } from './portfolio-allocation';
import { buildPortfolioDecisionVariants, stableSerializePortfolioDecisionVariants } from './portfolio-decision-variants';

function snapshot(overrides: Record<string, unknown> = {}) {
  const payload = {
    schema_version: 'portfolio-snapshot/1.0' as const,
    snapshot_id: '2026-10',
    revision: 1,
    as_of: '2026-10-31',
    generated_at: '2026-10-31T20:00:00+01:00',
    strategy: {
      name: 'gpo-private-replication',
      version: '2026-10',
      source_observation_date: '2026-10-31',
      estimation_status: 'observed' as const,
      confidence: 'high' as const
    },
    portfolio: {
      currency: 'EUR',
      market_value: 100000,
      monthly_contribution: 1000,
      additional_cash_available: 5000,
      target_equity_weight: 0.8,
      current_equity_weight: 0.8,
      equity_gap_amount: 0
    },
    exposures: [
      {
        exposure_id: 'a', target_weight: 0.5, current_weight: 0.45, gap_amount: 5000,
        target_source: 'observed' as const, mapped_instruments: ['ETF-A'],
        active_purchase_instrument: 'ETF-A', mapping_version: '2026-10'
      },
      {
        exposure_id: 'b', target_weight: 0.3, current_weight: 0.28, gap_amount: 2000,
        target_source: 'observed' as const, mapped_instruments: ['ETF-B'],
        active_purchase_instrument: 'ETF-B', mapping_version: '2026-10'
      },
      {
        exposure_id: 'c', target_weight: 0.2, current_weight: 0.27, gap_amount: -7000,
        target_source: 'observed' as const, mapped_instruments: ['ETF-C'], mapping_version: '2026-10'
      }
    ],
    purchase_scenarios: [],
    source_fingerprints: []
  };

  Object.assign(payload, overrides);
  const input_fingerprint = computePortfolioSnapshotFingerprint(payload);
  return validatePortfolioSnapshot({ ...payload, input_fingerprint });
}

test('builds contribution-only and capped proportional extra-cash variants', () => {
  const value = snapshot();
  const allocation = computeMonthlyPortfolioAllocation(value);
  const result = buildPortfolioDecisionVariants(value, allocation);

  assert.deepEqual(result.variants.map((variant) => variant.variantId), [
    'contribution-only',
    'deploy-extra-cash'
  ]);

  const contributionOnly = result.variants[0];
  assert.equal(contributionOnly.additionalCashDeployed, 0);
  assert.equal(contributionOnly.residualAdditionalCash, 5000);

  const deploy = result.variants[1];
  assert.equal(deploy.additionalCashDeployed, 5000);
  assert.equal(deploy.residualAdditionalCash, 0);
  assert.equal(deploy.allocations.find((row) => row.exposureId === 'c')?.additionalPurchase, 0);
  assert.ok(deploy.allocations.every((row) => row.additionalPurchase <= row.remainingPositiveGap));
  assert.equal(deploy.allocations.reduce((sum, row) => sum + row.additionalPurchase, 0), 5000);
});

test('preserves hedge context verbatim without converting it into an instruction', () => {
  const value = snapshot();
  const allocation = computeMonthlyPortfolioAllocation(value);
  const hedgeContext = {
    risk_regime: 'elevated',
    recommended_hedge_ratio: 0.25,
    hedge_notional_eur: 19800,
    confidence: 'medium',
    reasons: ['volatility above threshold', 'negative trend confirmation']
  } as const;

  const result = buildPortfolioDecisionVariants(value, allocation, hedgeContext);
  const contextual = result.variants.find(
    (variant) => variant.variantId === 'deploy-extra-cash-with-hedge-context'
  );

  assert.ok(contextual);
  assert.deepEqual(contextual.hedgeContext, hedgeContext);
  assert.equal('order' in contextual, false);
  assert.equal('selected' in contextual, false);
});

test('reports all additional cash as residual when no remaining gaps exist', () => {
  const value = snapshot({
    exposures: [
      {
        exposure_id: 'a', target_weight: 1, current_weight: 1, gap_amount: 0,
        target_source: 'observed', mapped_instruments: ['ETF-A'], mapping_version: '2026-10'
      }
    ]
  });
  const allocation = computeMonthlyPortfolioAllocation(value);
  const result = buildPortfolioDecisionVariants(value, allocation);
  const deploy = result.variants.find((variant) => variant.variantId === 'deploy-extra-cash');

  assert.ok(deploy);
  assert.equal(deploy.additionalCashDeployed, 0);
  assert.equal(deploy.residualAdditionalCash, 5000);
});

test('stable serialization is byte-equivalent for identical inputs', () => {
  const value = snapshot();
  const allocation = computeMonthlyPortfolioAllocation(value);
  const first = buildPortfolioDecisionVariants(value, allocation);
  const second = buildPortfolioDecisionVariants(value, allocation);

  assert.equal(stableSerializePortfolioDecisionVariants(first), stableSerializePortfolioDecisionVariants(second));
});
