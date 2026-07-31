export type AuditHistoryFilter = {
  approval: 'ALL' | 'APPROVED' | 'REJECTED';
  execution: 'ALL' | 'NOT_EXECUTED' | 'PARTIALLY_EXECUTED' | 'EXECUTED';
  deviation: 'ALL' | 'WITH_DEVIATION' | 'WITHOUT_DEVIATION';
};

export type AuditDecision = {
  executionAudit: null | {
    approvalDecision: string;
    executionStatus: string;
    strategyChanged: boolean;
    contractQuantityChanged: boolean;
    notFullyExecuted: boolean;
  };
};

export function hasExecutionDeviation(decision: AuditDecision): boolean {
  const audit = decision.executionAudit;
  return Boolean(audit && (audit.strategyChanged || audit.contractQuantityChanged || audit.notFullyExecuted));
}

export function filterExecutionAuditHistory<T extends AuditDecision>(decisions: T[], filter: AuditHistoryFilter): T[] {
  return decisions.filter((decision) => {
    const audit = decision.executionAudit;
    if (!audit) return false;
    if (filter.approval !== 'ALL' && audit.approvalDecision !== filter.approval) return false;
    if (filter.execution !== 'ALL' && audit.executionStatus !== filter.execution) return false;
    const deviates = hasExecutionDeviation(decision);
    if (filter.deviation === 'WITH_DEVIATION' && !deviates) return false;
    if (filter.deviation === 'WITHOUT_DEVIATION' && deviates) return false;
    return true;
  });
}
