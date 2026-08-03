# Hedge market data ingest

The hedge market-data path is independent of the portfolio workflow. Provider adapters fetch raw observations; the cockpit owns normalization, drawdown calculation, fingerprinting and persistence.

## Canonical observation

```json
{
  "observedAt": "2026-08-03T20:00:00.000Z",
  "source": "provider-name",
  "ndxClose": 28000.0,
  "ndxReferenceHigh": 28500.0,
  "vixClose": 18.2,
  "vxnClose": null,
  "riskFreeRate": null,
  "dividendYield": null
}
```

`ndxReferenceHigh` must be the reference high used by the configured hedge methodology and must be greater than or equal to `ndxClose`. The cockpit calculates `ndxDrawdownPercent`; callers do not supply it.

## Historical CSV backfill

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

The import is idempotent: existing source/timestamp or content identities are skipped by the database store.

## Automated n8n ingest

Endpoint:

```text
POST /api/market-snapshots/import
Authorization: Bearer <N8N_INGEST_TOKEN>
Content-Type: application/json
```

One observation can be posted directly. For batches use:

```json
{
  "observations": [
    {
      "observedAt": "2026-08-03T20:00:00.000Z",
      "source": "daily-provider-adapter",
      "ndxClose": 28000.0,
      "ndxReferenceHigh": 28500.0,
      "vixClose": 18.2
    }
  ]
}
```

The response contains `requested`, `inserted` and `skipped` counts.

## Provider boundary

Provider-specific fetching stays outside the rule engine. Initial recommended provider direction:

- VIX: FRED `VIXCLS`, daily close, sourced from CBOE.
- NDX: Nasdaq historical NDX data or a replaceable adapter with explicit provider identity.

A subsequent slice derives rolling/reference-high policy and VIX percentile from stored history, then passes only those deterministic inputs into the existing hedge rule engine.
