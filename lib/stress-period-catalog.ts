export type StressPeriodId =
  | 'dot-com-bust'
  | 'global-financial-crisis'
  | 'covid-crash'
  | 'inflation-shock-2022';

export type StressPeriod = {
  id: StressPeriodId;
  label: string;
  startsOn: string;
  endsOn: string;
};

export type DatasetCoverage = {
  firstObservationAt: string;
  lastObservationAt: string;
};

export type StressPeriodCoverage = StressPeriod & {
  covered: boolean;
  missingBeforeDays: number;
  missingAfterDays: number;
};

const DAY_MS = 24 * 60 * 60 * 1000;

export const STRESS_PERIODS: readonly StressPeriod[] = [
  {
    id: 'dot-com-bust',
    label: 'Dot-com bust',
    startsOn: '2000-03-10T00:00:00.000Z',
    endsOn: '2002-10-09T23:59:59.999Z'
  },
  {
    id: 'global-financial-crisis',
    label: 'Global financial crisis',
    startsOn: '2008-09-01T00:00:00.000Z',
    endsOn: '2009-03-31T23:59:59.999Z'
  },
  {
    id: 'covid-crash',
    label: 'COVID-19 crash',
    startsOn: '2020-02-19T00:00:00.000Z',
    endsOn: '2020-04-30T23:59:59.999Z'
  },
  {
    id: 'inflation-shock-2022',
    label: '2022 inflation and rates shock',
    startsOn: '2022-01-03T00:00:00.000Z',
    endsOn: '2022-12-30T23:59:59.999Z'
  }
] as const;

function parseTimestamp(value: string, field: string): number {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) throw new Error(`Invalid ${field}.`);
  return timestamp;
}

function missingDays(milliseconds: number): number {
  return milliseconds <= 0 ? 0 : Math.ceil(milliseconds / DAY_MS);
}

export function assessStressPeriodCoverage(
  coverage: DatasetCoverage,
  periods: readonly StressPeriod[] = STRESS_PERIODS
): StressPeriodCoverage[] {
  const firstObservation = parseTimestamp(coverage.firstObservationAt, 'firstObservationAt');
  const lastObservation = parseTimestamp(coverage.lastObservationAt, 'lastObservationAt');
  if (lastObservation < firstObservation) {
    throw new Error('lastObservationAt must not be before firstObservationAt.');
  }

  const ids = new Set<string>();
  return periods.map(period => {
    if (ids.has(period.id)) throw new Error(`Duplicate stress period id: ${period.id}.`);
    ids.add(period.id);

    const startsOn = parseTimestamp(period.startsOn, `startsOn for ${period.id}`);
    const endsOn = parseTimestamp(period.endsOn, `endsOn for ${period.id}`);
    if (endsOn < startsOn) throw new Error(`Stress period ${period.id} ends before it starts.`);

    const missingBeforeDays = missingDays(startsOn - firstObservation);
    const missingAfterDays = missingDays(lastObservation - endsOn);

    return {
      ...period,
      covered: firstObservation <= startsOn && lastObservation >= endsOn,
      missingBeforeDays: firstObservation > startsOn ? missingDays(firstObservation - startsOn) : 0,
      missingAfterDays: lastObservation < endsOn ? missingDays(endsOn - lastObservation) : 0
    };
  });
}
