'use client';

import Link from 'next/link';
import DecisionCard from './DecisionCard';
import ExecutionAuditEvidenceVerifier from './ExecutionAuditEvidenceVerifier';
import ExecutionAuditForm from './ExecutionAuditForm';
import ExecutionAuditHistory from './ExecutionAuditHistory';
import HistoryChart from './HistoryChart';
import HistoryTable from './HistoryTable';

export type ExecutionAuditRow = {
  approvalDecision: string;
  approvalRecordedAt: string;
  executionStatus: string;
  executionRecordedAt: string | null;
  recommendedStrategy: string;
  recommendedContracts: number;
  executedStrategy: string | null;
  executedContracts: number | null;
  strategyChanged: boolean;
  contractQuantityChanged: boolean;
  notFullyExecuted: boolean;
  deviationReason: string | null;
};

export type DecisionRow = {
  id: number;
  createdAt: string;
  ndxNow: number;
  ndxHigh2y: number;
  ndxDrawdownPct: number;
  vixNow: number;
  vixPercentile: number;
  hedgeCoveragePercent: number | null;
  action: string;
  severity: string;
  recommendation: string;
  triggeredRules: string[];
  hedgeMarketValueEur: number | null;
  hedgeUnrealizedGainEur: number | null;
  notes: string | null;
  executionAudit: ExecutionAuditRow | null;
};

export default function Dashboard({ decisions }: { decisions: DecisionRow[] }) {
  const latest = decisions[0];
  const chronological = [...decisions].reverse();

  return (
    <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
      <header className="mb-8">
        <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Family Office Hedge Program</p>
        <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">NASDAQ Hedge Decision Cockpit</h1>
        <p className="mt-3 max-w-3xl text-slate-600">
          Regelbasiertes Dashboard für Tail-Risk-Hedges: Aufbau günstiger Puts, Halten in der Korrektur und Realisierung von Hedge-Gewinnen zur Finanzierung von Aktienkäufen im Crash.
        </p>
        <Link href="/strategy" className="mt-4 inline-flex rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50">
          Strategie für Einsteiger verstehen →
        </Link>
      </header>

      {latest ? <DecisionCard decision={latest} /> : (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-8 text-slate-600">
          Noch keine Daten. Sende den ersten POST aus n8n an <code>/api/decision</code>.
        </div>
      )}

      <ExecutionAuditForm defaultDecisionId={latest?.id} />
      <ExecutionAuditHistory decisions={decisions} />
      <ExecutionAuditEvidenceVerifier />

      {decisions.length > 0 && (
        <section className="mt-8 grid gap-6">
          <HistoryChart decisions={chronological} />
          <HistoryTable decisions={decisions} />
        </section>
      )}
    </main>
  );
}
