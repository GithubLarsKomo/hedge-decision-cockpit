import { importPortfolioSnapshot, type ImportedPortfolioSnapshotRecord } from './imported-portfolio-snapshot';
import { computeMonthlyPortfolioAllocation, type PortfolioAllocationResult } from './portfolio-allocation';
import {
  buildPortfolioDecisionVariants,
  type HedgeContext,
  type PortfolioDecisionVariantsResult
} from './portfolio-decision-variants';
import { generatePortfolioSnapshot, type MonthlyPortfolioInput } from './portfolio-snapshot-generator';
import type { PortfolioSnapshot } from './portfolio-snapshot';

export type MonthlyPortfolioWorkflowResult = {
  snapshot: PortfolioSnapshot;
  import: ImportedPortfolioSnapshotRecord;
  allocation: PortfolioAllocationResult;
  decisionVariants: PortfolioDecisionVariantsResult;
};

export async function runMonthlyPortfolioWorkflow(
  input: MonthlyPortfolioInput,
  hedgeContext?: HedgeContext
): Promise<MonthlyPortfolioWorkflowResult> {
  const snapshot = generatePortfolioSnapshot(input);
  const imported = await importPortfolioSnapshot(snapshot);
  const allocation = computeMonthlyPortfolioAllocation(snapshot);
  const decisionVariants = buildPortfolioDecisionVariants(snapshot, allocation, hedgeContext);

  return {
    snapshot,
    import: imported,
    allocation,
    decisionVariants
  };
}
