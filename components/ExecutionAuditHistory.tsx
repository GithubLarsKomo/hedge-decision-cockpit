import type { DecisionRow } from './Dashboard';

function formatDate(value: string | null) {
  if (!value) return '—';
  return new Intl.DateTimeFormat('de-DE', {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

export default function ExecutionAuditHistory({ decisions }: { decisions: DecisionRow[] }) {
  const audited = decisions.filter(decision => decision.executionAudit !== null);

  return (
    <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">Governance</p>
          <h2 className="mt-1 text-xl font-semibold text-slate-950">Freigabe- und Ausführungshistorie</h2>
        </div>
        <p className="text-sm text-slate-500">{audited.length} von {decisions.length} Entscheidungen dokumentiert</p>
      </div>

      {audited.length === 0 ? (
        <p className="mt-4 text-sm text-slate-600">Noch keine Freigabe- oder Ausführungsnachweise vorhanden.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead>
              <tr className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                <th className="px-3 py-2">Decision</th>
                <th className="px-3 py-2">Freigabe</th>
                <th className="px-3 py-2">Ausführung</th>
                <th className="px-3 py-2">Strategie / Kontrakte</th>
                <th className="px-3 py-2">Abweichung</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {audited.map(decision => {
                const audit = decision.executionAudit!;
                const hasDeviation = audit.strategyChanged || audit.contractQuantityChanged || audit.notFullyExecuted;

                return (
                  <tr key={decision.id} className="align-top text-slate-700">
                    <td className="px-3 py-3 font-medium text-slate-950">#{decision.id}</td>
                    <td className="px-3 py-3">
                      <div>{audit.approvalDecision}</div>
                      <div className="text-xs text-slate-500">{formatDate(audit.approvalRecordedAt)}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div>{audit.executionStatus}</div>
                      <div className="text-xs text-slate-500">{formatDate(audit.executionRecordedAt)}</div>
                    </td>
                    <td className="px-3 py-3">
                      <div>{audit.executedStrategy ?? audit.recommendedStrategy}</div>
                      <div className="text-xs text-slate-500">
                        {audit.executedContracts ?? 0} / {audit.recommendedContracts}
                      </div>
                    </td>
                    <td className="px-3 py-3">
                      <span className={hasDeviation ? 'font-medium text-amber-700' : 'text-emerald-700'}>
                        {hasDeviation ? 'Ja' : 'Nein'}
                      </span>
                      {audit.deviationReason && <div className="mt-1 max-w-xs text-xs text-slate-500">{audit.deviationReason}</div>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
