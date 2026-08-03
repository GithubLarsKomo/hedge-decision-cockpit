# Hedge market data ingest

The hedge market-data path is independent of the portfolio workflow. Provider adapters fetch raw observations; the cockpit owns rolling-reference-high policy, drawdown calculation, fingerprinting and persistence.

## Preferred raw daily observation

For automated daily ingestion, callers provide only the observed market values:

```json
{
  "observedAt": "2026-08-03T20:00:00.000Z",
  "source": "nasdaq-fred-daily",
  "ndxClose": 28000.0,
  "vixClose": 18.2,
  "vxnClose": null,
  "riskFreeRate": null,
  "dividendYield": null
}
```

Post this contract to:

```text
POST /api/market-observations/import
Authorization: Bearer <N8N_INGEST_TOKEN>
Content-Type: application/json
```

The caller must **not** provide `ndxReferenceHigh`. The cockpit derives it from NDX closes for the same `source` in the trailing two-calendar-year window, including earlier observations in the same batch. The first row in a fresh historical backfill therefore uses its own NDX close as the initial reference high.

For batches:

```json
{
  "observations": [
    {
      "observedAt": "2026-08-03T20:00:00.000Z",
      "source": "nasdaq-fred-daily",
      "ndxClose": 28000.0,
      "vixClose": 18.2
    },
    {
      "observedAt": "2026-08-04T20:00:00.000Z",
      "source": "nasdaq-fred-daily",
      "ndxClose": 28125.0,
      "vixClose": 17.8
    }
  ]
}
```

The response contains `requested`, `inserted` and `skipped` counts. Re-import is idempotent through the existing MarketSnapshot identities.

## Enriched canonical snapshot ingest

The previous enriched endpoint remains supported for compatibility:

```text
POST /api/market-snapshots/import
Authorization: Bearer <N8N_INGEST_TOKEN>
Content-Type: application/json
```

Its observation contract includes an explicit `ndxReferenceHigh`:

```json
{
  "observedAt": "2026-08-03T20:00:00.000Z",
  "source": "provider-name",
  "ndxClose": 28000.0,
  "ndxReferenceHigh": 28500.0,
  "vixClose": 18.2
}
```

Use the raw endpoint for new automation. The enriched endpoint is useful for controlled migrations or externally pre-derived historical datasets.

## Historical CSV backfill

The existing CSV CLI imports enriched snapshots.

Required columns:

```text
observedAt,ndxClose,ndxReferenceHigh
```

Optional columns:

```text
vixClose,vxnClose,riskFreeRate,dividendYield
```

Example:

```csv
observedAt,ndxClose,ndxReferenceHigh,vixClose
2020-02-19T00:00:00Z,9718.73,9718.73,14.38
2020-03-20T00:00:00Z,6994.29,9817.18,66.04
```

Run from a development checkout with `DATABASE_URL` configured:

```bash
npx tsx scripts/import-market-snapshots.ts history.csv nasdaq-fred
```

For semicolon or tab separated data add `semicolon` or `tab` as the third argument.

For a raw historical backfill without precomputing reference highs, send chronological or unordered observations as a batch to `/api/market-observations/import`; the cockpit sorts each source chronologically and derives the rolling highs before persistence.

## Derived hedge signals

The canonical signal derivation preserves the original n8n methodology explicitly:

- trailing two-calendar-year window;
- NDX reference high = maximum NDX close in that window;
- drawdown = current NDX close divided by reference high minus one;
- VIX percentile = percentage of non-null VIX closes in the same window that are less than or equal to the current VIX;
- at least 400 NDX and 200 VIX observations are required before producing a rule-engine input.

Early backfill rows may be persisted with less history; the minimums apply only when deriving a hedge decision signal.

## Provider boundary

Provider-specific fetching stays outside the rule engine. Initial recommended provider direction:

- VIX: FRED `VIXCLS`, daily close, sourced from CBOE.
- NDX: Nasdaq historical NDX data or a replaceable adapter with explicit provider identity.

The provider adapter should combine the daily NDX and VIX observations into one raw payload and post it to `/api/market-observations/import`. The existing hedge rule engine remains the only component that converts derived signals into a recommendation.
