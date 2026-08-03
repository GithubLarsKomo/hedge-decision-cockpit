import Link from 'next/link';
import MappingEditor from './MappingEditor';

export const dynamic = 'force-dynamic';

export default async function NewEtfMappingPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const params = await searchParams;
  return (
    <main className="mx-auto min-h-screen max-w-6xl space-y-8 px-6 py-10">
      <header className="space-y-3">
        <Link href="/monthly/run/mapping-review" className="text-sm font-medium text-slate-600 underline underline-offset-4">← Zum Mapping Review</Link>
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-slate-500">ETF Mapping Artifact</p>
        <h1 className="text-3xl font-semibold text-slate-950">ETF-Mapping im Browser erfassen</h1>
        <p className="max-w-3xl text-slate-600">Mehrere Exposures und Kandidaten können strukturiert erfasst werden. Die fachliche Validierung erfolgt ausschließlich serverseitig über den bestehenden kanonischen Mapping-Vertrag.</p>
      </header>

      {params.error && <section className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-900">{params.error}</section>}

      <MappingEditor />

      <section className="rounded-2xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600">
        Sicherheitsgrenze: Das Speichern legt nur ein kanonisches Mapping-Artefakt an. Es aktiviert kein Mapping, trifft keine Review-Entscheidung und erzeugt keine Order.
      </section>
    </main>
  );
}
