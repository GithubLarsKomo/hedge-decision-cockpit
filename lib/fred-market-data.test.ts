import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildFredObservationsUrl,
  defaultFredSyncRange,
  FRED_MARKET_SOURCE,
  joinFredMarketObservations,
  parseFredSeriesObservations,
  syncFredMarketData,
  type FredFetch
} from './fred-market-data';
import type { RawMarketObservationStore } from './raw-market-observation-ingest';

test('parses FRED observations and safely skips missing dot values', () => {
  const rows = parseFredSeriesObservations({ observations: [
    { date: '2026-08-01', value: '.' },
    { date: '2026-08-03', value: '28123.45' }
  ] }, 'NASDAQ100');
  assert.deepEqual(rows, [{ date: '2026-08-03', value: 28123.45 }]);
});

test('joins only dates that have both NDX and VIX closes', () => {
  const rows = joinFredMarketObservations(
    [
      { date: '2026-08-01', value: 100 },
      { date: '2026-08-02', value: 101 },
      { date: '2026-08-03', value: 102 }
    ],
    [
      { date: '2026-08-02', value: 20 },
      { date: '2026-08-03', value: 21 },
      { date: '2026-08-04', value: 22 }
    ]
  );
  assert.deepEqual(rows, [
    { observedAt: '2026-08-02T00:00:00.000Z', source: FRED_MARKET_SOURCE, ndxClose: 101, vixClose: 20 },
    { observedAt: '2026-08-03T00:00:00.000Z', source: FRED_MARKET_SOURCE, ndxClose: 102, vixClose: 21 }
  ]);
});

test('builds the official FRED observations request with explicit range', () => {
  const url = new URL(buildFredObservationsUrl('VIXCLS', 'abc123', {
    observationStart: '2026-07-01',
    observationEnd: '2026-08-03'
  }));
  assert.equal(url.hostname, 'api.stlouisfed.org');
  assert.equal(url.searchParams.get('series_id'), 'VIXCLS');
  assert.equal(url.searchParams.get('api_key'), 'abc123');
  assert.equal(url.searchParams.get('file_type'), 'json');
  assert.equal(url.searchParams.get('observation_start'), '2026-07-01');
  assert.equal(url.searchParams.get('observation_end'), '2026-08-03');
});

test('default daily sync looks back ten calendar days', () => {
  assert.deepEqual(defaultFredSyncRange(new Date('2026-08-03T12:00:00Z')), {
    observationStart: '2026-07-24',
    observationEnd: '2026-08-03'
  });
});

test('sync fetches both FRED series, joins common dates and persists canonically', async () => {
  const requestedUrls: string[] = [];
  const fetcher: FredFetch = async url => {
    requestedUrls.push(url);
    const series = new URL(url).searchParams.get('series_id');
    return {
      ok: true,
      status: 200,
      async json() {
        return series === 'NASDAQ100'
          ? { observations: [
              { date: '2026-08-01', value: '100' },
              { date: '2026-08-02', value: '110' },
              { date: '2026-08-03', value: '90' }
            ] }
          : { observations: [
              { date: '2026-08-01', value: '.' },
              { date: '2026-08-02', value: '18' },
              { date: '2026-08-03', value: '25' }
            ] };
      }
    };
  };

  const created: Array<{ ndxClose: number; ndxReferenceHigh: number; vixClose: number | null }> = [];
  const store: RawMarketObservationStore = {
    marketSnapshot: {
      async findMany() { return []; },
      async createMany(args) {
        created.push(...args.data.map(row => ({
          ndxClose: row.ndxClose,
          ndxReferenceHigh: row.ndxReferenceHigh,
          vixClose: row.vixClose
        })));
        return { count: args.data.length };
      }
    }
  };

  const result = await syncFredMarketData(store, {
    observationStart: '2026-08-01',
    observationEnd: '2026-08-03'
  }, { fetcher, apiKey: 'secret' });

  assert.equal(requestedUrls.length, 2);
  assert.deepEqual(result, {
    source: FRED_MARKET_SOURCE,
    observationStart: '2026-08-01',
    observationEnd: '2026-08-03',
    ndxFetched: 3,
    vixFetched: 2,
    eligible: 2,
    requested: 2,
    inserted: 2,
    skipped: 0
  });
  assert.deepEqual(created, [
    { ndxClose: 110, ndxReferenceHigh: 110, vixClose: 18 },
    { ndxClose: 90, ndxReferenceHigh: 110, vixClose: 25 }
  ]);
});

test('rejects invalid ranges and missing API key', async () => {
  const store = {
    marketSnapshot: {
      async findMany() { return []; },
      async createMany() { return { count: 0 }; }
    }
  } satisfies RawMarketObservationStore;

  await assert.rejects(
    () => syncFredMarketData(store, { observationStart: '2026-08-04', observationEnd: '2026-08-03' }, { apiKey: 'x' }),
    /must not be after/
  );
  await assert.rejects(
    () => syncFredMarketData(store, { observationStart: '2026-08-01', observationEnd: '2026-08-03' }, {
      apiKey: '',
      fetcher: async () => { throw new Error('should not fetch'); }
    }),
    /FRED_API_KEY is required/
  );
});
