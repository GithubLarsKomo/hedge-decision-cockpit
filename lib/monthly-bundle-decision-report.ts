import {
  buildMonthlyDecisionReport,
  stableSerializeMonthlyDecisionReport,
  type MonthlyDecisionReport
} from './monthly-decision-report';
import { prepareMonthlyPortfolioRunBundle } from './monthly-portfolio-run-bundle';

export type MonthlyBundleDecisionReport = MonthlyDecisionReport & {
  bundleFingerprint: string;
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

  return {
    ...report,
    bundleFingerprint: prepared.bundleFingerprint
  };
}

export function stableSerializeMonthlyBundleDecisionReport(
  report: MonthlyBundleDecisionReport
): string {
  return stableSerializeMonthlyDecisionReport(report);
}
