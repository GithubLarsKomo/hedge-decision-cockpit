'use client';

import { useMemo, useState } from 'react';
import { saveEtfMappingArtifact } from './actions';

type CandidateDraft = {
  instrument_id: string;
  exposure_fidelity: string;
  ter: string;
  tracking_difference: string;
  fund_size: string;
  savings_plan_eligible: boolean;
  tradable: boolean;
  active_for_new_purchases: boolean;
};

type ExposureDraft = {
  exposure_id: string;
  desired_reference: string;
  selected_instrument_id: string;
  candidates: CandidateDraft[];
};

function candidate(): CandidateDraft {
  return {
    instrument_id: '',
    exposure_fidelity: '1',
    ter: '0.002',
    tracking_difference: '',
    fund_size: '',
    savings_plan_eligible: true,
    tradable: true,
    active_for_new_purchases: true
  };
}

function exposure(): ExposureDraft {
  return {
    exposure_id: '',
    desired_reference: '',
    selected_instrument_id: '',
    candidates: [candidate()]
  };
}

export default function MappingEditor() {
  const [mappingVersion, setMappingVersion] = useState('1.0.0');
  const [effectiveDate, setEffectiveDate] = useState(new Date().toISOString().slice(0, 10));
  const [exposures, setExposures] = useState<ExposureDraft[]>([exposure()]);

  const payload = useMemo(() => JSON.stringify({
    schema_version: 'etf-nearest-neighbour-mapping/1.0',
    mapping_version: mappingVersion,
    effective_date: effectiveDate,
    exposures: exposures.map((item) => ({
      exposure_id: item.exposure_id,
      desired_reference: item.desired_reference,
      selected_instrument_id: item.selected_instrument_id,
      candidates: item.candidates.map((entry) => ({
        instrument_id: entry.instrument_id,
        exposure_fidelity: Number(entry.exposure_fidelity),
        ter: Number(entry.ter),
        ...(entry.tracking_difference.trim() ? { tracking_difference: Number(entry.tracking_difference) } : {}),
        ...(entry.fund_size.trim() ? { fund_size: Number(entry.fund_size) } : {}),
        savings_plan_eligible: entry.savings_plan_eligible,
        tradable: entry.tradable,
        active_for_new_purchases: entry.active_for_new_purchases
      }))
    }))
  }), [mappingVersion, effectiveDate, exposures]);

  function updateExposure(index: number, patch: Partial<ExposureDraft>) {
    setExposures((current) => current.map((item, i) => i === index ? { ...item, ...patch } : item));
  }

  function updateCandidate(exposureIndex: number, candidateIndex: number, patch: Partial<CandidateDraft>) {
    setExposures((current) => current.map((item, i) => i === exposureIndex ? {
      ...item,
      candidates: item.candidates.map((entry, j) => j === candidateIndex ? { ...entry, ...patch } : entry)
    } : item));
  }

  return (
    <form action={saveEtfMappingArtifact} className="space-y-6">
      <input type="hidden" name="mapping_payload" value={payload} />

      <section className="grid gap-4 rounded-2xl border border-slate-200 bg-white p-5 md:grid-cols-2">
        <label className="text-sm font-medium text-slate-700">Mapping-Version
          <input value={mappingVersion} onChange={(event) => setMappingVersion(event.target.value)} required className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
        <label className="text-sm font-medium text-slate-700">Gültig ab
          <input type="date" value={effectiveDate} onChange={(event) => setEffectiveDate(event.target.value)} required className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" />
        </label>
      </section>

      <section className="space-y-4">
        {exposures.map((item, exposureIndex) => (
          <article key={exposureIndex} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-slate-950">Exposure {exposureIndex + 1}</h2>
              {exposures.length > 1 && <button type="button" onClick={() => setExposures((current) => current.filter((_, i) => i !== exposureIndex))} className="text-sm font-medium text-red-700">Exposure entfernen</button>}
            </div>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <label className="text-sm font-medium text-slate-700">Exposure-ID
                <input value={item.exposure_id} onChange={(event) => updateExposure(exposureIndex, { exposure_id: event.target.value })} required className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-sm font-medium text-slate-700">Referenz
                <input value={item.desired_reference} onChange={(event) => updateExposure(exposureIndex, { desired_reference: event.target.value })} required className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2" />
              </label>
              <label className="text-sm font-medium text-slate-700">Aktives Kaufinstrument
                <select value={item.selected_instrument_id} onChange={(event) => updateExposure(exposureIndex, { selected_instrument_id: event.target.value })} required className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2">
                  <option value="">Auswählen</option>
                  {item.candidates.filter((entry) => entry.instrument_id.trim()).map((entry) => <option key={entry.instrument_id} value={entry.instrument_id}>{entry.instrument_id}</option>)}
                </select>
              </label>
            </div>

            <div className="mt-5 space-y-3">
              {item.candidates.map((entry, candidateIndex) => (
                <div key={candidateIndex} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                  <div className="flex items-center justify-between gap-3">
                    <h3 className="text-sm font-semibold text-slate-900">Kandidat {candidateIndex + 1}</h3>
                    {item.candidates.length > 1 && <button type="button" onClick={() => updateExposure(exposureIndex, { candidates: item.candidates.filter((_, i) => i !== candidateIndex) })} className="text-xs font-medium text-red-700">Entfernen</button>}
                  </div>
                  <div className="mt-3 grid gap-3 md:grid-cols-3">
                    <label className="text-xs font-medium text-slate-700">Instrument-ID<input value={entry.instrument_id} onChange={(event) => updateCandidate(exposureIndex, candidateIndex, { instrument_id: event.target.value })} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
                    <label className="text-xs font-medium text-slate-700">Exposure fidelity (0–1)<input type="number" min="0" max="1" step="0.001" value={entry.exposure_fidelity} onChange={(event) => updateCandidate(exposureIndex, candidateIndex, { exposure_fidelity: event.target.value })} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
                    <label className="text-xs font-medium text-slate-700">TER<input type="number" min="0" max="1" step="0.0001" value={entry.ter} onChange={(event) => updateCandidate(exposureIndex, candidateIndex, { ter: event.target.value })} required className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
                    <label className="text-xs font-medium text-slate-700">Tracking difference<input type="number" step="0.0001" value={entry.tracking_difference} onChange={(event) => updateCandidate(exposureIndex, candidateIndex, { tracking_difference: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
                    <label className="text-xs font-medium text-slate-700">Fondsgröße<input type="number" min="0" step="1" value={entry.fund_size} onChange={(event) => updateCandidate(exposureIndex, candidateIndex, { fund_size: event.target.value })} className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" /></label>
                  </div>
                  <div className="mt-3 flex flex-wrap gap-4 text-xs text-slate-700">
                    <label className="flex items-center gap-2"><input type="checkbox" checked={entry.savings_plan_eligible} onChange={(event) => updateCandidate(exposureIndex, candidateIndex, { savings_plan_eligible: event.target.checked })} /> Sparplanfähig</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={entry.tradable} onChange={(event) => updateCandidate(exposureIndex, candidateIndex, { tradable: event.target.checked })} /> Handelbar</label>
                    <label className="flex items-center gap-2"><input type="checkbox" checked={entry.active_for_new_purchases} onChange={(event) => updateCandidate(exposureIndex, candidateIndex, { active_for_new_purchases: event.target.checked })} /> Für Neukäufe aktiv</label>
                  </div>
                </div>
              ))}
              <button type="button" onClick={() => updateExposure(exposureIndex, { candidates: [...item.candidates, candidate()] })} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-800">+ Kandidat</button>
            </div>
          </article>
        ))}
      </section>

      <div className="flex flex-wrap gap-3">
        <button type="button" onClick={() => setExposures((current) => [...current, exposure()])} className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-800">+ Exposure</button>
        <button className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Mapping validieren & speichern</button>
      </div>
    </form>
  );
}
