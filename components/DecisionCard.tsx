import type { DecisionRow } from './Dashboard';
import {
  VIX_EXPENSIVE_OVERLAY,
  hasExpensiveVixOverlay,
  strategyToneStyleForAction
} from './strategy-presentation';
import { actionLabel, explainDecisionForBeginner } from '@/lib/strategy-explanation';

function fmt(n: number, digits = 2) {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
}

export default function DecisionCard({ decision }: { decision: DecisionRow }) {
  const explanation = explainDecisionForBeginner({
    drawdownPercent: decision.ndxDrawdownPct,
    vixPercentile: decision.vixPercentile,
    hedgeCoveragePercent: decision.hedgeCoveragePercent,
    action: decision.action
  });
  const presentation = strategyToneStyleForAction(decision.action);
  const vixOverlay = hasExpensiveVixOverlay(decision.triggeredRules);

  return (
    <section className={`rounded-2xl border-l-8 p-6 shadow-sm ${presentation?.cardClass ?? 'border-slate-400 bg-white'}`}>
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-sm text-slate-500">Letztes Signal · {new Date(decision.createdAt).toLocaleString('de-DE')}</p>
          <h2 className="mt-2 text-2xl font-bold text-slate-950">{actionLabel(decision.action)}</h2>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-slate-500">{decision.action}</p>
          <p className="mt-3 max-w-4xl text-slate-700">{decision.recommendation}</p>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <span className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-wide ${presentation?.badgeClass ?? 'bg-slate-100 text-slate-700'}`}>
            Strategiestufe {presentation?.label ?? decision.severity}
          </span>
          {vixOverlay && (
            <span className={`rounded-full px-3 py-2 text-xs font-semibold uppercase tracking-wide ${VIX_EXPENSIVE_OVERLAY.badgeClass}`}>
              {VIX_EXPENSIVE_OVERLAY.label}
            </span>
          )}
        </div>
      </div>

      <dl className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Metric label="NDX aktuell" value={fmt(decision.ndxNow)} />
        <Metric label="2J-Hoch" value={fmt(decision.ndxHigh2y)} />
        <Metric label="Drawdown" value={`${fmt(decision.ndxDrawdownPct)} %`} />
        <Metric label="VIX / Perzentil" value={`${fmt(decision.vixNow)} / ${fmt(decision.vixPercentile)} %`} />
        <Metric label="Hedge-Abdeckung" value={decision.hedgeCoveragePercent == null ? 'unbekannt' : `${fmt(decision.hedgeCoveragePercent, 1)} %`} />
      </dl>

      {vixOverlay && (
        <div className={`mt-5 rounded-xl border p-4 text-sm ${VIX_EXPENSIVE_OVERLAY.cardClass}`}>
          <strong>Volatilitäts-Overlay:</strong> Neue Puts sind nach dem VIX-Perzentil historisch teuer. Dieses Overlay verändert die primäre Drawdown-Stufe nicht; vorrangige Crash- und Realisierungsregeln bleiben maßgeblich.
        </div>
      )}

      <div className="mt-6 rounded-xl border border-slate-200 bg-white/80 p-5">
        <h3 className="font-semibold text-slate-950">Warum dieses Signal?</h3>
        <p className="mt-2 text-sm text-slate-700">{explanation.summary}</p>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-sm text-slate-700">
          {explanation.reasons.map(reason => <li key={reason}>{reason}</li>)}
        </ul>
        {explanation.coverageNote && (
          <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm font-medium text-amber-900">
            {explanation.coverageNote}
          </p>
        )}
        {decision.triggeredRules.length > 0 && (
          <p className="mt-4 text-xs text-slate-500">Technische Regeln: {decision.triggeredRules.join(' · ')}</p>
        )}
      </div>
    </section>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl bg-white/70 p-4 shadow-sm">
      <dt className="text-sm text-slate-500">{label}</dt>
      <dd className="mt-1 text-xl font-semibold text-slate-950">{value}</dd>
    </div>
  );
}
