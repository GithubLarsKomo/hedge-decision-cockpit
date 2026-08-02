import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { prisma } from './prisma';
import {
  computeEtfMappingReviewContextFingerprint,
  prepareEtfMappingReviewContext
} from './etf-mapping-review-context';
import { persistEtfMappingReviewDecisionFromContext } from './etf-mapping-review-decision-workflow';

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

function decision(contextFingerprint: string, overrides: Record<string, unknown> = {}) {
  return {
    context_fingerprint: contextFingerprint,
    outcome: 'keep_current',
    reviewer: 'portfolio-owner',
    reviewed_at: '2026-11-01T09:00:00.000Z',
    rationale: 'Keep the current mapping after explicit review.',
    ...overrides
  };
}

describe('ETF mapping review decision workflow', () => {
  beforeEach(async () => {
    await prisma.etfMappingReviewRecord.deleteMany();
  });

  it('binds an explicit replacement decision to comparison evidence and persists it', async () => {
    const context = await prepareEtfMappingReviewContext(
      mapping('2026-08', 'ETF-A'),
      mapping('2026-11', 'ETF-B'),
      '2026-11-01',
      policy
    );
    const contextFingerprint = computeEtfMappingReviewContextFingerprint(context);

    const result = await persistEtfMappingReviewDecisionFromContext(context, decision(contextFingerprint, {
      outcome: 'accept_replacement',
      rationale: 'Replacement approved after reviewing the deterministic mapping diff.'
    }));

    assert.equal(result.persistence.created, true);
    assert.match(result.record_fingerprint, /^sha256:[a-f0-9]{64}$/);
    assert.match(result.review_evidence_fingerprint ?? '', /^sha256:[a-f0-9]{64}$/);
    assert.equal(result.history.length, 1);
    assert.equal(result.history[0]?.outcome, 'accept_replacement');
    assert.equal(result.history[0]?.currentMappingFingerprint, context.current_mapping.mapping_fingerprint);
  });

  it('is idempotent when the same human decision is replayed', async () => {
    const context = await prepareEtfMappingReviewContext(
      mapping('2026-08', 'ETF-A'),
      undefined,
      '2026-11-01',
      policy
    );
    const contextFingerprint = computeEtfMappingReviewContextFingerprint(context);
    const input = decision(contextFingerprint, { outcome: 'defer', rationale: 'Review again next month.' });

    const first = await persistEtfMappingReviewDecisionFromContext(context, input);
    const second = await persistEtfMappingReviewDecisionFromContext(context, input);

    assert.equal(first.persistence.created, true);
    assert.equal(second.persistence.created, false);
    assert.equal(second.persistence.id, first.persistence.id);
    assert.equal(second.record_fingerprint, first.record_fingerprint);
    assert.equal(second.history.length, 1);
  });

  it('rejects stale context fingerprints before persistence', async () => {
    const context = await prepareEtfMappingReviewContext(
      mapping('2026-08', 'ETF-A'),
      undefined,
      '2026-11-01',
      policy
    );

    await assert.rejects(
      () => persistEtfMappingReviewDecisionFromContext(context, decision(`sha256:${'0'.repeat(64)}`)),
      /stale or mismatched/
    );
    assert.equal(await prisma.etfMappingReviewRecord.count(), 0);
  });

  it('rejects accept_replacement when no candidate comparison exists', async () => {
    const context = await prepareEtfMappingReviewContext(
      mapping('2026-08', 'ETF-A'),
      undefined,
      '2026-11-01',
      policy
    );
    const contextFingerprint = computeEtfMappingReviewContextFingerprint(context);

    await assert.rejects(
      () => persistEtfMappingReviewDecisionFromContext(context, decision(contextFingerprint, {
        outcome: 'accept_replacement'
      })),
      /requires candidate comparison evidence/
    );
    assert.equal(await prisma.etfMappingReviewRecord.count(), 0);
  });

  it('rejects tampered comparison fingerprints before persistence', async () => {
    const context = await prepareEtfMappingReviewContext(
      mapping('2026-08', 'ETF-A'),
      mapping('2026-11', 'ETF-B'),
      '2026-11-01',
      policy
    );
    const tampered = {
      ...context,
      comparison_fingerprint: `sha256:${'f'.repeat(64)}`
    };

    await assert.rejects(
      () => persistEtfMappingReviewDecisionFromContext(
        tampered,
        decision(computeEtfMappingReviewContextFingerprint(tampered))
      ),
      /comparison fingerprint mismatch/
    );
    assert.equal(await prisma.etfMappingReviewRecord.count(), 0);
  });
});
