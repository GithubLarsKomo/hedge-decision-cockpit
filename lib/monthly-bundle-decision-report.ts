import {
  buildMonthlyDecisionReport,
  stableSerializeMonthlyDecisionReport,
  type MonthlyDecisionReport
} from './monthly-decision-report';
import { listEtfMappingReviewHistory } from './etf-mapping-review-history';
import { computeEtfMappingFingerprint } from './etf-nearest-neighbour-mapping';
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

  const mappingFingerprint = computeEtfMappingFingerprint(prepared.preprocessing.etfMapping);
  const latestReview = (await listEtfMappingReviewHistory(mappingFingerprint))[0];

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
