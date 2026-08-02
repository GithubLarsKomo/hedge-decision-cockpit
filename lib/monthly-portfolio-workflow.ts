import { evaluateEtfMappingReviewStatus, type EtfMappingReviewPolicy, type EtfMappingReviewStatus } from './etf-mapping-review-status';
import { applyEtfNearestNeighbourMapping } from './etf-nearest-neighbour-mapping';
import { bindGpoSourceEvidence, computeGpoSourceEvidenceFingerprint } from './gpo-source-evidence';
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

export type MonthlyPortfolioWorkflowProvenance = {
  gpoSourceEvidenceFingerprint?: string;
  etfMappingReview?: EtfMappingReviewStatus;
};

export type MonthlyPortfolioWorkflowResult = {
  snapshot: PortfolioSnapshot;
  import: ImportedPortfolioSnapshotRecord;
  allocation: PortfolioAllocationResult;
  decisionVariants: PortfolioDecisionVariantsResult;
  provenance: MonthlyPortfolioWorkflowProvenance;
};

export type MonthlyPortfolioWorkflowPreprocessing = {
  gpoTargetAllocation?: unknown;
  gpoSourceEvidence?: unknown;
  etfMapping?: unknown;
  etfMappingReview?: {
    as_of: string;
    policy: EtfMappingReviewPolicy;
  };
};

export async function runMonthlyPortfolioWorkflow(
  input: MonthlyPortfolioInput,
  hedgeContext?: HedgeContext,
  preprocessing?: MonthlyPortfolioWorkflowPreprocessing
): Promise<MonthlyPortfolioWorkflowResult> {
  if (preprocessing?.gpoSourceEvidence !== undefined && preprocessing.gpoTargetAllocation === undefined) {
    throw new Error('gpoSourceEvidence requires gpoTargetAllocation.');
  }
  if (preprocessing?.etfMappingReview !== undefined && preprocessing.etfMapping === undefined) {
    throw new Error('etfMappingReview requires etfMapping.');
  }

  let preparedInput = input;
  const provenance: MonthlyPortfolioWorkflowProvenance = {};

  if (preprocessing?.gpoTargetAllocation !== undefined) {
    preparedInput = applyGpoTargetAllocation(preparedInput, preprocessing.gpoTargetAllocation);
  }
  if (preprocessing?.gpoSourceEvidence !== undefined) {
    preparedInput = bindGpoSourceEvidence(
      preparedInput,
      preprocessing.gpoTargetAllocation,
      preprocessing.gpoSourceEvidence
    );
    provenance.gpoSourceEvidenceFingerprint = computeGpoSourceEvidenceFingerprint(
      preprocessing.gpoSourceEvidence
    );
  }
  if (preprocessing?.etfMapping !== undefined) {
    preparedInput = applyEtfNearestNeighbourMapping(preparedInput, preprocessing.etfMapping);
  }
  if (preprocessing?.etfMappingReview !== undefined) {
    provenance.etfMappingReview = evaluateEtfMappingReviewStatus(
      preprocessing.etfMapping,
      preprocessing.etfMappingReview.as_of,
      preprocessing.etfMappingReview.policy
    );
  }

  const snapshot = generatePortfolioSnapshot(preparedInput);
  const imported = await importPortfolioSnapshot(snapshot);
  const allocation = computeMonthlyPortfolioAllocation(snapshot);
  const decisionVariants = buildPortfolioDecisionVariants(snapshot, allocation, hedgeContext);

  return {
    snapshot,
    import: imported,
    allocation,
    decisionVariants,
    provenance
  };
}
