import { createHash } from 'node:crypto';
import { z } from 'zod';

const fingerprintPattern = /^sha256:[a-f0-9]{64}$/;

const mappingIdentitySchema = z.object({
  mapping_version: z.string().min(1),
  mapping_fingerprint: z.string().regex(fingerprintPattern)
}).strict();

export const etfMappingReviewRecordSchema = z.object({
  schema_version: z.literal('etf-mapping-review-record/1.0'),
  current_mapping: mappingIdentitySchema,
  candidate_mapping: mappingIdentitySchema.optional(),
  outcome: z.enum(['keep_current', 'accept_replacement', 'defer']),
  reviewer: z.string().trim().min(1),
  reviewed_at: z.string().datetime({ offset: true }),
  rationale: z.string().trim().min(1)
}).strict().superRefine((value, context) => {
  if (value.outcome === 'accept_replacement' && value.candidate_mapping === undefined) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['candidate_mapping'],
      message: 'candidate_mapping is required when outcome is accept_replacement.'
    });
  }

  if (
    value.outcome === 'accept_replacement' &&
    value.candidate_mapping?.mapping_fingerprint === value.current_mapping.mapping_fingerprint
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['candidate_mapping', 'mapping_fingerprint'],
      message: 'accept_replacement requires a candidate mapping with a different fingerprint.'
    });
  }
});

export type EtfMappingReviewRecord = z.infer<typeof etfMappingReviewRecordSchema>;

type JsonValue = null | boolean | number | string | JsonValue[] | { [key: string]: JsonValue };

function sortJson(value: JsonValue): JsonValue {
  if (Array.isArray(value)) return value.map(sortJson);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, child]) => [key, sortJson(child)])
    );
  }
  return value;
}

export function validateEtfMappingReviewRecord(value: unknown): EtfMappingReviewRecord {
  return etfMappingReviewRecordSchema.parse(value);
}

export function canonicalizeEtfMappingReviewRecord(value: unknown): string {
  const record = validateEtfMappingReviewRecord(value);
  return JSON.stringify(sortJson(record as JsonValue));
}

export function computeEtfMappingReviewRecordFingerprint(value: unknown): string {
  return `sha256:${createHash('sha256')
    .update(canonicalizeEtfMappingReviewRecord(value), 'utf8')
    .digest('hex')}`;
}
