# MariaDB -> SQLite migration

The cockpit now uses a local SQLite file for normal operation. MariaDB is retained only as a disabled Docker Compose migration profile so an existing installation can transfer its data once and then stop running a database server.

## What is preserved

The migration copies all current Prisma models, including:

- `MarketSnapshot` history and content hashes;
- `Decision` rows, rule versions, input fingerprints and triggered rules;
- portfolio and hedge position snapshots;
- execution audit records;
- imported portfolio snapshots, ETF mapping artifacts/reviews and monthly completion records.

IDs and foreign-key relationships are preserved. After the copy, source and SQLite row counts are compared table by table. The old Docker volume is **not** deleted automatically.

The npm migration command runs with `TZ=UTC` on every platform so legacy MariaDB `DATETIME` values retain the same UTC interpretation when written to SQLite.

## One-time migration on Windows / PowerShell

From the repository directory:

```powershell
cd C:\programming\hedge-decision-cockpit
git checkout main
git pull
npm install
```

Stop the old stack and remove obsolete containers, but **do not use `-v`** because the legacy MariaDB volume is the migration source:

```powershell
docker compose --env-file .env.docker down --remove-orphans
```

Start the migration-only legacy database and wait until its healthcheck is green:

```powershell
docker compose --env-file .env.docker --profile migration up -d --wait legacy-db
```

Then run the migration:

```powershell
npm run migrate:mariadb-to-sqlite -- --env-file .env.docker
```

The script will:

1. generate the SQLite Prisma client and apply the schema to `data/hedge.db`;
2. ensure `legacy-db` is running from the Docker Compose `migration` profile using the existing `hedge-decision-db-data` volume;
3. copy every supported table in dependency-safe order;
4. compare source and SQLite row counts;
5. stop `legacy-db` again unless `--keep-legacy-running` was supplied.

A successful run ends with a JSON verification object where every table has identical `source` and `sqlite` counts.

For the installation used during development, the expected important counts immediately before migration were approximately:

```text
MarketSnapshot: 9209
Decision: 3
```

Treat the script output as authoritative; other tables may contain additional rows.

## Start the SQLite cockpit

After successful verification:

```powershell
docker compose --env-file .env.docker up -d --build
docker compose --env-file .env.docker ps
curl.exe --noproxy "*" http://localhost:3000/api/health
```

Normal `docker compose up` now starts only the application. The database is the bind-mounted file:

```text
data/hedge.db
```

Back it up like any other local file. If SQLite WAL sidecar files exist while the app is running, stop the app before making a simple file copy:

```powershell
docker compose --env-file .env.docker stop app
Copy-Item data\hedge.db data\hedge-backup.db
docker compose --env-file .env.docker start app
```

## Post-migration beta dry-run

Do not delete the MariaDB rollback volume after the row-count check alone. Treat the following operator run as the acceptance gate for the migration.

### 1. Verify runtime shape

```powershell
docker compose --env-file .env.docker ps
```

Expected normal state:

- `hedge-decision-app` is running and healthy;
- `legacy-db` is not running;
- `data\hedge.db` exists on the host.

Re-run the health endpoint:

```powershell
curl.exe --noproxy "*" http://localhost:3000/api/health
```

### 2. Verify migrated history in the UI

Open:

```text
http://localhost:3000
```

Check that the dashboard shows the expected latest historical Decision and that `/monthly` still exposes the migrated portfolio/review/completion context where such records existed before migration.

If a value looks wrong, stop here and retain the legacy MariaDB volume unchanged.

### 3. Run a market-data-only FRED update

From the repository root:

```powershell
npm run update:market-data -- --env-file .env.docker
```

Acceptance:

- the command completes without requiring n8n;
- recent FRED observations are inserted or idempotently skipped;
- no new Decision is created by this default command.

Run the same command a second time. The overlapping window must replay idempotently rather than create duplicate `MarketSnapshot` rows.

### 4. Run the canonical Decision path deliberately

If the current hedge coverage is known, prefer passing it explicitly:

```powershell
npm run update:market-data -- --env-file .env.docker --hedge-coverage 70
```

Replace `70` with the actual current coverage.

If coverage is intentionally unknown, use:

```powershell
npm run update:market-data -- --env-file .env.docker --decision
```

and verify that the UI clearly presents the existing market-context-only NULL-coverage semantics.

Acceptance:

- the Decision reports strategy/rule version `2.1.0`;
- the latest market data source is `fred:NASDAQ100+VIXCLS`;
- action/severity/explanation are internally consistent;
- repeating the exact same input reuses the deterministic Decision rather than creating an uncontrolled duplicate.

### 5. Complete one browser monthly workflow

Use the normal browser flow to exercise the migrated persistence end to end:

1. open `/monthly`;
2. verify or create the current portfolio snapshot;
3. inspect the ETF mapping and complete any required Human Review;
4. inspect the current hedge Decision;
5. complete the explicit monthly Decision review;
6. record the monthly completion.

Acceptance:

- no terminal command or direct database edit is required for the normal operator path;
- stale snapshot/Decision protection still rejects an outdated completion context;
- the completed run is visible as the current completion afterward.

### 6. Create the first accepted SQLite backup

After the successful browser run:

```powershell
docker compose --env-file .env.docker stop app
Copy-Item data\hedge.db data\hedge-beta-accepted.db
docker compose --env-file .env.docker start app
```

Keep this backup separately from the live file.

### 7. Migration acceptance decision

The migration can be considered accepted only when all of the following are true:

- source/target row counts matched during migration;
- application health is green using SQLite only;
- migrated historical state is visible and plausible;
- repeated market-data synchronization is idempotent;
- a canonical strategy 2.1.0 Decision can be generated/replayed;
- one complete browser monthly workflow succeeds;
- an accepted SQLite backup exists.

Until then, keep the legacy MariaDB volume as the rollback source.

## Safety / rollback

Do not delete the old Docker volume until the SQLite cockpit has been manually verified. The migration utility intentionally leaves it untouched.

To inspect migration containers/volumes:

```powershell
docker compose --env-file .env.docker --profile migration ps -a
docker volume ls | Select-String "hedge-decision-db-data"
```

If the target migration is interrupted, stop the app, remove only the incomplete SQLite target and rerun:

```powershell
Remove-Item data\hedge.db -ErrorAction SilentlyContinue
Remove-Item data\hedge.db-shm -ErrorAction SilentlyContinue
Remove-Item data\hedge.db-wal -ErrorAction SilentlyContinue
docker compose --env-file .env.docker --profile migration up -d --wait legacy-db
npm run migrate:mariadb-to-sqlite -- --env-file .env.docker
```

Never use `docker compose down -v` while the legacy volume is still your rollback copy.

## Later cleanup

Once the SQLite installation has been verified and backed up, the old MariaDB volume can be removed manually. Because Docker Compose project names can vary, inspect `docker volume ls` first and delete the exact legacy volume deliberately rather than using a broad cleanup command.
