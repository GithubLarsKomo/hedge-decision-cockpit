'use client';

import { useMemo, useState } from 'react';

type ExposureDraft = {
  exposure_id: string;
  target_weight: string;
  current_weight: string;
  gap_amount: string;
  target_source: 'observed' | 'estimated' | 'manual';
  mapping_version: string;
  active_purchase_instrument: string;
  mapped_instruments: string;
};

const emptyExposure = (mappingVersion: string): ExposureDraft => ({
  exposure_id: '',
  target_weight: '',
  current_weight: '',
  gap_amount: '',
  target_source: 'estimated',
  mapping_version: mappingVersion,
  active_purchase_instrument: '',
  mapped_instruments: ''
});

export function PortfolioExposureEditor({ defaultMappingVersion }: { defaultMappingVersion: string }) {
  const [exposures, setExposures] = useState<ExposureDraft[]>([emptyExposure(defaultMappingVersion)]);
  const serialized = useMemo(() => JSON.stringify(exposures), [exposures]);

  function update(index: number, patch: Partial<ExposureDraft>) {
    setExposures(current => current.map((item, i) => i === index ? { ...item, ...patch } : item));
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <input type="hidden" name="exposures_json" value={serialized} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-950">Exposures</h2>
          <p className="mt-1 text-sm text-slate-500">Mehrere Exposure-Blöcke können direkt im Browser gepflegt werden.</p>
        </div>
        <button type="button" onClick={() => setExposures(current => [...current, emptyExposure(defaultMappingVersion)])} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Exposure hinzufügen</button>
      </div>

      <div className="mt-5 space-y-5">
        {exposures.map((exposure, index) => (
          <div key={index} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-semibold text-slate-900">Exposure {index + 1}</h3>
              {exposures.length > 1 && <button type="button" onClick={() => setExposures(current => current.filter((_, i) => i !== index))} className="text-sm font-medium text-red-700">Entfernen</button>}
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="text-sm font-medium text-slate-700">Exposure-ID<input required value={exposure.exposure_id} onChange={e => update(index, { exposure_id: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" /></label>
              <label className="text-sm font-medium text-slate-700">Zielgewicht (0–1)<input required min="0" max="1" step="0.001" type="number" value={exposure.target_weight} onChange={e => update(index, { target_weight: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" /></label>
              <label className="text-sm font-medium text-slate-700">Aktuelles Gewicht (0–1)<input required min="0" max="1" step="0.001" type="number" value={exposure.current_weight} onChange={e => update(index, { current_weight: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" /></label>
              <label className="text-sm font-medium text-slate-700">Gap EUR<input required step="0.01" type="number" value={exposure.gap_amount} onChange={e => update(index, { gap_amount: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" /></label>
              <label className="text-sm font-medium text-slate-700">Zielquelle<select value={exposure.target_source} onChange={e => update(index, { target_source: e.target.value as ExposureDraft['target_source'] })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"><option value="observed">observed</option><option value="estimated">estimated</option><option value="manual">manual</option></select></label>
              <label className="text-sm font-medium text-slate-700">Mapping-Version<input required value={exposure.mapping_version} onChange={e => update(index, { mapping_version: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" /></label>
              <label className="text-sm font-medium text-slate-700">Aktives Kaufinstrument<input value={exposure.active_purchase_instrument} onChange={e => update(index, { active_purchase_instrument: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" /></label>
              <label className="text-sm font-medium text-slate-700 md:col-span-2">Gemappte Instrumente, kommagetrennt<input required value={exposure.mapped_instruments} onChange={e => update(index, { mapped_instruments: e.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm" /></label>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
