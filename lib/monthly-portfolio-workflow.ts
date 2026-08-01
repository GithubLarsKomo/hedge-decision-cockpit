import { importPortfolioSnapshot, type ImportedPortfolioSnapshotRecord } from './imported-portfolio-snapshot';
import { computeMonthlyPortfolioAllocation, type PortfolioAllocationResult } from './portfolio-allocation';
import { generatePortfolioSnapshot, type MonthlyPortfolioInput } from './portfolio-snapshot-generator';
import type { PortfolioSnapshot } from './portfolio-snapshot';

export type MonthlyPortfolioWorkflowResult = {
  snapshot: PortfolioSnapshot;
  import: ImportedPortfolioSnapshotRecord;
  allocation: PortfolioAllocationResult;
};

export async function runMonthlyPortfolioWorkflow(
  input: MonthlyPortfolioInput
): Promise<MonthlyPortfolioWorkflowResult> {
  const snapshot = generatePortfolioSnapshot(input);
  const imported = await importPortfolioSnapshot(snapshot);
  const allocation = computeMonthlyPortfolioAllocation(snapshot);

  return {
    snapshot,
    import: imported,
    allocation
  };
}
