import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function formatDate(value: Date | null | undefined) {
  return value ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(value) : 'Nicht vorhanden';
}

export default async function GuidedMonthlyRunPage({ searchParams }: { searchParams: Promise<{ portfolio?: string; snapshot?: string; hedge?: string; decision?: string }> }) {
  const params = await searchParams;
  const [snapshot, review, decision] = await Promise.all([
    prisma.importedPortfolioSnapshot.findFirst({ orderBy: [{ asOf: 'desc' }, { revision: 'desc' }] }).catch(() => null),
    prisma.etfMappingReviewRecord.findFirst({ orderBy: [{ reviewedAt: 'desc' }, { id: 'desc' }] }).catch(() => null),
    prisma.decision.findFirst({ orderBy: { createdAt: 'desc' } }).catch(() => null)
  ]);

  const steps = [
    {
      title: '1. Portfolio prüfen',
      status: snapshot ? 'bereit' : 'blockiert',
      detail: snapshot ? `${snapshot.strategyName} ${snapshot.strategyVersion} · Stand ${formatDate(snapshot.asOf)} · Revision ${snapshot.revision}` : 'Es fehlt ein importierter Portfolio-Snapshot.',
      href: '/monthly/run/portfolio',
      action: snapshot ? 'Portfolio aktualisieren' : 'Portfolio erfassen'
    },
    {
      title: '2. Zielallokation & ETF-Mapping',
      status: snapshot ? 'bereit' : 'wartet',
      detail: review ? `Letzter Human Review: ${review.outcome.replaceAll('_', ' ')} am ${formatDate(review.reviewedAt)}` : 'Noch kein Human Review vorhanden. Ein Mapping-Wechsel bleibt bis zu einer expliziten Entscheidung gesperrt.'
    },
    {
      title: '3. Hedge-Kontext',
      status: decision ? 'vorhanden' : 'offen',
      detail: decision ? `Letzte Signale: NDX Drawdown ${decision.ndxDrawdownPct.toFixed(2)} %, VIX-Perzentil ${decision.vixPercentile.toFixed(1)}.` : 'Taktische Marktsignale müssen noch erfasst werden.',
      href: '/monthly/run/hedge',
      action: decision ? 'Hedge-Kontext aktualisieren' : 'Hedge-Kontext erfassen'
    },
    {
      title: '4. Entscheidung prüfen',
      status: decision ? 'bereit' : 'wartet',
      detail: decision ? `${decision.action} · Regel ${decision.ruleVersion}` : 'Noch keine Hedge-Empfehlung vorhanden.'
    },
    {
      title: '5. Monatslauf abschließen',
      status: 'manuell',
      detail: 'Abschluss bleibt eine explizite menschliche Aktion. Dieser Slice führt noch keine Ausführung aus.'
    }
  ];

  const blockers = [
    !snapshot ? 'Portfolio-Snapshot fehlt.' : null,
    !decision ? 'Aktueller Hedge-Kontext bzw. eine Entscheidung fehlt.' : null
  ].filter(Boolean) as string[];

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-8 px-6 py-10">
      <header className="space-y-3">
        <Link href="/monthly" className="text-sm font-medium text-slate-600 underline underline-offset-4">← Zur Monatsübersicht</Link>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Guided Monthly Run</p>
        <h1 className="text-3xl font-semibold text-slate-950">Monatslauf Schritt für Schritt</h1>
        <p className="max-w-3xl text-slate-600">Die Oberfläche orchestriert ausschließlich den bestehenden deterministischen Portfolio→Hedge-Pfad. Schreibende Schritte bleiben explizite Human-in-the-loop-Aktionen.</p>
      </header>

      {params.portfolio && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
          <strong>Portfolio-Snapshot {params.portfolio === 'created' ? 'gespeichert' : 'unverändert bestätigt'}.</strong>
          {params.snapshot && <span> Snapshot-ID: {params.snapshot}</span>}
        </section>
      )}

      {params.hedge && (
        <section className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-900">
          <strong>Hedge-Kontext geprüft und Empfehlung gespeichert.</strong>
          {params.decision && <span> Decision-ID: {params.decision}</span>}
        </section>
      )}

      <section className={`rounded-2xl border p-5 ${blockers.length === 0 ? 'border-emerald-200 bg-emerald-50' : 'border-amber-200 bg-amber-50'}`}>
        <h2 className="font-semibold text-slate-950">Readiness</h2>
        {blockers.length === 0 ? (
          <p className="mt-2 text-sm text-slate-700">Alle aktuell notwendigen Voraussetzungen sind vorhanden.</p>
        ) : (
          <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-slate-700">
            {blockers.map(blocker => <li key={blocker}>{blocker}</li>)}
          </ul>
        )}
      </section>

      <section className="space-y-3">
        {steps.map(step => (
          <article key={step.title} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-950">{step.title}</h2>
              <span className="rounded-full border border-slate-300 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-600">{step.status}</span>
            </div>
            <p className="mt-2 text-sm text-slate-600">{step.detail}</p>
            {'href' in step && step.href && (
              <Link href={step.href} className="mt-4 inline-flex rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">{step.action}</Link>
            )}
          </article>
        ))}
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
        <h2 className="font-semibold text-slate-950">Sicherheitsgrenze</h2>
        <p className="mt-2 text-sm text-slate-600">Keine automatische ETF-Umschichtung, keine Variantenauswahl und keine Order-/Broker-Ausführung.</p>
      </section>
    </main>
  );
}
