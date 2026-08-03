import Link from 'next/link';
import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { ZodError } from 'zod';
import { importPortfolioSnapshot, PortfolioSnapshotConflictError } from '@/lib/imported-portfolio-snapshot';
import { computePortfolioSnapshotFingerprint, type PortfolioSnapshotPayload } from '@/lib/portfolio-snapshot';
import { PortfolioExposureEditor } from './portfolio-exposure-editor';

export const dynamic = 'force-dynamic';

function text(formData: FormData, key: string): string {
  return String(formData.get(key) ?? '').trim();
}

function numberValue(formData: FormData, key: string): number {
  return Number(text(formData, key));
}

function csv(value: string): string[] {
  return value.split(',').map(item => item.trim()).filter(Boolean);
}

function parseExposures(formData: FormData): PortfolioSnapshotPayload['exposures'] {
  const raw = JSON.parse(text(formData, 'exposures_json')) as Array<{
    exposure_id: string;
    target_weight: string;
    current_weight: string;
    gap_amount: string;
    target_source: PortfolioSnapshotPayload['exposures'][number]['target_source'];
    mapping_version: string;
    active_purchase_instrument: string;
    mapped_instruments: string;
  }>;

  if (!Array.isArray(raw) || raw.length === 0) throw new Error('Mindestens ein Exposure ist erforderlich.');

  return raw.map((entry, index) => {
    const active = entry.active_purchase_instrument.trim();
    const mapped = csv(entry.mapped_instruments);
    if (active && !mapped.includes(active)) mapped.unshift(active);
    if (!entry.exposure_id.trim()) throw new Error(`Exposure ${index + 1}: Exposure-ID fehlt.`);
    return {
      exposure_id: entry.exposure_id.trim(),
      target_weight: Number(entry.target_weight),
      current_weight: Number(entry.current_weight),
      gap_amount: Number(entry.gap_amount),
      target_source: entry.target_source,
      ...(active ? { active_purchase_instrument: active } : {}),
      mapped_instruments: mapped,
      mapping_version: entry.mapping_version.trim()
    };
  });
}

async function savePortfolioSnapshot(formData: FormData) {
  'use server';

  let result;
  try {
    const monthlyContribution = numberValue(formData, 'monthly_contribution');
    const payload: PortfolioSnapshotPayload = {
      schema_version: 'portfolio-snapshot/1.0',
      snapshot_id: text(formData, 'snapshot_id'),
      revision: numberValue(formData, 'revision'),
      as_of: text(formData, 'as_of'),
      generated_at: new Date().toISOString(),
      strategy: {
        name: text(formData, 'strategy_name'),
        version: text(formData, 'strategy_version'),
        source_observation_date: text(formData, 'source_observation_date'),
        estimation_status: text(formData, 'estimation_status') as PortfolioSnapshotPayload['strategy']['estimation_status'],
        confidence: text(formData, 'confidence') as PortfolioSnapshotPayload['strategy']['confidence']
      },
      portfolio: {
        currency: text(formData, 'currency').toUpperCase(),
        market_value: numberValue(formData, 'market_value'),
        monthly_contribution: monthlyContribution,
        additional_cash_available: numberValue(formData, 'additional_cash_available'),
        target_equity_weight: numberValue(formData, 'target_equity_weight'),
        current_equity_weight: numberValue(formData, 'current_equity_weight'),
        equity_gap_amount: numberValue(formData, 'equity_gap_amount')
      },
      exposures: parseExposures(formData),
      purchase_scenarios: monthlyContribution > 0 ? [{
        scenario_id: 'monthly-contribution-only',
        contribution_amount: monthlyContribution,
        additional_purchase_amount: 0
      }] : [],
      source_fingerprints: csv(text(formData, 'source_fingerprints'))
    };

    const input_fingerprint = computePortfolioSnapshotFingerprint(payload);
    result = await importPortfolioSnapshot({ ...payload, input_fingerprint });
  } catch (error) {
    let message = 'Unbekannter Fehler';
    if (error instanceof PortfolioSnapshotConflictError) message = error.message;
    else if (error instanceof ZodError) message = error.issues.map(issue => `${issue.path.join('.')}: ${issue.message}`).join('; ');
    else if (error instanceof Error) message = error.message;
    redirect(`/monthly/run/portfolio?error=${encodeURIComponent(message)}`);
  }

  revalidatePath('/monthly');
  revalidatePath('/monthly/run');
  redirect(`/monthly/run?portfolio=${result.created ? 'created' : 'unchanged'}&snapshot=${encodeURIComponent(result.snapshotId)}`);
}

