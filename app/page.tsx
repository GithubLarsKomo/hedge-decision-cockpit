import { prisma } from '@/lib/prisma';
import Dashboard, { type DecisionRow } from '@/components/Dashboard';

export const dynamic = 'force-dynamic';

export default async function Home() {
  let decisions: DecisionRow[] = [];

  try {
    const rows = await prisma.decision.findMany({
      include: { executionAuditRecord: true },
      orderBy: { createdAt: 'desc' },
      take: 250
    });

    decisions = rows.map(d => ({
      id: d.id,
      createdAt: d.createdAt.toISOString(),
      ndxNow: d.ndxNow,
      ndxHigh2y: d.ndxHigh2y,
      ndxDrawdownPct: d.ndxDrawdownPct,
      vixNow: d.vixNow,
      vixPercentile: d.vixPercentile,
      action: d.action,
      severity: d.severity,
      recommendation: d.recommendation,
      hedgeMarketValueEur: d.hedgeMarketValueEur?.toNumber() ?? null,
      hedgeUnrealizedGainEur: d.hedgeUnrealizedGainEur?.toNumber() ?? null,
      notes: d.notes,
      executionAudit: d.executionAuditRecord ? {
        approvalDecision: d.executionAuditRecord.approvalDecision,
        approvalRecordedAt: d.executionAuditRecord.approvalRecordedAt.toISOString(),
        executionStatus: d.executionAuditRecord.executionStatus,
        executionRecordedAt: d.executionAuditRecord.executionRecordedAt?.toISOString() ?? null,
        recommendedStrategy: d.executionAuditRecord.recommendedStrategy,
        recommendedContracts: d.executionAuditRecord.recommendedContracts,
        executedStrategy: d.executionAuditRecord.executedStrategy,
        executedContracts: d.executionAuditRecord.executedContracts,
        strategyChanged: d.executionAuditRecord.strategyChanged,
        contractQuantityChanged: d.executionAuditRecord.contractQuantityChanged,
        notFullyExecuted: d.executionAuditRecord.notFullyExecuted,
        deviationReason: d.executionAuditRecord.deviationReason
      } : null
    }));
  } catch (error) {
    console.error('Could not load decision history', error);
  }

  return <Dashboard decisions={decisions} />;
}
