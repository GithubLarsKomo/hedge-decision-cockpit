'use client';

import { Line } from 'react-chartjs-2';
import type { DecisionRow } from './Dashboard';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend
} from 'chart.js';

ChartJS.register(CategoryScale, LinearScale, PointElement, LineElement, Title, Tooltip, Legend);

export default function HistoryChart({ decisions }: { decisions: DecisionRow[] }) {
  const labels = decisions.map(d => new Date(d.createdAt).toLocaleDateString('de-DE'));

  return (
    <section className="rounded-2xl bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-xl font-semibold">Historie</h2>
      <Line
        data={{
          labels,
          datasets: [
            { label: 'NASDAQ Drawdown %', data: decisions.map(d => d.ndxDrawdownPct), tension: 0.25 },
            { label: 'VIX', data: decisions.map(d => d.vixNow), tension: 0.25 }
          ]
        }}
        options={{
          responsive: true,
          interaction: { mode: 'index', intersect: false },
          scales: { y: { beginAtZero: false } }
        }}
      />
    </section>
  );
}
