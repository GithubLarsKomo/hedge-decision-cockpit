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

## 2. Recommended local update path — no n8n required

Install dependencies once:

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

### Also create/replay a hedge decision

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

## 3. Windows Task Scheduler — n8n-free automation

For a simple daily data refresh, schedule the market-only command on weekdays after the regular US close, for example at **22:30 Europe/Berlin**.

Create `scripts/update-market-data.cmd` locally if desired:

```cmd
@echo off
cd /d C:\programming\hedge-decision-cockpit
call npm.cmd run update:market-data -- --env-file .env.docker
```

Then create a Task Scheduler task that runs that `.cmd` file Monday through Friday at 22:30.

Because synchronization always overlaps ten calendar days, a delayed FRED publication is picked up by a later run without duplicating prior observations.

For Linux/macOS, the equivalent cron entry is conceptually:

```cron
30 22 * * 1-5 cd /path/to/hedge-decision-cockpit && npm run update:market-data -- --env-file .env.docker
```

Ensure the host timezone is the intended scheduling timezone.

## 4. Existing HTTP API remains available

The authenticated endpoints remain for integrations:

```text
POST /api/market-data/fred/sync
POST /api/hedge-decisions/from-history
```

They still use `Authorization: Bearer <N8N_INGEST_TOKEN>` for backward compatibility. The token name is historical; the endpoints do not require n8n.

## 5. Optional n8n workflow

The maintained optional workflow is:

```text
n8n/hedge-market-data-fred-workflow.json
```

It can continue to run at 22:30 Europe/Berlin on weekdays, but it is no longer the canonical requirement for local market-data maintenance.

The workflow deliberately contains **no copy of the hedge decision rules**. It calls the server-side FRED sync endpoint and then the server-side stored-history Decision endpoint. `lib/decision-engine.ts` together with `lib/strategy-config.ts` remains the single source of truth for thresholds, rule priority and rule version.

The former Yahoo/Code-node workflow and its duplicated `n8n/decision-engine.js` implementation were removed to prevent rule drift.

## Provider attribution and data terms

FRED identifies `NASDAQ100` as Nasdaq, Inc. data and `VIXCLS` as Chicago Board Options Exchange data. Review applicable provider/FRED terms before redistributing the underlying historical data outside personal use. The cockpit stores provider identity in the `source` field so provenance remains explicit.

Provider references:

- https://fred.stlouisfed.org/series/NASDAQ100
- https://fred.stlouisfed.org/series/VIXCLS
- https://fred.stlouisfed.org/docs/api/fred/series_observations.html
