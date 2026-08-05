# FRED market-data updates

The cockpit uses the FRED API for both required daily series:

- `NASDAQ100` — NASDAQ-100 daily close, source Nasdaq, Inc.
- `VIXCLS` — CBOE VIX daily close, source Chicago Board Options Exchange.

Both series are joined by observation date and passed to the canonical `MarketSnapshot` ingest path with source identity `fred:NASDAQ100+VIXCLS`. The provider layer remains separate from the hedge rule engine.

## 1. FRED API key

Create a personal FRED API key according to the official FRED API documentation and store it in `.env.docker`:

```dotenv
FRED_API_KEY=<your-key>
```

The key is never persisted in the database or sent to the browser.

## 2. Automatic Docker acquisition — canonical runtime path

A normal Docker Compose start now launches two runtime containers:

```text
hedge-decision-app
hedge-decision-fred-scheduler
```

The scheduler does **not** contain a second FRED implementation and does not access SQLite directly. It waits until the app is healthy and then calls the existing authenticated endpoint:

```text
POST /api/market-data/fred/sync
```

with an empty JSON object. The app therefore continues to use the canonical FRED provider and `MarketSnapshot` ingest path.

Default schedule:

```dotenv
FRED_SYNC_TIME=22:30
FRED_SYNC_TIMEZONE=Europe/Berlin
FRED_SYNC_POLL_SECONDS=60
```

`FRED_SYNC_TIME` is interpreted in `FRED_SYNC_TIMEZONE`. `tzdata` is installed in the runtime image, so `Europe/Berlin` follows daylight-saving changes automatically.

The scheduler runs once per local calendar day after the configured time. Its last successful scheduled date is stored in the ignored local file:

```text
data/.fred-sync-last-date
```

This small state file prevents repeated API calls after a container restart on the same day. Even without the state file, market-data persistence remains idempotent because duplicate observations are skipped by the canonical ingest path.

The automatic job synchronizes **market data only**. It deliberately does not create a hedge Decision, because current hedge coverage may be unknown and position recommendations remain human-controlled.

### Verify the scheduler

After building the stack:

```powershell
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs -f fred-scheduler
```

A deterministic one-off smoke run can be triggered without waiting for the scheduled time:

```powershell
docker compose --env-file .env.docker run --rm fred-scheduler --once
```

The command calls the same internal API endpoint and exits after one sync. Running it repeatedly is safe; already persisted observations are reported as skipped.

## 3. Manual local update path

The direct host CLI remains useful for recovery, explicit backfills and diagnostics. Install dependencies once:

```powershell
npm install
```

Then synchronize the canonical overlapping ten-day window directly from the repository:

```powershell
npm run update:market-data -- --env-file .env.docker
```

This command talks to FRED and SQLite directly. The Next.js server and n8n do not need to be running.

The ten-day overlap intentionally covers weekends, holidays and provider publication delays. Repeated execution is idempotent.

### Explicit historical range

```powershell
npm run update:market-data -- --env-file .env.docker --start 1990-01-02
```

Optional end date:

```powershell
npm run update:market-data -- --env-file .env.docker --start 2020-01-01 --end 2020-12-31
```

### Also create/replay a hedge decision manually

By default the command updates **market data only**. This avoids creating an automated position recommendation when the current hedge coverage is unknown.

To run the decision engine as well:

```powershell
npm run update:market-data -- --env-file .env.docker --decision
```

If hedge coverage is known, pass it explicitly:

```powershell
npm run update:market-data -- --env-file .env.docker --hedge-coverage 0
```

Supplying `--hedge-coverage` automatically enables decision creation.

## 4. Host scheduler alternative

The Docker sidecar is the canonical runtime automation. If Docker is not kept running continuously, the same market-only CLI can instead be scheduled by the host operating system.

For Windows Task Scheduler, a local wrapper can contain:

```cmd
@echo off
cd /d C:\programming\hedge-decision-cockpit
call npm.cmd run update:market-data -- --env-file .env.docker
```

Schedule it after the regular US close, for example at 22:30 Europe/Berlin. Do not run both a host scheduler and the Docker scheduler unless duplicate harmless API/CLI invocations are intentional.

For Linux/macOS, the equivalent cron entry is conceptually:

```cron
30 22 * * * cd /path/to/hedge-decision-cockpit && npm run update:market-data -- --env-file .env.docker
```

Ensure the host timezone is the intended scheduling timezone.

## 5. Existing HTTP API remains available

The authenticated endpoints remain for integrations:

```text
POST /api/market-data/fred/sync
POST /api/hedge-decisions/from-history
```

They use `Authorization: Bearer <N8N_INGEST_TOKEN>` for backward compatibility. The token name is historical; the endpoints do not require n8n.

The Docker scheduler reuses this internal API authentication and therefore needs `N8N_INGEST_TOKEN`, but it does not need its own `FRED_API_KEY`; the key remains only in the app container.

## 6. Optional n8n workflow

The maintained optional workflow is:

```text
n8n/hedge-market-data-fred-workflow.json
```

It is retained only for compatibility/integration scenarios. New local Docker installations do not need n8n for automatic market-data acquisition.

The workflow deliberately contains **no copy of the hedge decision rules**. It calls the server-side FRED sync endpoint and then the server-side stored-history Decision endpoint. `lib/decision-engine.ts` together with `lib/strategy-config.ts` remains the single source of truth for thresholds, rule priority and rule version.

The former Yahoo/Code-node workflow and its duplicated `n8n/decision-engine.js` implementation were removed to prevent rule drift.

## Provider attribution and data terms

FRED identifies `NASDAQ100` as Nasdaq, Inc. data and `VIXCLS` as Chicago Board Options Exchange data. Review applicable provider/FRED terms before redistributing the underlying historical data outside personal use. The cockpit stores provider identity in the `source` field so provenance remains explicit.

Provider references:

- https://fred.stlouisfed.org/series/NASDAQ100
- https://fred.stlouisfed.org/series/VIXCLS
- https://fred.stlouisfed.org/docs/api/fred/series_observations.html
