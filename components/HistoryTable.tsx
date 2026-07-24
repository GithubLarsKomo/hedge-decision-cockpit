import type { DecisionRow } from './Dashboard';

function fmt(n: number, digits = 2) {
  return new Intl.NumberFormat('de-DE', { maximumFractionDigits: digits, minimumFractionDigits: digits }).format(n);
}

export default function HistoryTable({ decisions }: { decisions: DecisionRow[] }) {
  return (
    <section className="overflow-hidden rounded-2xl bg-white shadow-sm">
      <div className="border-b border-slate-200 p-6">
        <h2 className="text-xl font-semibold">Entscheidungshistorie</h2>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3">Datum</th>
              <th className="px-4 py-3">NDX</th>
              <th className="px-4 py-3">Drawdown</th>
              <th className="px-4 py-3">VIX</th>
              <th className="px-4 py-3">Aktion</th>
              <th className="px-4 py-3">Signal</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {decisions.map(d => (
              <tr key={d.id} className="hover:bg-slate-50">
                <td className="px-4 py-3">{new Date(d.createdAt).toLocaleString('de-DE')}</td>
                <td className="px-4 py-3">{fmt(d.ndxNow)}</td>
                <td className="px-4 py-3">{fmt(d.ndxDrawdownPct)} %</td>
                <td className="px-4 py-3">{fmt(d.vixNow)}</td>
                <td className="px-4 py-3 font-medium">{d.action}</td>
                <td className="px-4 py-3">{d.severity}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
