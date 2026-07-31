import type { DecisionRow } from '@/components/Dashboard';
import { hasExecutionDeviation } from './execution-audit-history-filter';

const columns = [
  'decisionId',
  'decisionCreatedAt',
  'approvalDecision',
  'approvalRecordedAt',
  'executionStatus',
  'executionRecordedAt',
  'recommendedStrategy',
  'recommendedContracts',
  'executedStrategy',
  'executedContracts',
  'hasDeviation',
  'deviationReason'
] as const;

function csvCell(value: string | number | boolean | null | undefined) {
  const text = value === null || value === undefined ? '' : String(value);
  return `"${text.replaceAll('"', '""')}"`;
}

export function buildExecutionAuditCsv(decisions: DecisionRow[]) {
  const audited = decisions.filter(decision => decision.executionAudit !== null);
  const rows = audited.map(decision => {
    const audit = decision.executionAudit!;
    return [
      decision.id,
      decision.createdAt,
      audit.approvalDecision,
      audit.approvalRecordedAt,
      audit.executionStatus,
      audit.executionRecordedAt,
      audit.recommendedStrategy,
      audit.recommendedContracts,
      audit.executedStrategy,
      audit.executedContracts,
      hasExecutionDeviation(decision),
      audit.deviationReason
    ].map(csvCell).join(',');
  });

  return ['\uFEFF' + columns.map(csvCell).join(','), ...rows].join('\n');
}
