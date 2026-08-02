import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  computeGpoTargetAllocationFingerprint,
  validateGpoTargetAllocation
} from './gpo-target-allocation';
import type { MonthlyPortfolioInput } from './portfolio-snapshot-generator';

const sha256Pattern = /^sha256:[a-f0-9]{64}$/;
const bareSha256Pattern = /^[a-f0-9]{64}$/;

export const gpoSourceEvidenceSchema = z.object({
  schema_version: z.literal('gpo-source-evidence/1.0'),
  source_id: z.string().min(1),
  source_type: z.enum(['official_publication', 'fund_report', 'manual_record', 'other']),
  locator: z.string().min(1),
  observed_at: z.string().datetime({ offset: true }),
  retrieved_at: z.string().datetime({ offset: true }),
  extraction_method: z.enum(['manual', 'structured', 'document_extraction']),
  content_sha256: z.string().regex(sha256Pattern),
  supported_allocation_fingerprint: z.string().regex(bareSha256Pattern),
  notes: z.string().min(1).optional()
}).strict().superRefine((value, context) => {
  if (Date.parse(value.retrieved_at) < Date.parse(value.observed_at)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['retrieved_at'],
      message: 'retrieved_at must not be earlier than observed_at.'
    });
  }
});

export type GpoSourceEvidence = z.infer<typeof gpoSourceEvidenceSchema>;

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

export function validateGpoSourceEvidence(value: unknown): GpoSourceEvidence {
  return gpoSourceEvidenceSchema.parse(value);
}

export function canonicalizeGpoSourceEvidence(value: unknown): string {
  const evidence = validateGpoSourceEvidence(value);
  return JSON.stringify(sortJson(evidence as JsonValue));
}

export function computeGpoSourceEvidenceFingerprint(value: unknown): string {
  return createHash('sha256')
    .update(canonicalizeGpoSourceEvidence(value), 'utf8')
    .digest('hex');
}

export function bindGpoSourceEvidence(
  input: MonthlyPortfolioInput,
  allocationValue: unknown,
  evidenceValue: unknown
): MonthlyPortfolioInput {
  const allocation = validateGpoTargetAllocation(allocationValue);
  const evidence = validateGpoSourceEvidence(evidenceValue);
  const allocationFingerprint = computeGpoTargetAllocationFingerprint(allocation);

  if (evidence.supported_allocation_fingerprint !== allocationFingerprint) {
    throw new Error('GPO source evidence does not match target allocation fingerprint.');
  }

  const evidenceFingerprint = computeGpoSourceEvidenceFingerprint(evidence);
  const sourceFingerprint = `gpo-source-evidence:${evidenceFingerprint}`;

  return {
    ...input,
    source_fingerprints: input.source_fingerprints.includes(sourceFingerprint)
      ? [...input.source_fingerprints]
      : [...input.source_fingerprints, sourceFingerprint]
  };
}
