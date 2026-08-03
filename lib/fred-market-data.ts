import {
  ingestRawMarketObservations,
  type RawMarketObservationInput,
  type RawMarketObservationStore
} from './raw-market-observation-ingest';

export const FRED_NDX_SERIES = 'NASDAQ100';
export const FRED_VIX_SERIES = 'VIXCLS';
export const FRED_MARKET_SOURCE = 'fred:NASDAQ100+VIXCLS';
const FRED_OBSERVATIONS_URL = 'https://api.stlouisfed.org/fred/series/observations';

export type FredSeriesObservation = {
  date: string;
  value: number;
};

export type FredSyncOptions = {
  observationStart?: string;
  observationEnd?: string;
};

export type FredSyncResult = {
  source: string;
  observationStart: string;
  observationEnd: string;
  ndxFetched: number;
  vixFetched: number;
  eligible: number;
  requested: number;
  inserted: number;
  skipped: number;
};

export type FredFetch = (url: string) => Promise<{
  ok: boolean;
  status: number;
  json(): Promise<unknown>;
}>;

function isoDate(value: string, name: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${name} must use YYYY-MM-DD.`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw new Error(`${name} must be a valid calendar date.`);
  }
  return value;
}

export function defaultFredSyncRange(now = new Date()): Required<FredSyncOptions> {
  if (Number.isNaN(now.getTime())) throw new Error('now must be a valid date.');
  const end = new Date(now.getTime());
  const start = new Date(now.getTime());
  start.setUTCDate(start.getUTCDate() - 10);
  return {
    observationStart: start.toISOString().slice(0, 10),
    observationEnd: end.toISOString().slice(0, 10)
  };
}

export function normalizeFredSyncRange(
  options: FredSyncOptions,
  now = new Date()
): Required<FredSyncOptions> {
  const defaults = defaultFredSyncRange(now);
  const observationStart = isoDate(options.observationStart ?? defaults.observationStart, 'observationStart');
  const observationEnd = isoDate(options.observationEnd ?? defaults.observationEnd, 'observationEnd');
  if (observationStart > observationEnd) throw new Error('observationStart must not be after observationEnd.');
  return { observationStart, observationEnd };
}

export function parseFredSeriesObservations(body: unknown, seriesId: string): FredSeriesObservation[] {
  if (!body || typeof body !== 'object' || !Array.isArray((body as { observations?: unknown }).observations)) {
    throw new Error(`FRED ${seriesId} response does not contain observations.`);
  }

  const result: FredSeriesObservation[] = [];
  for (const raw of (body as { observations: unknown[] }).observations) {
    if (!raw || typeof raw !== 'object') throw new Error(`FRED ${seriesId} returned a malformed observation.`);
    const value = raw as Record<string, unknown>;
    if (typeof value.date !== 'string') throw new Error(`FRED ${seriesId} observation is missing a date.`);
    const date = isoDate(value.date, `FRED ${seriesId} date`);
    if (value.value === '.') continue;
    if (typeof value.value !== 'string') throw new Error(`FRED ${seriesId} observation value must be a string.`);
    const numeric = Number(value.value);
    if (!Number.isFinite(numeric) || numeric <= 0) {
      throw new Error(`FRED ${seriesId} returned an invalid value for ${date}.`);
    }
    result.push({ date, value: numeric });
  }

  result.sort((a, b) => a.date.localeCompare(b.date));
  return result;
}

export function joinFredMarketObservations(
  ndx: FredSeriesObservation[],
  vix: FredSeriesObservation[],
  source = FRED_MARKET_SOURCE
): RawMarketObservationInput[] {
  const vixByDate = new Map(vix.map(observation => [observation.date, observation.value]));
  return ndx
    .filter(observation => vixByDate.has(observation.date))
    .map(observation => ({
      observedAt: `${observation.date}T00:00:00.000Z`,
      source,
      ndxClose: observation.value,
      vixClose: vixByDate.get(observation.date)!
    }));
}

export function buildFredObservationsUrl(
  seriesId: string,
  apiKey: string,
  range: Required<FredSyncOptions>
): string {
  const key = apiKey.trim();
  if (!key) throw new Error('FRED_API_KEY is required.');
  const url = new URL(FRED_OBSERVATIONS_URL);
  url.searchParams.set('series_id', seriesId);
  url.searchParams.set('api_key', key);
  url.searchParams.set('file_type', 'json');
  url.searchParams.set('observation_start', range.observationStart);
  url.searchParams.set('observation_end', range.observationEnd);
  url.searchParams.set('sort_order', 'asc');
  return url.toString();
}

export async function fetchFredSeries(
  fetcher: FredFetch,
  seriesId: string,
  apiKey: string,
  range: Required<FredSyncOptions>
): Promise<FredSeriesObservation[]> {
  const response = await fetcher(buildFredObservationsUrl(seriesId, apiKey, range));
  if (!response.ok) throw new Error(`FRED ${seriesId} request failed with HTTP ${response.status}.`);
  return parseFredSeriesObservations(await response.json(), seriesId);
}

export async function syncFredMarketData(
  store: RawMarketObservationStore,
  options: FredSyncOptions = {},
  dependencies: { fetcher?: FredFetch; apiKey?: string; now?: Date } = {}
): Promise<FredSyncResult> {
  const range = normalizeFredSyncRange(options, dependencies.now ?? new Date());
  const apiKey = dependencies.apiKey ?? process.env.FRED_API_KEY ?? '';
  const fetcher: FredFetch = dependencies.fetcher ?? (url => fetch(url));

  const [ndx, vix] = await Promise.all([
    fetchFredSeries(fetcher, FRED_NDX_SERIES, apiKey, range),
    fetchFredSeries(fetcher, FRED_VIX_SERIES, apiKey, range)
  ]);
  const observations = joinFredMarketObservations(ndx, vix);
  const persisted = observations.length === 0
    ? { requested: 0, inserted: 0, skipped: 0 }
    : await ingestRawMarketObservations(store, { observations });

  return {
    source: FRED_MARKET_SOURCE,
    observationStart: range.observationStart,
    observationEnd: range.observationEnd,
    ndxFetched: ndx.length,
    vixFetched: vix.length,
    eligible: observations.length,
    ...persisted
  };
}
