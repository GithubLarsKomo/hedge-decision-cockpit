import { buildPortfolioDecisionVariants, type HedgeContext, type PortfolioDecisionVariantsResult } from './portfolio-decision-variants';
import { runMonthlyPortfolioWorkflow, type MonthlyPortfolioWorkflowResult } from './monthly-portfolio-workflow';
import type { MonthlyPortfolioInput } from './portfolio-snapshot-generator';

export type MonthlyDecisionReport = MonthlyPortfolioWorkflowResult & {
  decisionVariants: PortfolioDecisionVariantsResult;
};

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value as Record<string, unknown>)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, stableValue(entry)])
    );
  }
  return value;
}

export async function buildMonthlyDecisionReport(
  input: MonthlyPortfolioInput,
  hedgeContext?: HedgeContext
): Promise<MonthlyDecisionReport> {
  const workflow = await runMonthlyPortfolioWorkflow(input);
  const decisionVariants = buildPortfolioDecisionVariants(
    workflow.snapshot,
    workflow.allocation,
    hedgeContext
  );

  return { ...workflow, decisionVariants };
}

export function stableSerializeMonthlyDecisionReport(value: MonthlyDecisionReport): string {
  return JSON.stringify(stableValue(value));
}
