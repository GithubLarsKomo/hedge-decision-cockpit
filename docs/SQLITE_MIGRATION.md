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
