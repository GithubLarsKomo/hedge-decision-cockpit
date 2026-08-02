import Link from 'next/link';
import { prisma } from '@/lib/prisma';

export const dynamic = 'force-dynamic';

function formatDate(value: Date | null | undefined) {
  return value ? new Intl.DateTimeFormat('de-DE', { dateStyle: 'medium' }).format(value) : 'Noch nicht vorhanden';
}

function daysOld(value: Date) {
  return Math.max(0, Math.floor((Date.now() - value.getTime()) / 86_400_000));
}

export default async function MonthlyOperatorHome() {
  const [snapshot, review, decision] = await Promise.all([
    prisma.importedPortfolioSnapshot.findFirst({ orderBy: [{ asOf: 'desc' }, { revision: 'desc' }] }).catch(() => null),
    prisma.etfMappingReviewRecord.findFirst({ orderBy: [{ reviewedAt: 'desc' }, { id: 'desc' }] }).catch(() => null),
    prisma.decision.findFirst({ orderBy: { createdAt: 'desc' } }).catch(() => null)
  ]);

  const snapshotAgeDays = snapshot ? daysOld(snapshot.asOf) : null;
  const snapshotFreshness = snapshotAgeDays === null
    ? 'Portfolio-Snapshot fehlt'
    : snapshotAgeDays <= 35
      ? `Aktuell · ${snapshotAgeDays} Tage alt`
      : `Aktualisierung fällig · ${snapshotAgeDays} Tage alt`;

  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-8 px-6 py-10">
      <header className="space-y-3">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Monthly Operator</p>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-3xl font-semibold text-slate-950">Monatslauf vorbereiten</h1>
            <p className="mt-2 max-w-2xl text-slate-600">Ein Einstiegspunkt für Portfolio-Stand, ETF-Review und Hedge-Entscheidung. Diese Seite ist bewusst read-only.</p>
          </div>
          <Link href="/" className="text-sm font-medium text-slate-700 underline underline-offset-4">Zum bisherigen Dashboard</Link>
        </div>
      </header>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Portfolio</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">{snapshot ? formatDate(snapshot.asOf) : 'Noch kein Import'}</h2>
          <p className="mt-2 text-sm text-slate-600">{snapshotFreshness}</p>
          {snapshot && <p className="mt-4 text-xs text-slate-500">{snapshot.strategyName} · {snapshot.strategyVersion} · Revision {snapshot.revision}</p>}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">ETF-Mapping Review</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">{review ? review.outcome.replaceAll('_', ' ') : 'Noch kein Review'}</h2>
          <p className="mt-2 text-sm text-slate-600">{review ? `Geprüft am ${formatDate(review.reviewedAt)}` : 'Vor einem Mapping-Wechsel ist ein explizites Human Review erforderlich.'}</p>
          {review && <p className="mt-4 text-xs text-slate-500">Mapping {review.currentMappingVersion} · {review.reviewer}</p>}
        </article>

        <article className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <p className="text-sm font-medium text-slate-500">Hedge-Entscheidung</p>
          <h2 className="mt-2 text-xl font-semibold text-slate-950">{decision?.action ?? 'Noch keine Entscheidung'}</h2>
          <p className="mt-2 text-sm text-slate-600">{decision ? decision.recommendation : 'Der Monatslauf erzeugt erst nach validiertem Portfolio- und Marktkontext eine Empfehlung.'}</p>
          {decision && <p className="mt-4 text-xs text-slate-500">{formatDate(decision.observedAt ?? decision.createdAt)} · Regel {decision.ruleVersion}</p>}
        </article>
      </section>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
        <h2 className="text-lg font-semibold text-slate-950">Nächster Schritt</h2>
        <p className="mt-2 max-w-3xl text-sm text-slate-600">Der geführte Browser-Workflow wird hier schrittweise ergänzt. Bis dahin bleiben die bestehenden deterministischen CLI-/Bundle-Pfade der kanonische Ausführungsweg.</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href="/" className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Aktuelle Entscheidungen prüfen</Link>
          <span className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-500">Geführten Monatslauf starten · folgt in UX-002</span>
        </div>
      </section>
    </main>
  );
}
