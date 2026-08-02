import { z } from 'zod';
import {
  computeEtfMappingReviewContextFingerprint,
  type EtfMappingReviewContext
} from './etf-mapping-review-context';
import {
  computeEtfMappingReviewRecordFingerprint,
  validateEtfMappingReviewRecord,
  type EtfMappingReviewRecord
} from './etf-mapping-review-record';
import {
  computeEtfMappingReviewEvidenceFingerprint,
  validateEtfMappingReviewEvidence
} from './etf-mapping-review-evidence';
import {
  listEtfMappingReviewHistory,
  persistEtfMappingReviewRecord,
  type EtfMappingReviewHistoryEntry
} from './etf-mapping-review-history';
import { computeEtfMappingVersionComparisonFingerprint } from './etf-mapping-version-comparison';

const fingerprintPattern = /^sha256:[a-f0-9]{64}$/;

const decisionSchema = z.object({
  context_fingerprint: z.string().regex(fingerprintPattern),
  outcome: z.enum(['keep_current', 'accept_replacement', 'defer']),
  reviewer: z.string().trim().min(1),
  reviewed_at: z.string().datetime({ offset: true }),
  rationale: z.string().trim().min(1)
}).strict();

export type EtfMappingReviewDecisionInput = z.infer<typeof decisionSchema>;

export type EtfMappingReviewDecisionResult = {
  schema_version: 'etf-mapping-review-decision-result/1.0';
  context_fingerprint: string;
  record_fingerprint: string;
  review_evidence_fingerprint?: string;
  persistence: {
    id: number;
    created: boolean;
  };
  history: EtfMappingReviewHistoryEntry[];
};

function assertContextConsistency(context: EtfMappingReviewContext): void {
  if (context.schema_version !== 'etf-mapping-review-context/1.0') {
    throw new Error('Unsupported ETF mapping review context schema version.');
  }

  if (
    context.current_mapping.mapping_version !== context.review_status.mapping_version ||
    context.current_mapping.mapping_fingerprint !== context.review_status.mapping_fingerprint
  ) {
    throw new Error('Review context current mapping identity is inconsistent with review status.');
  }

  const hasCandidate = context.candidate_mapping !== undefined;
  const hasComparison = context.comparison !== undefined;
  const hasComparisonFingerprint = context.comparison_fingerprint !== undefined;
  if (hasCandidate !== hasComparison || hasComparison !== hasComparisonFingerprint) {
    throw new Error('Review context candidate, comparison, and comparison fingerprint must be present together.');
  }

  if (context.comparison && context.candidate_mapping && context.comparison_fingerprint) {
    if (
      context.comparison.previous_mapping_version !== context.current_mapping.mapping_version ||
      context.comparison.previous_mapping_fingerprint !== context.current_mapping.mapping_fingerprint
    ) {
      throw new Error('Review context comparison previous mapping does not match current mapping.');
    }
    if (
      context.comparison.next_mapping_version !== context.candidate_mapping.mapping_version ||
      context.comparison.next_mapping_fingerprint !== context.candidate_mapping.mapping_fingerprint
    ) {
      throw new Error('Review context comparison next mapping does not match candidate mapping.');
    }
    const actualComparisonFingerprint = computeEtfMappingVersionComparisonFingerprint(context.comparison);
    if (actualComparisonFingerprint !== context.comparison_fingerprint) {
      throw new Error('Review context comparison fingerprint mismatch.');
    }
  }
}

export async function persistEtfMappingReviewDecisionFromContext(
  context: EtfMappingReviewContext,
  decisionValue: unknown
): Promise<EtfMappingReviewDecisionResult> {
  assertContextConsistency(context);
  const decision = decisionSchema.parse(decisionValue);
  const actualContextFingerprint = computeEtfMappingReviewContextFingerprint(context);
  if (decision.context_fingerprint !== actualContextFingerprint) {
    throw new Error('Review decision context fingerprint is stale or mismatched.');
  }

  if (decision.outcome === 'accept_replacement' && !context.candidate_mapping) {
    throw new Error('accept_replacement requires candidate comparison evidence in the review context.');
  }

  const record: EtfMappingReviewRecord = validateEtfMappingReviewRecord({
    schema_version: 'etf-mapping-review-record/1.0',
    current_mapping: context.current_mapping,
    ...(context.candidate_mapping ? { candidate_mapping: context.candidate_mapping } : {}),
    outcome: decision.outcome,
    reviewer: decision.reviewer,
    reviewed_at: decision.reviewed_at,
    rationale: decision.rationale
  });

  const recordFingerprint = computeEtfMappingReviewRecordFingerprint(record);
  let reviewEvidenceFingerprint: string | undefined;
  if (context.comparison) {
    const evidence = validateEtfMappingReviewEvidence({
      schema_version: 'etf-mapping-review-evidence/1.0',
      review_record: record,
      comparison: context.comparison
    });
    reviewEvidenceFingerprint = computeEtfMappingReviewEvidenceFingerprint(evidence);
  }

  const persisted = await persistEtfMappingReviewRecord(record);
  const history = await listEtfMappingReviewHistory(context.current_mapping.mapping_fingerprint);

  return {
    schema_version: 'etf-mapping-review-decision-result/1.0',
    context_fingerprint: actualContextFingerprint,
    record_fingerprint: recordFingerprint,
    ...(reviewEvidenceFingerprint ? { review_evidence_fingerprint: reviewEvidenceFingerprint } : {}),
    persistence: {
      id: persisted.id,
      created: persisted.created
    },
    history
  };
}
