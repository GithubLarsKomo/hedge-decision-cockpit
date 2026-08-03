# Hedge decision from stored market history

After daily market observations have been backfilled or ingested, the hedge path can run independently of the portfolio workflow.

## Prerequisites

For one `source`, the trailing two-calendar-year window must contain at least:

- 400 NDX observations;
- 200 non-null VIX observations;
- a VIX close on the selected/latest observation.

The cockpit derives the NDX reference high, NDX drawdown and VIX percentile from this stored history and passes only those values into the existing hedge rule engine.

## Run the latest stored observation

```text
POST /api/hedge-decisions/from-history
Authorization: Bearer <N8N_INGEST_TOKEN>
Content-Type: application/json
```

```json
{
  "source": "nasdaq-fred-daily",
  "hedgeCoveragePercent": 75
}
```

If `asOf` is omitted, the latest stored observation for that source is used.

To reconstruct a historical decision:

```json
{
  "source": "nasdaq-fred-daily",
  "asOf": "2020-03-20T00:00:00.000Z",
  "hedgeCoveragePercent": 75
}
```

A newly persisted Decision returns HTTP 201 and `created: true`. Replaying exactly the same source/as-of/signals/strategy configuration returns HTTP 200 and `created: false` with the existing Decision ID.

## Determinism and safety

The decision input fingerprint includes the source, selected observation, derived NDX/VIX signals, hedge coverage and complete versioned strategy configuration. The existing `evaluateDecision` function remains the only hedge rule engine.

This endpoint produces and records a recommendation only. It does not place, prepare or transmit a broker order and has no portfolio workflow dependency.

## Recommended n8n sequence

1. Fetch the daily NDX close from the configured NDX provider.
2. Fetch the daily VIX close (for example FRED `VIXCLS`).
3. POST the combined raw observation to `/api/market-observations/import`.
4. POST `{ "source": "<same-source>" }` to `/api/hedge-decisions/from-history`.
5. Use the returned action/severity for notification or dashboard refresh only; keep execution human-controlled.
