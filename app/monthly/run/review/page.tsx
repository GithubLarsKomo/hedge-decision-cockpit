import Link from 'next/link';
import { redirect } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { persistMonthlyRunCompletion } from '@/lib/monthly-run-completion';

export const dynamic = 'force-dynamic';

function mappingFingerprintFromSnapshot(payload: unknown): string | undefined {
  if (!payload || typeof payload !== 'object') return undefined;
  const fingerprints = (payload as { source_fingerprints?: unknown }).source_fingerprints;
  if (!Array.isArray(fingerprints)) return undefined;
  const source = fingerprints.find((value): value is string => typeof value === 'string' && value.startsWith('etf-mapping:sha256:'));
  return source?.slice('etf-mapping:'.length);
}

async function loadReviewState() {
  const [snapshot, decision] = await Promise.all([
    prisma.importedPortfolioSnapshot.findFirst({ orderBy: [{ asOf: 'desc' }, { revision: 'desc' }] }),
    prisma.decision.findFirst({ orderBy: { createdAt: 'desc' } })
  ]);
  if (!snapshot || !decision) return { snapshot, decision, review: null };

  const mappingFingerprint = mappingFingerprintFromSnapshot(snapshot.payloadJson);
  const review = mappingFingerprint
    ? await prisma.etfMappingReviewRecord.findFirst({
        where: { currentMappingFingerprint: mappingFingerprint },
        orderBy: [{ reviewedAt: 'desc' }, { id: 'desc' }]
      })
    : null;
  return { snapshot, decision, review };
}

async function completeMonthlyRun(formData: FormData) {
  'use server';
  const actor = String(formData.get('actor') ?? '').trim();
  const rationale = String(formData.get('rationale') ?? '').trim();

  try {
    const { snapshot, decision, review } = await loadReviewState();
    if (!snapshot) throw new Error('Portfolio-Snapshot fehlt.');
    if (!decision) throw new Error('Hedge-Entscheidung fehlt.');
    const result = await persistMonthlyRunCompletion({
      snapshot_fingerprint: snapshot.inputFingerprint,
      decision_id: decision.id,
      ...(review ? { mapping_review_fingerprint: review.recordFingerprint } : {}),
      actor,
      rationale,
      completed_at: new Date().toISOString()
    });
    return redirect(`/monthly/run?completion=${result.created ? 'created' : 'replayed'}&completionId=${result.entry.id}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Monatsabschluss fehlgeschlagen.';
    redirect(`/monthly/run/review?error=${encodeURIComponent(message)}`);
  }
}

export default async function MonthlyDecisionReviewPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  const { snapshot, decision, review } = await loadReviewState();
  const blocked = !snapshot || !decision;

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-8 px-6 py-10">
      <header className="space-y-3">
        <Link href="/monthly/run" className="text-sm font-medium text-slate-600 underline underline-offset-4">← Zum Monatslauf</Link>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Decision Review</p>
        <h1 className="text-3xl font-semibold text-slate-950">Monatslauf fachlich abschließen</h1>
        <p className="max-w-3xl text-slate-600">Dieser Abschluss dokumentiert ausschließlich deine menschliche Prüfung des Monatslaufs. Er erzeugt keine Order und verändert keine Execution-, Mapping- oder Variantendaten.</p>
      </header>

      {params.error && <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">{params.error}</section>}

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Portfolio</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{snapshot ? `${snapshot.snapshotId} · Rev. ${snapshot.revision}` : 'Fehlt'}</p>
          {snapshot && <p className="mt-2 break-all text-xs text-slate-500">{snapshot.inputFingerprint}</p>}
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Hedge-Entscheidung</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{decision ? decision.action : 'Fehlt'}</p>
          {decision && <p className="mt-2 text-sm text-slate-600">{decision.recommendation}</p>}
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">ETF Human Review</p>
          <p className="mt-2 text-lg font-semibold text-slate-950">{review ? review.outcome.replaceAll('_', ' ') : 'Nicht gebunden'}</p>
          {review && <p className="mt-2 text-sm text-slate-600">{review.reviewer} · {review.reviewedAt.toLocaleDateString('de-DE')}</p>}
        </article>
      </section>

      {blocked ? (
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">Portfolio-Snapshot und Hedge-Entscheidung müssen vor dem Abschluss vorhanden sein.</section>
      ) : (
        <form action={completeMonthlyRun} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">Explizite Abschlussbestätigung</h2>
          <label className="block text-sm font-medium text-slate-700">Prüfer<input name="actor" required className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
          <label className="block text-sm font-medium text-slate-700">Abschlussnotiz<textarea name="rationale" required rows={4} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" placeholder="Warum ist dieser Monatslauf fachlich geprüft und abgeschlossen?" /></label>
          <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Monatslauf verbindlich abschließen</button>
        </form>
      )}

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">Sicherheitsgrenze: MonthlyRunCompletion ist kein ExecutionAuditRecord und löst keinerlei Broker- oder Order-Aktion aus.</section>
    </main>
  );
}
