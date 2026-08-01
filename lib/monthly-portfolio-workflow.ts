import { applyEtfNearestNeighbourMapping } from './etf-nearest-neighbour-mapping';
import { applyGpoTargetAllocation } from './gpo-target-allocation';
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

export type MonthlyPortfolioWorkflowPreprocessing = {
  gpoTargetAllocation?: unknown;
  etfMapping?: unknown;
};

export async function runMonthlyPortfolioWorkflow(
  input: MonthlyPortfolioInput,
  hedgeContext?: HedgeContext,
  preprocessing?: MonthlyPortfolioWorkflowPreprocessing
): Promise<MonthlyPortfolioWorkflowResult> {
  let preparedInput = input;

  if (preprocessing?.gpoTargetAllocation !== undefined) {
    preparedInput = applyGpoTargetAllocation(preparedInput, preprocessing.gpoTargetAllocation);
  }
  if (preprocessing?.etfMapping !== undefined) {
    preparedInput = applyEtfNearestNeighbourMapping(preparedInput, preprocessing.etfMapping);
  }

  const snapshot = generatePortfolioSnapshot(preparedInput);
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
