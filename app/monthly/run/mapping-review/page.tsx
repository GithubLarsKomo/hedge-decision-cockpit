import Link from 'next/link';
import { redirect } from 'next/navigation';
import {
  getEtfMappingArtifactByFingerprint,
  listEtfMappingArtifacts
} from '@/lib/etf-mapping-artifact-store';
import {
  computeEtfMappingReviewContextFingerprint,
  prepareEtfMappingReviewContext
} from '@/lib/etf-mapping-review-context';
import { persistEtfMappingReviewDecisionFromContext } from '@/lib/etf-mapping-review-decision-workflow';

export const dynamic = 'force-dynamic';

const REVIEW_POLICY = { review_interval_days: 365, overdue_grace_days: 30 } as const;

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

async function submitReview(formData: FormData) {
  'use server';

  const currentFingerprint = String(formData.get('current_fingerprint') ?? '');
  const candidateFingerprint = String(formData.get('candidate_fingerprint') ?? '').trim();
  const outcome = String(formData.get('outcome') ?? '');
  const reviewer = String(formData.get('reviewer') ?? '').trim();
  const rationale = String(formData.get('rationale') ?? '').trim();

  try {
    const current = await getEtfMappingArtifactByFingerprint(currentFingerprint);
    if (!current) throw new Error('Current mapping artifact no longer exists.');

    const candidate = candidateFingerprint
      ? await getEtfMappingArtifactByFingerprint(candidateFingerprint)
      : null;
    if (candidateFingerprint && !candidate) throw new Error('Candidate mapping artifact no longer exists.');

    const context = await prepareEtfMappingReviewContext(
      current.mapping,
      candidate?.mapping,
      todayUtc(),
      REVIEW_POLICY
    );
    const contextFingerprint = computeEtfMappingReviewContextFingerprint(context);

    const result = await persistEtfMappingReviewDecisionFromContext(context, {
      context_fingerprint: contextFingerprint,
      outcome,
      reviewer,
      reviewed_at: new Date().toISOString(),
      rationale
    });

    redirect(`/monthly/run?mappingReview=${result.persistence.created ? 'created' : 'replayed'}&review=${encodeURIComponent(result.record_fingerprint)}`);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'ETF mapping review failed.';
    redirect(`/monthly/run/mapping-review?error=${encodeURIComponent(message)}&current=${encodeURIComponent(currentFingerprint)}${candidateFingerprint ? `&candidate=${encodeURIComponent(candidateFingerprint)}` : ''}`);
  }
}

