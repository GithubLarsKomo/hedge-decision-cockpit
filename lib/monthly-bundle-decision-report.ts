import {
  buildMonthlyDecisionReport,
  stableSerializeMonthlyDecisionReport,
  type MonthlyDecisionReport
} from './monthly-decision-report';
import { listEtfMappingReviewHistory } from './etf-mapping-review-history';
import { prepareMonthlyPortfolioRunBundle } from './monthly-portfolio-run-bundle';

export type MonthlyBundleDecisionReport = MonthlyDecisionReport & {
  bundleFingerprint: string;
  etfMappingHumanReview?: {
    recordFingerprint: string;
    currentMappingVersion: string;
    currentMappingFingerprint: string;
    candidateMappingVersion: string | null;
    candidateMappingFingerprint: string | null;
    outcome: string;
    reviewer: string;
    reviewedAt: string;
    rationale: string;
  };
};

export async function buildMonthlyBundleDecisionReport(
  bundle: unknown
): Promise<MonthlyBundleDecisionReport> {
  const prepared = prepareMonthlyPortfolioRunBundle(bundle);
  const report = await buildMonthlyDecisionReport(
    prepared.input,
    prepared.hedgeContext,
    prepared.preprocessing
  );

  const mappingFingerprint = prepared.preprocessing?.etf_mapping
    ? report.provenance.etfMapping?.mapping_fingerprint
    : undefined;
  const latestReview = mappingFingerprint
    ? (await listEtfMappingReviewHistory(mappingFingerprint))[0]
    : undefined;

  return {
    ...report,
    bundleFingerprint: prepared.bundleFingerprint,
    ...(latestReview
      ? {
          etfMappingHumanReview: {
            recordFingerprint: latestReview.recordFingerprint,
            currentMappingVersion: latestReview.currentMappingVersion,
            currentMappingFingerprint: latestReview.currentMappingFingerprint,
            candidateMappingVersion: latestReview.candidateMappingVersion,
            candidateMappingFingerprint: latestReview.candidateMappingFingerprint,
            outcome: latestReview.outcome,
            reviewer: latestReview.reviewer,
            reviewedAt: latestReview.reviewedAt.toISOString(),
            rationale: latestReview.rationale
          }
        }
      : {})
  };
}

export function stableSerializeMonthlyBundleDecisionReport(
  report: MonthlyBundleDecisionReport
): string {
  return stableSerializeMonthlyDecisionReport(report);
}
