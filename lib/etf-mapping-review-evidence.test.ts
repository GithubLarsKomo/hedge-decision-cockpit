import test from 'node:test';
import assert from 'node:assert/strict';
import {
  computeEtfMappingReviewEvidenceFingerprint,
  validateEtfMappingReviewEvidence
} from './etf-mapping-review-evidence';

const current = { mapping_version: '2026-08', mapping_fingerprint: `sha256:${'1'.repeat(64)}` };
const candidate = { mapping_version: '2026-09', mapping_fingerprint: `sha256:${'2'.repeat(64)}` };
const comparison = {
  schema_version: 'etf-mapping-version-comparison/1.0' as const,
  previous_mapping_version: current.mapping_version,
  previous_mapping_fingerprint: current.mapping_fingerprint,
  next_mapping_version: candidate.mapping_version,
  next_mapping_fingerprint: candidate.mapping_fingerprint,
  exposures: []
};

function evidence(outcome: 'keep_current' | 'accept_replacement' | 'defer' = 'accept_replacement') {
  return {
    schema_version: 'etf-mapping-review-evidence/1.0' as const,
    review_record: {
      schema_version: 'etf-mapping-review-record/1.0' as const,
      current_mapping: current,
      candidate_mapping: candidate,
      outcome,
      reviewer: 'lars',
      reviewed_at: '2026-08-02T16:00:00+00:00',
      rationale: 'Reviewed deterministic comparison evidence.'
    },
    comparison
  };
}

test('binds a matching accepted replacement to comparison evidence', () => {
  const parsed = validateEtfMappingReviewEvidence(evidence());
  assert.equal(parsed.review_record.outcome, 'accept_replacement');
  assert.equal(parsed.comparison.next_mapping_fingerprint, candidate.mapping_fingerprint);
});

test('rejects mismatched current mapping identity', () => {
  const value = evidence();
  value.review_record.current_mapping = {
    mapping_version: 'wrong',
    mapping_fingerprint: `sha256:${'3'.repeat(64)}`
  };
  assert.throws(() => validateEtfMappingReviewEvidence(value), /current_mapping/);
});

test('rejects mismatched candidate mapping identity', () => {
  const value = evidence();
  value.review_record.candidate_mapping = {
    mapping_version: 'wrong',
    mapping_fingerprint: `sha256:${'4'.repeat(64)}`
  };
  assert.throws(() => validateEtfMappingReviewEvidence(value), /candidate_mapping/);
});

test('produces a deterministic fingerprint', () => {
  const first = computeEtfMappingReviewEvidenceFingerprint(evidence('defer'));
  const second = computeEtfMappingReviewEvidenceFingerprint(evidence('defer'));
  assert.equal(first, second);
  assert.match(first, /^sha256:[a-f0-9]{64}$/);
});
