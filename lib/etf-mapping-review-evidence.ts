import { createHash } from 'node:crypto';
import { z } from 'zod';
import { validateEtfMappingReviewRecord, type EtfMappingReviewRecord } from './etf-mapping-review-record';

const fingerprintPattern = /^sha256:[a-f0-9]{64}$/;

const exposureComparisonSchema = z.object({
  exposure_id: z.string().min(1),
  change: z.enum(['unchanged', 'added', 'removed', 'purchase_instrument_changed', 'candidate_set_changed']),
  previous_selected_instrument_id: z.string().min(1).optional(),
  next_selected_instrument_id: z.string().min(1).optional(),
  candidate_instruments_added: z.array(z.string().min(1)),
  candidate_instruments_removed: z.array(z.string().min(1)),
  candidate_instruments_changed: z.array(z.string().min(1))
}).strict();

const comparisonSchema = z.object({
  schema_version: z.literal('etf-mapping-version-comparison/1.0'),
  previous_mapping_version: z.string().min(1),
  previous_mapping_fingerprint: z.string().regex(fingerprintPattern),
  next_mapping_version: z.string().min(1),
  next_mapping_fingerprint: z.string().regex(fingerprintPattern),
  exposures: z.array(exposureComparisonSchema)
}).strict();

export const etfMappingReviewEvidenceSchema = z.object({
  schema_version: z.literal('etf-mapping-review-evidence/1.0'),
  review_record: z.unknown(),
  comparison: comparisonSchema
}).strict();

export type EtfMappingReviewEvidence = {
  schema_version: 'etf-mapping-review-evidence/1.0';
  review_record: EtfMappingReviewRecord;
  comparison: z.infer<typeof comparisonSchema>;
};

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function sortJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, child]) => [key, sortJson(child)]));
  }
  return value;
}

function sameIdentity(
  version: string,
  fingerprint: string,
  identity: { mapping_version: string; mapping_fingerprint: string }
) {
  return version === identity.mapping_version && fingerprint === identity.mapping_fingerprint;
}

export function validateEtfMappingReviewEvidence(value: unknown): EtfMappingReviewEvidence {
  const parsed = etfMappingReviewEvidenceSchema.parse(value);
  const review = validateEtfMappingReviewRecord(parsed.review_record);
  const comparison = parsed.comparison;

  if (!sameIdentity(
    comparison.previous_mapping_version,
    comparison.previous_mapping_fingerprint,
    review.current_mapping
  )) {
    throw new Error('Review current_mapping must match comparison previous mapping identity.');
  }

  if (review.candidate_mapping && !sameIdentity(
    comparison.next_mapping_version,
    comparison.next_mapping_fingerprint,
    review.candidate_mapping
  )) {
    throw new Error('Review candidate_mapping must match comparison next mapping identity.');
  }

  if (review.outcome === 'accept_replacement') {
    if (!review.candidate_mapping) throw new Error('accept_replacement requires candidate_mapping.');
    if (comparison.previous_mapping_fingerprint === comparison.next_mapping_fingerprint) {
      throw new Error('accept_replacement requires a changed mapping comparison.');
    }
  }

  return {
    schema_version: 'etf-mapping-review-evidence/1.0',
    review_record: review,
    comparison
  };
}

export function canonicalizeEtfMappingReviewEvidence(value: unknown): string {
  return JSON.stringify(sortJson(validateEtfMappingReviewEvidence(value) as unknown as JsonValue));
}

export function computeEtfMappingReviewEvidenceFingerprint(value: unknown): string {
  return `sha256:${createHash('sha256')
    .update(canonicalizeEtfMappingReviewEvidence(value), 'utf8')
    .digest('hex')}`;
}
