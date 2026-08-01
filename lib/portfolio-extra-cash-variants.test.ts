import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, it } from 'node:test';
import { computeMonthlyPortfolioAllocation } from './portfolio-allocation';
import {
  proposeExtraCashVariants,
  serializeExtraCashVariants,
  type HedgeContext
} from './portfolio-extra-cash-variants';
import { computePortfolioSnapshotFingerprint, type PortfolioSnapshot } from './portfolio-snapshot';

function fixture(): PortfolioSnapshot {
  return JSON.parse(
    readFileSync(join(process.cwd(), 'fixtures', 'portfolio-snapshot', 'valid.json'), 'utf8')
  ) as PortfolioSnapshot;
}

function refingerprint(snapshot: PortfolioSnapshot): PortfolioSnapshot {
  const withoutFingerprint = { ...snapshot, input_fingerprint: undefined } as unknown as PortfolioSnapshot;
  return {
    ...snapshot,
    input_fingerprint: computePortfolioSnapshotFingerprint(withoutFingerprint)
  };
}

describe('extra-cash decision variants', () => {
  it('caps extra-cash deployment by available cash and remaining positive gaps', () => {
    const snapshot = fixture();
    const allocation = computeMonthlyPortfolioAllocation(snapshot);
    const result = proposeExtraCashVariants(snapshot, allocation);
    const deploy = result.variants.find((variant) => variant.variantId === 'deploy-extra-cash');
    assert.ok(deploy);
    assert.ok(deploy.additionalCashAllocated <= snapshot.portfolio.additional_cash_available);
    assert.equal(
      deploy.additionalCashAllocated + deploy.residualAdditionalCash,
      snapshot.portfolio.additional_cash_available
    );

    for (const exposure of deploy.exposures) {
      assert.ok(exposure.additionalPurchaseAllocation >= 0);
      assert.ok(exposure.additionalPurchaseAllocation <= exposure.remainingPositiveGap);
    }
  });

  it('allocates zero additional cash to exposures with no remaining positive gap', () => {
    const snapshot = fixture();
    const result = proposeExtraCashVariants(snapshot);
    const deploy = result.variants.find((variant) => variant.variantId === 'deploy-extra-cash');
    assert.ok(deploy);
    for (const exposure of deploy.exposures.filter((row) => row.remainingPositiveGap === 0)) {
      assert.equal(exposure.additionalPurchaseAllocation, 0);
    }
  });

  it('reports full residual additional cash when there are no positive gaps', () => {
    const base = fixture();
    const balanced = refingerprint({
      ...base,
      exposures: base.exposures.map((exposure) => ({
        ...exposure,
        current_weight: exposure.target_weight,
        gap_amount: 0
      }))
    });
    const result = proposeExtraCashVariants(balanced);
    const deploy = result.variants.find((variant) => variant.variantId === 'deploy-extra-cash');
    assert.ok(deploy);
    assert.equal(deploy.additionalCashAllocated, 0);
    assert.equal(deploy.residualAdditionalCash, balanced.portfolio.additional_cash_available);
  });

  it('preserves hedge context verbatim as metadata without creating execution fields', () => {
    const hedgeContext: HedgeContext = {
      risk_regime: 'elevated',
      recommended_hedge_ratio: 0.35,
      hedge_notional_eur: 12500,
      confidence: 'medium',
      reasons: ['drawdown', 'volatility'],
      source_rule_version: '2.1.0'
    };
    const result = proposeExtraCashVariants(fixture(), undefined, hedgeContext);
    const variant = result.variants.find(
      (candidate) => candidate.variantId === 'deploy-extra-cash-with-hedge-context'
    );
    assert.ok(variant);
    assert.deepEqual(variant.hedgeContext, hedgeContext);
    assert.equal('order' in variant, false);
    assert.equal('selected' in variant, false);
  });

  it('serializes identical inputs byte-equivalently', () => {
    const snapshot = fixture();
    const first = serializeExtraCashVariants(proposeExtraCashVariants(snapshot));
    const second = serializeExtraCashVariants(proposeExtraCashVariants(snapshot));
    assert.equal(first, second);
  });
});
