import Link from 'next/link';
import { filterFreshQuotes } from '@/lib/quote-freshness';
import { filterLiquidOptions } from '@/lib/options-liquidity';

export const dynamic = 'force-dynamic';

type TestQuote = {
  symbol: string;
  quotedAt: string;
  bid: number;
  ask: number;
  volume: number;
  openInterest: number;
};

export default function ApplicationTestPage() {
  const observedAt = '2026-07-29T20:00:00.000Z';
  const quotes: TestQuote[] = [
    { symbol: 'NDX-PUT-A', quotedAt: '2026-07-29T19:59:50.000Z', bid: 98, ask: 100, volume: 120, openInterest: 900 },
    { symbol: 'NDX-PUT-B', quotedAt: '2026-07-29T19:59:40.000Z', bid: 45, ask: 55, volume: 80, openInterest: 700 },
    { symbol: 'NDX-PUT-STALE', quotedAt: '2026-07-29T19:58:00.000Z', bid: 70, ask: 72, volume: 200, openInterest: 1200 },
    { symbol: 'NDX-PUT-ZERO', quotedAt: '2026-07-29T19:59:55.000Z', bid: 0, ask: 0, volume: 500, openInterest: 5000 }
  ];

  const fresh = filterFreshQuotes(observedAt, quotes, {
    maximumAgeSeconds: 30,
    maximumFutureSkewSeconds: 2
  });
  const liquid = filterLiquidOptions(fresh, {
    maximumRelativeSpreadPercent: 5,
    minimumVolume: 100,
    minimumOpenInterest: 500
  });

  const passed = fresh.map(quote => quote.symbol).join(',') === 'NDX-PUT-ZERO,NDX-PUT-A,NDX-PUT-B' &&
    liquid.map(quote => quote.symbol).join(',') === 'NDX-PUT-A';

  return (
    <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-slate-500">First application test</p>
          <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-950">Marktdaten-Pipeline</h1>
        </div>
        <Link className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700" href="/">
          Zum Dashboard
        </Link>
      </div>

      <section className={`mt-8 rounded-2xl border p-6 ${passed ? 'border-emerald-300 bg-emerald-50' : 'border-red-300 bg-red-50'}`}>
        <p className="text-sm font-semibold uppercase tracking-wide">Gesamtergebnis</p>
        <p className="mt-2 text-2xl font-bold">{passed ? 'BESTANDEN' : 'FEHLGESCHLAGEN'}</p>
        <p className="mt-2 text-sm text-slate-700">
          Die Seite führt beim Aufruf eine deterministische Kette aus Quote-Aktualität und Liquiditätsfilterung mit kontrollierten Beispieldaten aus.
        </p>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">1. Aktualitätsprüfung</h2>
          <p className="mt-2 text-sm text-slate-600">Erwartet: drei aktuelle Quotes; der 120 Sekunden alte Quote wird entfernt.</p>
          <ul className="mt-4 space-y-2 text-sm">
            {fresh.map(quote => <li key={quote.symbol}><strong>{quote.symbol}</strong> – {quote.ageSeconds.toFixed(1)} Sekunden alt</li>)}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-6">
          <h2 className="text-lg font-semibold">2. Liquiditätsprüfung</h2>
          <p className="mt-2 text-sm text-slate-600">Erwartet: nur NDX-PUT-A; breite und nicht ausführbare Nullquotes werden entfernt.</p>
          <ul className="mt-4 space-y-2 text-sm">
            {liquid.map(quote => <li key={quote.symbol}><strong>{quote.symbol}</strong> – Spread {quote.relativeSpreadPercent.toFixed(2)} %, OI {quote.openInterest}</li>)}
          </ul>
        </section>
      </div>

      <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-6">
        <h2 className="text-lg font-semibold">Manuelle Ersttest-Schritte</h2>
        <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-slate-700">
          <li>Anwendung gemäß README starten.</li>
          <li><code>/test</code> öffnen und Ergebnis „BESTANDEN“ prüfen.</li>
          <li>Dashboard öffnen, Beispieldaten seeden und Darstellung sowie Historie prüfen.</li>
          <li>Einen authentifizierten POST an <code>/api/decision</code> senden und den neuen Datensatz im Dashboard kontrollieren.</li>
        </ol>
      </section>
    </main>
  );
}
