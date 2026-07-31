import type { ExecutionAuditRecord } from './execution-audit-record';

export type ExecutionAuditPersistenceData = {
  decisionId: number;
  recommendationId: string;
  recommendedStrategy: string;
  recommendedContracts: number;
  decidedAt: Date;
  approvalDecision: string;
  approvalActorId: string;
  approvalRecordedAt: Date;
  approvalReason?: string;
  executionStatus: string;
  executionActorId?: string;
  executionRecordedAt?: Date;
  executedStrategy?: string;
  executedContracts?: number;
  averagePrice?: number;
  strategyChanged: boolean;
  contractQuantityChanged: boolean;
  notFullyExecuted: boolean;
  deviationReason?: string;
};

function requirePositiveDecisionId(decisionId: number) {
  if (!Number.isInteger(decisionId) || decisionId <= 0) {
    throw new Error('decisionId must be a positive integer.');
  }
}

export function mapExecutionAuditRecordToPersistence(
  decisionId: number,
  record: ExecutionAuditRecord
): ExecutionAuditPersistenceData {
  requirePositiveDecisionId(decisionId);

  return {
    decisionId,
    recommendationId: record.recommendationId,
    recommendedStrategy: record.recommendedStrategy,
    recommendedContracts: record.recommendedContracts,
    decidedAt: new Date(record.decidedAt),
    approvalDecision: record.approval.decision,
    approvalActorId: record.approval.actorId,
    approvalRecordedAt: new Date(record.approval.recordedAt),
    approvalReason: record.approval.reason,
    executionStatus: record.execution.status,
    executionActorId: record.execution.actorId,
    executionRecordedAt: record.execution.recordedAt ? new Date(record.execution.recordedAt) : undefined,
    executedStrategy: record.execution.executedStrategy,
    executedContracts: record.execution.executedContracts,
    averagePrice: record.execution.averagePrice,
    strategyChanged: record.deviation.strategyChanged,
    contractQuantityChanged: record.deviation.contractQuantityChanged,
    notFullyExecuted: record.deviation.notFullyExecuted,
    deviationReason: record.deviation.reason
  };
}