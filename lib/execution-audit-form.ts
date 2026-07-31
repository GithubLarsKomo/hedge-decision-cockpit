import type { ExecutionAuditRequest } from './execution-audit-schema';

export type ExecutionAuditFormValues = {
  recommendationId: string;
  recommendedStrategy: string;
  recommendedContracts: string;
  decidedAt: string;
  approvalDecision: 'APPROVED' | 'REJECTED';
  approvalActorId: string;
  approvalRecordedAt: string;
  approvalReason: string;
  executionStatus: 'NOT_EXECUTED' | 'PARTIALLY_EXECUTED' | 'EXECUTED';
  executionActorId: string;
  executionRecordedAt: string;
  executedStrategy: string;
  executedContracts: string;
  averagePrice: string;
  deviationReason: string;
};

function toIso(value: string, label: string) {
  const date = new Date(value);
  if (!Number.isFinite(date.getTime())) throw new Error(`${label} must be a valid date.`);
  return date.toISOString();
}

function toNonNegativeInteger(value: string, label: string) {
  const number = Number(value);
  if (!Number.isInteger(number) || number < 0) throw new Error(`${label} must be a non-negative integer.`);
  return number;
}

export function buildExecutionAuditRequest(values: ExecutionAuditFormValues): ExecutionAuditRequest {
  const request: ExecutionAuditRequest = {
    recommendationId: values.recommendationId.trim(),
    recommendedStrategy: values.recommendedStrategy.trim(),
    recommendedContracts: toNonNegativeInteger(values.recommendedContracts, 'recommendedContracts'),
    decidedAt: toIso(values.decidedAt, 'decidedAt'),
    approval: {
      decision: values.approvalDecision,
      actorId: values.approvalActorId.trim(),
      recordedAt: toIso(values.approvalRecordedAt, 'approvalRecordedAt'),
      reason: values.approvalReason.trim() || undefined
    },
    execution: {
      status: values.executionStatus,
      deviationReason: values.deviationReason.trim() || undefined
    }
  };

  if (values.executionStatus !== 'NOT_EXECUTED') {
    request.execution.actorId = values.executionActorId.trim();
    request.execution.recordedAt = toIso(values.executionRecordedAt, 'executionRecordedAt');
    request.execution.executedStrategy = values.executedStrategy.trim();
    request.execution.executedContracts = toNonNegativeInteger(values.executedContracts, 'executedContracts');
    const averagePrice = Number(values.averagePrice);
    if (!Number.isFinite(averagePrice) || averagePrice < 0) throw new Error('averagePrice must be non-negative.');
    request.execution.averagePrice = averagePrice;
  }

  return request;
}
