import { NormalizedMarketSnapshot } from './market-snapshot';

export type StressPeriodDefinition = {
  id: string;
  label: string;
  startsAt: string;
  endsAt: string;
};

export type StressPeriodSummary = {
  id: string;
  label: string;
  startsAt: string;
  endsAt: string;
  observationCount: number;
  minimumNdxClose: number | null;
  maximumDrawdownPercent: number | null;
  maximumVixClose: number | null;
  maximumVxnClose: number | null;
};

export const DEFAULT_STRESS_PERIODS: StressPeriodDefinition[] = [
  { id: 'dot-com', label: 'Dot-com decline', startsAt: '2000-03-10T00:00:00.000Z', endsAt: '2002-10-09T23:59:59.999Z' },
  { id: 'global-financial-crisis', label: 'Global financial crisis', startsAt: '2007-10-09T00:00:00.000Z', endsAt: '2009-03-09T23:59:59.999Z' },
  { id: 'covid-crash', label: 'COVID-19 crash', startsAt: '2020-02-19T00:00:00.000Z', endsAt: '2020-03-23T23:59:59.999Z' },
  { id: 'rate-shock-2022', label: '2022 rate shock', startsAt: '2021-11-19T00:00:00.000Z', endsAt: '2022-12-28T23:59:59.999Z' }
];

function validateDefinition(definition: StressPeriodDefinition): StressPeriodDefinition {
  const id = definition.id.trim();
  const label = definition.label.trim();
  const startsAt = new Date(definition.startsAt);
  const endsAt = new Date(definition.endsAt);
  if (!id || !label) throw new Error('Stress period id and label are required.');
  if (Number.isNaN(startsAt.getTime()) || Number.isNaN(endsAt.getTime())) {
    throw new Error(`Stress period ${id} must use valid timestamps.`);
  }
  if (startsAt.getTime() > endsAt.getTime()) throw new Error(`Stress period ${id} starts after it ends.`);
  return { id, label, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() };
}

export function summarizeStressPeriods(
  snapshots: NormalizedMarketSnapshot[],
  definitions: StressPeriodDefinition[] = DEFAULT_STRESS_PERIODS
): StressPeriodSummary[] {
  const normalized = definitions.map(validateDefinition);
  const ids = new Set<string>();
  for (const definition of normalized) {
    if (ids.has(definition.id)) throw new Error(`Duplicate stress period id: ${definition.id}.`);
    ids.add(definition.id);
  }

  return normalized.map(definition => {
    const observations = snapshots.filter(snapshot =>
      snapshot.observedAt >= definition.startsAt && snapshot.observedAt <= definition.endsAt
    );
    const finiteVix = observations.flatMap(snapshot => snapshot.vixClose == null ? [] : [snapshot.vixClose]);
    const finiteVxn = observations.flatMap(snapshot => snapshot.vxnClose == null ? [] : [snapshot.vxnClose]);
    return {
      ...definition,
      observationCount: observations.length,
      minimumNdxClose: observations.length ? Math.min(...observations.map(snapshot => snapshot.ndxClose)) : null,
      maximumDrawdownPercent: observations.length ? Math.min(...observations.map(snapshot => snapshot.ndxDrawdownPercent)) : null,
      maximumVixClose: finiteVix.length ? Math.max(...finiteVix) : null,
      maximumVxnClose: finiteVxn.length ? Math.max(...finiteVxn) : null
    };
  });
}
