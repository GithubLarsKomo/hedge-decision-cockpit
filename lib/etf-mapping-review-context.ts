import { createHash } from 'node:crypto';
import {
  compareEtfMappingVersions,
  computeEtfMappingVersionComparisonFingerprint,
  type EtfMappingVersionComparison
} from './etf-mapping-version-comparison';
import {
  evaluateEtfMappingReviewStatus,
  type EtfMappingReviewPolicy,
  type EtfMappingReviewStatus
} from './etf-mapping-review-status';
import {
  listEtfMappingReviewHistory,
  type EtfMappingReviewHistoryEntry
} from './etf-mapping-review-history';

export type EtfMappingReviewHistorySummary = {
  record_fingerprint: string;
  outcome: string;
  reviewer: string;
  reviewed_at: string;
  rationale: string;
  candidate_mapping?: {
    mapping_version: string;
    mapping_fingerprint: string;
  };
};

export type EtfMappingReviewContext = {
  schema_version: 'etf-mapping-review-context/1.0';
  current_mapping: {
    mapping_version: string;
    mapping_fingerprint: string;
  };
  review_status: EtfMappingReviewStatus;
  candidate_mapping?: {
    mapping_version: string;
    mapping_fingerprint: string;
  };
  comparison?: EtfMappingVersionComparison;
  comparison_fingerprint?: string;
  prior_reviews: EtfMappingReviewHistorySummary[];
};

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

function summarizeHistory(entry: EtfMappingReviewHistoryEntry): EtfMappingReviewHistorySummary {
  return {
    record_fingerprint: entry.recordFingerprint,
    outcome: entry.outcome,
    reviewer: entry.reviewer,
    reviewed_at: entry.reviewedAt.toISOString(),
    rationale: entry.rationale,
    ...(entry.candidateMappingVersion && entry.candidateMappingFingerprint
      ? {
          candidate_mapping: {
            mapping_version: entry.candidateMappingVersion,
            mapping_fingerprint: entry.candidateMappingFingerprint
          }
        }
      : {})
  };
}

export async function prepareEtfMappingReviewContext(
  currentMapping: unknown,
  candidateMapping: unknown | undefined,
  asOf: string,
  policy: EtfMappingReviewPolicy
): Promise<EtfMappingReviewContext> {
  const reviewStatus = evaluateEtfMappingReviewStatus(currentMapping, asOf, policy);
  const history = await listEtfMappingReviewHistory(reviewStatus.mapping_fingerprint);

  if (candidateMapping === undefined) {
    return {
      schema_version: 'etf-mapping-review-context/1.0',
      current_mapping: {
        mapping_version: reviewStatus.mapping_version,
        mapping_fingerprint: reviewStatus.mapping_fingerprint
      },
      review_status: reviewStatus,
      prior_reviews: history.map(summarizeHistory)
    };
  }

  const comparison = compareEtfMappingVersions(currentMapping, candidateMapping);
  if (comparison.previous_mapping_fingerprint !== reviewStatus.mapping_fingerprint) {
    throw new Error('Mapping comparison previous identity must match the current review mapping.');
  }

  return {
    schema_version: 'etf-mapping-review-context/1.0',
    current_mapping: {
      mapping_version: comparison.previous_mapping_version,
      mapping_fingerprint: comparison.previous_mapping_fingerprint
    },
    review_status: reviewStatus,
    candidate_mapping: {
      mapping_version: comparison.next_mapping_version,
      mapping_fingerprint: comparison.next_mapping_fingerprint
    },
    comparison,
    comparison_fingerprint: computeEtfMappingVersionComparisonFingerprint(comparison),
    prior_reviews: history.map(summarizeHistory)
  };
}

export function canonicalizeEtfMappingReviewContext(value: EtfMappingReviewContext): string {
  return JSON.stringify(sortJson(value as unknown as JsonValue));
}

export function computeEtfMappingReviewContextFingerprint(value: EtfMappingReviewContext): string {
  return `sha256:${createHash('sha256')
    .update(canonicalizeEtfMappingReviewContext(value), 'utf8')
    .digest('hex')}`;
}
