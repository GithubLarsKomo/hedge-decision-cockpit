# FRED market-data automation

The initial automated hedge data provider uses the FRED API for both required daily series:

- `NASDAQ100` — NASDAQ-100 daily close, source Nasdaq, Inc.
- `VIXCLS` — CBOE VIX daily close, source Chicago Board Options Exchange.

The provider layer is separate from the hedge rule engine. Both series are joined by observation date and then passed to the canonical raw `MarketSnapshot` ingest path with source identity `fred:NASDAQ100+VIXCLS`.

## 1. Create a FRED API key

Register a personal FRED API key according to the official FRED API documentation:

https://fred.stlouisfed.org/docs/api/api_key.html

The key is stored only as an application environment variable and is never persisted in the database or sent to the browser.

For Docker, add it to `.env.docker`:

```dotenv
FRED_API_KEY=<your-key>
```

Then recreate the application container so the new environment variable is available:

```bash
docker compose --env-file .env.docker up -d --build
```

## 2. Initial historical backfill

The common NDX/VIX history begins with the VIX series in 1990. To import the full common history, call:

```bash
curl -X POST http://localhost:3000/api/market-data/fred/sync \
  -H "Authorization: Bearer <N8N_INGEST_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"observationStart":"1990-01-02"}'
```

On Windows PowerShell with `curl.exe`:

```powershell
curl.exe --noproxy "*" -X POST http://localhost:3000/api/market-data/fred/sync `
  -H "Authorization: Bearer <N8N_INGEST_TOKEN>" `
  -H "Content-Type: application/json" `
  -d '{"observationStart":"1990-01-02"}'
```

The response reports the number of fetched NDX and VIX observations, common eligible dates, inserted rows and idempotently skipped rows.

Missing FRED values represented as `.` are ignored. Only dates for which both NDX and VIX closes exist are ingested.

## 3. Daily/recent synchronization

Calling the same endpoint with an empty JSON body synchronizes the latest ten calendar days:

```bash
curl -X POST http://localhost:3000/api/market-data/fred/sync \
  -H "Authorization: Bearer <N8N_INGEST_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{}'
```

The ten-day overlap intentionally covers weekends, holidays and provider publication delays. Repeated synchronization is safe because `MarketSnapshot` persistence is idempotent.

## 4. Generate the hedge decision

After data synchronization, run the existing hedge rule engine from stored history:

```bash
curl -X POST http://localhost:3000/api/hedge-decisions/from-history \
  -H "Authorization: Bearer <N8N_INGEST_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{"source":"fred:NASDAQ100+VIXCLS"}'
```

The cockpit derives the trailing two-year NDX high, drawdown and VIX percentile, then calls the existing versioned `evaluateDecision` engine. Replaying an unchanged latest observation returns the existing Decision rather than creating a duplicate.

## 5. n8n automation

Import:

```text
n8n/hedge-market-data-fred-workflow.json
```

Configure these n8n environment variables:

```text
HEDGE_COCKPIT_URL=http://host.docker.internal:3000
N8N_INGEST_TOKEN=<same token as the cockpit>
```

If n8n runs outside Docker, set `HEDGE_COCKPIT_URL` to the address from which n8n can reach the cockpit.

The example workflow runs on weekdays at **22:30 Europe/Berlin**, after the regular US market close. It first calls the FRED sync endpoint and then asks the cockpit to run the latest stored hedge decision. The synchronization is overlapping and idempotent, so a provider publication delay results in a replay of the previous common observation rather than a duplicated decision. If FRED has not published the current trading day's values by 22:30, the next scheduled run will pick them up automatically through the ten-day overlap.

## Provider attribution and data terms

FRED identifies `NASDAQ100` as Nasdaq, Inc. data and `VIXCLS` as Chicago Board Options Exchange data. The FRED series pages carry provider copyright and attribution notices. Review the applicable provider/FRED terms before redistributing the underlying historical data outside personal use. The cockpit stores provider identity in the source field so provenance remains explicit.

Provider references:

- https://fred.stlouisfed.org/series/NASDAQ100
- https://fred.stlouisfed.org/series/VIXCLS
- https://fred.stlouisfed.org/docs/api/fred/series_observations.html
