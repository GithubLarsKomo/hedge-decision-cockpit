export type ApprovalDecision = 'APPROVED' | 'REJECTED';
export type ExecutionStatus = 'NOT_EXECUTED' | 'PARTIALLY_EXECUTED' | 'EXECUTED';

export type ExecutionAuditInput = {
  recommendationId: string;
  recommendedStrategy: string;
  recommendedContracts: number;
  decidedAt: string;
  approval: {
    decision: ApprovalDecision;
    actorId: string;
    recordedAt: string;
    reason?: string;
  };
  execution: {
    status: ExecutionStatus;
    actorId?: string;
    recordedAt?: string;
    executedStrategy?: string;
    executedContracts?: number;
    averagePrice?: number;
    deviationReason?: string;
  };
};

export type ExecutionDeviation = {
  strategyChanged: boolean;
  contractQuantityChanged: boolean;
  notFullyExecuted: boolean;
  reason?: string;
};

export type ExecutionAuditRecord = ExecutionAuditInput & {
  deviation: ExecutionDeviation;
};

function assertNonEmpty(value: string, label: string) {
  if (!value.trim()) throw new Error(`${label} must not be empty.`);
}

function parseTimestamp(value: string, label: string) {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) throw new Error(`${label} must be a valid timestamp.`);
  return timestamp;
}

function assertWholeNonNegative(value: number, label: string) {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${label} must be a non-negative integer.`);
}

export function buildExecutionAuditRecord(input: ExecutionAuditInput): ExecutionAuditRecord {
  assertNonEmpty(input.recommendationId, 'recommendationId');
  assertNonEmpty(input.recommendedStrategy, 'recommendedStrategy');
  assertWholeNonNegative(input.recommendedContracts, 'recommendedContracts');
  assertNonEmpty(input.approval.actorId, 'approval.actorId');

  const decidedAt = parseTimestamp(input.decidedAt, 'decidedAt');
  const approvedAt = parseTimestamp(input.approval.recordedAt, 'approval.recordedAt');
  if (approvedAt < decidedAt) throw new Error('Approval must not precede the recommendation decision.');

  if (input.approval.decision === 'REJECTED' && !input.approval.reason?.trim()) {
    throw new Error('Rejected recommendations require an approval reason.');
  }

  const execution = input.execution;
  const hasExecutionDetails =
    execution.actorId !== undefined ||
    execution.recordedAt !== undefined ||
    execution.executedStrategy !== undefined ||
    execution.executedContracts !== undefined ||
    execution.averagePrice !== undefined;

  if (input.approval.decision === 'REJECTED' && execution.status !== 'NOT_EXECUTED') {
    throw new Error('Rejected recommendations cannot be recorded as executed.');
  }

  if (execution.status === 'NOT_EXECUTED') {
    if (hasExecutionDetails) throw new Error('NOT_EXECUTED records must not contain execution details.');
  } else {
    assertNonEmpty(execution.actorId ?? '', 'execution.actorId');
    const executedAt = parseTimestamp(execution.recordedAt ?? '', 'execution.recordedAt');
    if (executedAt < approvedAt) throw new Error('Execution must not precede approval.');
    assertNonEmpty(execution.executedStrategy ?? '', 'execution.executedStrategy');
    assertWholeNonNegative(execution.executedContracts ?? -1, 'execution.executedContracts');
    if ((execution.executedContracts ?? 0) === 0) throw new Error('Executed contract quantity must be greater than zero.');
    if (!Number.isFinite(execution.averagePrice) || (execution.averagePrice ?? 0) < 0) {
      throw new Error('execution.averagePrice must be a finite non-negative number.');
    }
  }

  const strategyChanged = execution.status !== 'NOT_EXECUTED' && execution.executedStrategy !== input.recommendedStrategy;
  const contractQuantityChanged = execution.status !== 'NOT_EXECUTED' && execution.executedContracts !== input.recommendedContracts;
  const notFullyExecuted = execution.status !== 'EXECUTED';
  const hasDeviation = strategyChanged || contractQuantityChanged || notFullyExecuted;

  if (hasDeviation && !execution.deviationReason?.trim()) {
    throw new Error('Execution deviations require a deviation reason.');
  }

  return {
    ...input,
    deviation: {
      strategyChanged,
      contractQuantityChanged,
      notFullyExecuted,
      reason: execution.deviationReason?.trim() || undefined
    }
  };
}