export default async function PortfolioInputPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const today = new Date().toISOString().slice(0, 10);
  const month = today.slice(0, 7);
  const inputClass = 'mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-950';
  const labelClass = 'text-sm font-medium text-slate-700';

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-8 px-6 py-10">
      <header className="space-y-3">
        <Link href="/monthly/run" className="text-sm font-medium text-slate-600 underline underline-offset-4">← Zum geführten Monatslauf</Link>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Portfolio · Schritt 1</p>
        <h1 className="text-3xl font-semibold text-slate-950">Portfolio-Snapshot erfassen</h1>
        <p className="max-w-3xl text-slate-600">Strukturierte Browser-Eingabe für den vollständigen Multi-Exposure-Snapshot. Validierung, Fingerprinting und Persistenz bleiben im bestehenden kanonischen Snapshot-Pfad.</p>
      </header>

      {error && <section className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-800"><strong>Snapshot konnte nicht gespeichert werden.</strong><p className="mt-1">{error}</p></section>}

      <form action={savePortfolioSnapshot} className="space-y-6">
        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Snapshot & Strategie</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className={labelClass}>Snapshot-ID<input required name="snapshot_id" defaultValue={month} className={inputClass} /></label>
            <label className={labelClass}>Revision<input required min="1" step="1" type="number" name="revision" defaultValue="1" className={inputClass} /></label>
            <label className={labelClass}>Stichtag<input required type="date" name="as_of" defaultValue={today} className={inputClass} /></label>
            <label className={labelClass}>Strategie<input required name="strategy_name" defaultValue="gpo-private-replication" className={inputClass} /></label>
            <label className={labelClass}>Strategie-Version<input required name="strategy_version" defaultValue={month} className={inputClass} /></label>
            <label className={labelClass}>Quellbeobachtung<input required type="date" name="source_observation_date" defaultValue={today} className={inputClass} /></label>
            <label className={labelClass}>Schätzstatus<select name="estimation_status" defaultValue="mixed" className={inputClass}><option value="observed">observed</option><option value="estimated">estimated</option><option value="mixed">mixed</option><option value="manual">manual</option></select></label>
            <label className={labelClass}>Konfidenz<select name="confidence" defaultValue="medium" className={inputClass}><option value="high">high</option><option value="medium">medium</option><option value="low">low</option></select></label>
            <label className={labelClass}>Source-Fingerprints<input name="source_fingerprints" placeholder="gpo-observation:2026-07-31" className={inputClass} /></label>
          </div>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="text-lg font-semibold text-slate-950">Portfolio</h2>
          <div className="mt-4 grid gap-4 md:grid-cols-3">
            <label className={labelClass}>Währung<input required name="currency" defaultValue="EUR" maxLength={3} className={inputClass} /></label>
            <label className={labelClass}>Marktwert<input required min="0" step="0.01" type="number" name="market_value" className={inputClass} /></label>
            <label className={labelClass}>Monatliche Sparrate<input required min="0" step="0.01" type="number" name="monthly_contribution" defaultValue="0" className={inputClass} /></label>
            <label className={labelClass}>Zusätzliches Cash<input required min="0" step="0.01" type="number" name="additional_cash_available" defaultValue="0" className={inputClass} /></label>
            <label className={labelClass}>Ziel-Aktienquote (0–1)<input required min="0" max="1" step="0.001" type="number" name="target_equity_weight" className={inputClass} /></label>
            <label className={labelClass}>Aktuelle Aktienquote (0–1)<input required min="0" max="1" step="0.001" type="number" name="current_equity_weight" className={inputClass} /></label>
            <label className={labelClass}>Equity-Gap EUR<input required step="0.01" type="number" name="equity_gap_amount" className={inputClass} /></label>
          </div>
        </section>

        <PortfolioExposureEditor defaultMappingVersion={month} />

        <section className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <p className="max-w-2xl text-sm text-slate-600">Speichern erzeugt ausschließlich einen validierten Portfolio-Snapshot. Es wird weder ein ETF gewechselt noch eine Hedge-Entscheidung oder Order ausgelöst.</p>
          <button type="submit" className="rounded-lg bg-slate-950 px-5 py-2.5 text-sm font-semibold text-white">Snapshot validieren & speichern</button>
        </section>
      </form>
    </main>
  );
}
