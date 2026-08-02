import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  canonicalizeEtfMappingReviewRecord,
  computeEtfMappingReviewRecordFingerprint,
  validateEtfMappingReviewRecord
} from './etf-mapping-review-record';

const current = {
  mapping_version: '2026-08',
  mapping_fingerprint: `sha256:${'a'.repeat(64)}`
};

const candidate = {
  mapping_version: '2026-11',
  mapping_fingerprint: `sha256:${'b'.repeat(64)}`
};

function baseRecord() {
  return {
    schema_version: 'etf-mapping-review-record/1.0' as const,
    current_mapping: current,
    candidate_mapping: candidate,
    outcome: 'keep_current' as const,
    reviewer: 'portfolio-owner',
    reviewed_at: '2026-11-29T09:30:00+01:00',
    rationale: 'Current mapping remains sufficiently close to the target exposure.'
  };
}

describe('ETF mapping review record', () => {
  it('validates a keep-current record with comparison candidate', () => {
    const record = validateEtfMappingReviewRecord(baseRecord());
    assert.equal(record.outcome, 'keep_current');
    assert.deepEqual(record.candidate_mapping, candidate);
  });

  it('accepts an explicit replacement only with a different candidate fingerprint', () => {
    const record = validateEtfMappingReviewRecord({
      ...baseRecord(),
      outcome: 'accept_replacement'
    });
    assert.equal(record.outcome, 'accept_replacement');

    assert.throws(
      () => validateEtfMappingReviewRecord({
        ...baseRecord(),
        outcome: 'accept_replacement',
        candidate_mapping: undefined
      }),
      /candidate_mapping is required/
    );

    assert.throws(
      () => validateEtfMappingReviewRecord({
        ...baseRecord(),
        outcome: 'accept_replacement',
        candidate_mapping: {
          mapping_version: '2026-11',
          mapping_fingerprint: current.mapping_fingerprint
        }
      }),
      /different fingerprint/
    );
  });

  it('supports defer without implying a replacement', () => {
    const record = validateEtfMappingReviewRecord({
      ...baseRecord(),
      outcome: 'defer',
      candidate_mapping: undefined,
      rationale: 'Candidate evidence is incomplete; review again next month.'
    });
    assert.equal(record.outcome, 'defer');
    assert.equal(record.candidate_mapping, undefined);
  });

  it('canonicalizes deterministically across object key order', () => {
    const first = baseRecord();
    const second = {
      rationale: first.rationale,
      reviewed_at: first.reviewed_at,
      reviewer: first.reviewer,
      outcome: first.outcome,
      candidate_mapping: {
        mapping_fingerprint: candidate.mapping_fingerprint,
        mapping_version: candidate.mapping_version
      },
      current_mapping: {
        mapping_fingerprint: current.mapping_fingerprint,
        mapping_version: current.mapping_version
      },
      schema_version: first.schema_version
    };

    assert.equal(canonicalizeEtfMappingReviewRecord(first), canonicalizeEtfMappingReviewRecord(second));
    assert.equal(
      computeEtfMappingReviewRecordFingerprint(first),
      computeEtfMappingReviewRecordFingerprint(second)
    );
    assert.match(computeEtfMappingReviewRecordFingerprint(first), /^sha256:[a-f0-9]{64}$/);
  });

  it('changes the fingerprint when the human decision changes', () => {
    const first = baseRecord();
    const second = { ...baseRecord(), outcome: 'defer' as const };
    assert.notEqual(
      computeEtfMappingReviewRecordFingerprint(first),
      computeEtfMappingReviewRecordFingerprint(second)
    );
  });

  it('rejects malformed metadata and unsupported fields', () => {
    assert.throws(() => validateEtfMappingReviewRecord({
      ...baseRecord(),
      reviewer: '   '
    }));
    assert.throws(() => validateEtfMappingReviewRecord({
      ...baseRecord(),
      rationale: ''
    }));
    assert.throws(() => validateEtfMappingReviewRecord({
      ...baseRecord(),
      reviewed_at: '2026-11-29'
    }));
    assert.throws(() => validateEtfMappingReviewRecord({
      ...baseRecord(),
      current_mapping: {
        ...current,
        mapping_fingerprint: 'sha256:not-a-digest'
      }
    }));
    assert.throws(() => validateEtfMappingReviewRecord({
      ...baseRecord(),
      order: { side: 'buy' }
    }));
  });
});