export default async function MappingReviewPage({
  searchParams
}: {
  searchParams: Promise<{ current?: string; candidate?: string; error?: string }>;
}) {
  const params = await searchParams;
  const artifacts = await listEtfMappingArtifacts();

  if (artifacts.length === 0) {
    return (
      <main className="mx-auto min-h-screen max-w-4xl space-y-6 px-6 py-10">
        <Link href="/monthly/run" className="text-sm font-medium text-slate-600 underline underline-offset-4">← Zum Monatslauf</Link>
        <h1 className="text-3xl font-semibold text-slate-950">ETF-Mapping Review</h1>
        <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm text-amber-900">
          Noch kein kanonisches ETF-Mapping-Artefakt gespeichert. Ein Human Review kann erst auf einem exakten Mapping-Vertrag durchgeführt werden.
        </section>
      </main>
    );
  }

  const current = params.current
    ? artifacts.find((entry) => entry.mappingFingerprint === params.current) ?? artifacts[0]
    : artifacts[0];
  const candidate = params.candidate
    ? artifacts.find((entry) => entry.mappingFingerprint === params.candidate && entry.mappingFingerprint !== current.mappingFingerprint)
    : undefined;

  const context = await prepareEtfMappingReviewContext(
    current.mapping,
    candidate?.mapping,
    todayUtc(),
    REVIEW_POLICY
  );

  return (
    <main className="mx-auto min-h-screen max-w-5xl space-y-8 px-6 py-10">
      <header className="space-y-3">
        <Link href="/monthly/run" className="text-sm font-medium text-slate-600 underline underline-offset-4">← Zum Monatslauf</Link>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">Human-in-the-loop</p>
        <h1 className="text-3xl font-semibold text-slate-950">ETF-Mapping prüfen</h1>
        <p className="max-w-3xl text-slate-600">Die Entscheidung wird an den frisch berechneten deterministischen Review-Context gebunden. Kein Mapping wird durch diese Seite automatisch verändert.</p>
      </header>

      {params.error && <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">{params.error}</section>}

      <form method="get" className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-2">
        <label className="space-y-2 text-sm font-medium text-slate-700">
          Current Mapping
          <select name="current" defaultValue={current.mappingFingerprint} className="w-full rounded-lg border border-slate-300 px-3 py-2">
            {artifacts.map((entry) => <option key={entry.mappingFingerprint} value={entry.mappingFingerprint}>{entry.mappingVersion} · {entry.mapping.effective_date}</option>)}
          </select>
        </label>
        <label className="space-y-2 text-sm font-medium text-slate-700">
          Candidate Mapping (optional)
          <select name="candidate" defaultValue={candidate?.mappingFingerprint ?? ''} className="w-full rounded-lg border border-slate-300 px-3 py-2">
            <option value="">Kein Candidate</option>
            {artifacts.filter((entry) => entry.mappingFingerprint !== current.mappingFingerprint).map((entry) => <option key={entry.mappingFingerprint} value={entry.mappingFingerprint}>{entry.mappingVersion} · {entry.mapping.effective_date}</option>)}
          </select>
        </label>
        <button className="md:col-span-2 w-fit rounded-lg border border-slate-300 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800">Vergleich laden</button>
      </form>

      <section className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Review-Status</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{context.review_status.status}</p>
          <p className="mt-2 text-sm text-slate-600">Nächster Termin: {context.review_status.next_review_date}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Current Mapping</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{context.current_mapping.mapping_version}</p>
          <p className="mt-2 break-all text-xs text-slate-500">{context.current_mapping.mapping_fingerprint}</p>
        </article>
        <article className="rounded-2xl border border-slate-200 bg-white p-5">
          <p className="text-sm text-slate-500">Candidate</p>
          <p className="mt-2 text-xl font-semibold text-slate-950">{context.candidate_mapping?.mapping_version ?? 'Keiner'}</p>
          <p className="mt-2 text-sm text-slate-600">{context.comparison ? `${context.comparison.exposures.length} Exposure-Vergleiche` : 'Kein Mapping-Diff geladen.'}</p>
        </article>
      </section>

      {context.comparison && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold text-slate-950">Deterministischer Mapping-Diff</h2>
          <div className="mt-4 space-y-2">
            {context.comparison.exposures.map((entry) => (
              <div key={entry.exposure_id} className="rounded-lg border border-slate-100 bg-slate-50 p-3 text-sm text-slate-700">
                <strong>{entry.exposure_id}</strong> · {entry.change_type}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-5">
        <h2 className="font-semibold text-slate-950">Bisherige Reviews</h2>
        {context.prior_reviews.length === 0 ? <p className="mt-2 text-sm text-slate-600">Noch keine Reviews für dieses Current Mapping.</p> : (
          <div className="mt-4 space-y-3">
            {context.prior_reviews.slice(0, 5).map((review) => <div key={review.record_fingerprint} className="rounded-lg border border-slate-100 p-3 text-sm text-slate-700"><strong>{review.outcome}</strong> · {review.reviewer} · {new Date(review.reviewed_at).toLocaleDateString('de-DE')}<p className="mt-1 text-slate-600">{review.rationale}</p></div>)}
          </div>
        )}
      </section>

      <form action={submitReview} className="space-y-5 rounded-2xl border border-slate-200 bg-white p-5">
        <input type="hidden" name="current_fingerprint" value={current.mappingFingerprint} />
        <input type="hidden" name="candidate_fingerprint" value={candidate?.mappingFingerprint ?? ''} />
        <div>
          <label className="text-sm font-medium text-slate-700">Entscheidung</label>
          <select name="outcome" className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" defaultValue="keep_current">
            <option value="keep_current">Current Mapping beibehalten</option>
            <option value="defer">Entscheidung vertagen</option>
            {candidate && <option value="accept_replacement">Candidate als Replacement akzeptieren</option>}
          </select>
        </div>
        <label className="block text-sm font-medium text-slate-700">Reviewer<input name="reviewer" required className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
        <label className="block text-sm font-medium text-slate-700">Begründung<textarea name="rationale" required rows={4} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" /></label>
        <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Human Review speichern</button>
      </form>

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
        Sicherheitsgrenze: Auch „Replacement akzeptieren“ schreibt ausschließlich den Review-Record. Das gespeicherte Mapping-Artefakt selbst wird nicht verändert oder automatisch aktiviert.
      </section>
    </main>
  );
}
