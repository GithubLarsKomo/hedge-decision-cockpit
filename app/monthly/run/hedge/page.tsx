import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';
import { evaluateDecision } from '@/lib/decision-engine';
import { computeDrawdownPercent } from '@/lib/market-metrics';
import { DecisionConflictError, persistDecision } from '@/lib/decision-persistence';

export const dynamic = 'force-dynamic';

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function numberValue(formData: FormData, key: string): number {
  return Number(text(formData, key));
}

async function saveHedgeContext(formData: FormData) {
  'use server';

  const ndxNow = numberValue(formData, 'ndx_now');
  const ndxHigh2y = numberValue(formData, 'ndx_high_2y');
  const vixNow = numberValue(formData, 'vix_now');
  const vixPercentile = numberValue(formData, 'vix_percentile');
  const hedgeCoverageRaw = text(formData, 'hedge_coverage_percent');
  const hedgeCoveragePercent = hedgeCoverageRaw === '' ? null : Number(hedgeCoverageRaw);
  const drawdownPercent = computeDrawdownPercent(ndxNow, ndxHigh2y);
  const decision = evaluateDecision({ drawdownPercent, vixPercentile, hedgeCoveragePercent });

  let decisionId: number;
  try {
    const result = await persistDecision({
      observedAt: new Date(text(formData, 'observed_at')).toISOString(),
      source: text(formData, 'source') || 'browser/monthly-operator',
      ndxNow,
      ndxHigh2y,
      drawdownPercent,
      vixNow,
      vixPercentile,
      hedgeCoveragePercent,
      action: decision.action,
      severity: decision.severity,
      recommendation: decision.recommendation,
      ruleVersion: decision.ruleVersion,
      triggeredRules: decision.triggeredRules,
      notes: text(formData, 'notes') || null
    });
    decisionId = result.id;
  } catch (error) {
    let message = 'Unbekannter Fehler';
    if (error instanceof DecisionConflictError) message = error.message;
    else if (error instanceof ZodError) message = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    else if (error instanceof Error) message = error.message;
    redirect(`/monthly/run/hedge?error=${encodeURIComponent(message)}`);
  }

  revalidatePath('/');
  revalidatePath('/monthly');
  revalidatePath('/monthly/run');
  redirect(`/monthly/run?hedge=created&decision=${decisionId}`);
}

export default async function HedgeContextPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const defaultObservedAt = new Date().toISOString().slice(0, 16);
  const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950';
  const labelClass = 'text-sm font-medium text-slate-700';

  return (
    <main className="mx-auto min-h-screen max-w-4xl space-y-8 px-6 py-10">
      <header className="space-y-3">
        <Link href="/monthly/run" className="text-sm font-medium text-slate-600 underline underline-offset-4">← Zum geführten Monatslauf</Link>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Hedge-Kontext · Schritt 3</p>
        <h1 className="text-3xl font-semibold text-slate-950">Marktsignale erfassen</h1>
        <p className="max-w-3xl text-slate-600">NDX- und VIX-Werte werden strukturiert erfasst. Der Drawdown wird daraus berechnet und die bestehende Regelengine erzeugt die Empfehlung; es wird keine Order ausgelöst.</p>
      </header>

      {error && (
        <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800">
          <strong>Hedge-Kontext konnte nicht gespeichert werden.</strong>
          <p className="mt-1">{error}</p>
        </section>
      )}

      <form action={saveHedgeContext} className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Beobachtung</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className={labelClass}>Zeitpunkt<input required type="datetime-local" name="observed_at" defaultValue={defaultObservedAt} className={inputClass} /></label>
            <label className={labelClass}>Quelle<input required name="source" defaultValue="browser/monthly-operator" className={inputClass} /></label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">NASDAQ</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-2">
            <label className={labelClass}>NDX aktuell<input required min="0.01" step="0.01" type="number" name="ndx_now" className={inputClass} /></label>
            <label className={labelClass}>NDX Referenzhoch<input required min="0.01" step="0.01" type="number" name="ndx_high_2y" className={inputClass} /></label>
          </div>
          <p className="mt-3 text-xs text-slate-500">Der Drawdown wird serverseitig aus aktuellem Stand und Referenzhoch berechnet.</p>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Volatilität & Hedge</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className={labelClass}>VIX aktuell<input required min="0" step="0.01" type="number" name="vix_now" className={inputClass} /></label>
            <label className={labelClass}>VIX-Perzentil<input required min="0" max="100" step="0.1" type="number" name="vix_percentile" className={inputClass} /></label>
            <label className={labelClass}>Hedge-Abdeckung %<input min="0" max="1000" step="0.1" type="number" name="hedge_coverage_percent" className={inputClass} /></label>
          </div>
          <label className={`mt-4 block ${labelClass}`}>Notiz<textarea name="notes" rows={3} className={inputClass} /></label>
        </section>

        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="max-w-2xl text-sm text-slate-600">Speichern erzeugt eine regelbasierte Empfehlung im Cockpit. Ausführung und Transaktion bleiben vollständig außerhalb dieses Schritts.</p>
          <button type="submit" className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white">Kontext prüfen & Empfehlung speichern</button>
        </section>
      </form>
    </main>
  );
}
