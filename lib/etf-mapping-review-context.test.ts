import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { prisma } from './prisma';
import { computeEtfMappingFingerprint } from './etf-nearest-neighbour-mapping';
import { persistEtfMappingReviewRecord } from './etf-mapping-review-history';
import {
  computeEtfMappingReviewContextFingerprint,
  prepareEtfMappingReviewContext
} from './etf-mapping-review-context';

function candidate(instrumentId: string, active = true) {
  return {
    instrument_id: instrumentId,
    exposure_fidelity: 0.99,
    ter: 0.002,
    tracking_difference: 0.001,
    fund_size: 1_000_000_000,
    savings_plan_eligible: true,
    tradable: true,
    active_for_new_purchases: active
  };
}

function mapping(version: string, selectedInstrumentId: string) {
  return {
    schema_version: 'etf-nearest-neighbour-mapping/1.0' as const,
    mapping_version: version,
    effective_date: '2026-08-01',
    exposures: [
      {
        exposure_id: 'global-equity',
        desired_reference: 'MSCI ACWI',
        selected_instrument_id: selectedInstrumentId,
        candidates: [
          candidate('ETF-A', selectedInstrumentId === 'ETF-A'),
          candidate('ETF-B', selectedInstrumentId === 'ETF-B')
        ]
      }
    ]
  };
}

const policy = { review_interval_days: 90, overdue_grace_days: 14 };

describe('ETF mapping review context', () => {
  beforeEach(async () => {
    await prisma.etfMappingReviewRecord.deleteMany();
  });

  it('combines review status, deterministic comparison, and prior history', async () => {
    const current = mapping('2026-08', 'ETF-A');
    const next = mapping('2026-11', 'ETF-B');
    const currentFingerprint = computeEtfMappingFingerprint(current);
    const nextFingerprint = computeEtfMappingFingerprint(next);

    await persistEtfMappingReviewRecord({
      schema_version: 'etf-mapping-review-record/1.0',
      current_mapping: {
        mapping_version: current.mapping_version,
        mapping_fingerprint: currentFingerprint
      },
      candidate_mapping: {
        mapping_version: next.mapping_version,
        mapping_fingerprint: nextFingerprint
      },
      outcome: 'defer',
      reviewer: 'portfolio-owner',
      reviewed_at: '2026-10-15T08:00:00.000Z',
      rationale: 'Wait for another month of tracking evidence.'
    });

    const context = await prepareEtfMappingReviewContext(current, next, '2026-11-01', policy);

    assert.equal(context.schema_version, 'etf-mapping-review-context/1.0');
    assert.equal(context.current_mapping.mapping_fingerprint, currentFingerprint);
    assert.equal(context.review_status.status, 'due');
    assert.equal(context.candidate_mapping?.mapping_fingerprint, nextFingerprint);
    assert.equal(context.comparison?.exposures[0]?.change, 'purchase_instrument_changed');
    assert.match(context.comparison_fingerprint ?? '', /^sha256:[a-f0-9]{64}$/);
    assert.equal(context.prior_reviews.length, 1);
    assert.equal(context.prior_reviews[0]?.outcome, 'defer');
    assert.equal(context.prior_reviews[0]?.reviewed_at, '2026-10-15T08:00:00.000Z');
  });

  it('prepares a current-mapping-only context without inventing a candidate', async () => {
    const current = mapping('2026-08', 'ETF-A');
    const context = await prepareEtfMappingReviewContext(current, undefined, '2026-08-15', policy);

    assert.equal(context.review_status.status, 'current');
    assert.equal(context.candidate_mapping, undefined);
    assert.equal(context.comparison, undefined);
    assert.equal(context.comparison_fingerprint, undefined);
    assert.deepEqual(context.prior_reviews, []);
  });

  it('produces a stable context fingerprint for repeated reads', async () => {
    const current = mapping('2026-08', 'ETF-A');
    const next = mapping('2026-11', 'ETF-B');
    const first = await prepareEtfMappingReviewContext(current, next, '2026-11-01', policy);
    const second = await prepareEtfMappingReviewContext(current, next, '2026-11-01', policy);

    assert.equal(
      computeEtfMappingReviewContextFingerprint(first),
      computeEtfMappingReviewContextFingerprint(second)
    );
  });

  it('rejects malformed mappings through the existing validators', async () => {
    await assert.rejects(() => prepareEtfMappingReviewContext(
      { ...mapping('2026-08', 'ETF-A'), effective_date: 'not-a-date' },
      undefined,
      '2026-11-01',
      policy
    ));
  });
});
