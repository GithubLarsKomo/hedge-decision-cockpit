# Lokales Deployment mit Docker

## Voraussetzungen

- Docker Engine mit Docker Compose Plugin
- Freier lokaler Port 3000 oder ein anderer Wert in `.env.docker`

## 1. Konfiguration anlegen

```bash
cp .env.docker.example .env.docker
```

Ersetze in `.env.docker` alle `CHANGE_ME`-Werte. Für den normalen Betrieb wird keine separate Datenbank-Instanz mehr benötigt. SQLite liegt lokal unter:

```text
data/hedge.db
```

Für die automatische FRED-Akquise gelten standardmäßig:

```dotenv
FRED_SYNC_TIME=22:30
FRED_SYNC_TIMEZONE=Europe/Berlin
FRED_SYNC_POLL_SECONDS=60
```

## 2. Stack bauen und starten

```bash
docker compose --env-file .env.docker up -d --build
```

Normalerweise starten jetzt zwei Runtime-Container:

```text
hedge-decision-app
hedge-decision-fred-scheduler
```

Der Scheduler wartet auf eine gesunde App und ruft danach einmal täglich die vorhandene FRED-Sync-API auf. Er enthält keine zweite Marktdatenlogik und erzeugt keine automatische Hedge-Decision.

Status und Logs:

```bash
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs -f app
docker compose --env-file .env.docker logs -f fred-scheduler
```

Das Dashboard ist anschließend unter `http://localhost:3000` erreichbar. Wegen möglicher Proxy-Regeln im lokalen Netz nutze für Tests:

```bash
curl --noproxy "*" http://localhost:3000/api/health
```

Erwartet wird ein `ready`-Status mit erreichbarer Datenbank und aktueller App-Version.

## 3. Automatische FRED-Akquise prüfen

Die geplante Synchronisation läuft standardmäßig täglich um 22:30 Uhr in `Europe/Berlin`. Der Scheduler speichert nur das Datum seines letzten erfolgreichen geplanten Laufs unter:

```text
data/.fred-sync-last-date
```

Die Datei liegt im ohnehin ignorierten `data/`-Verzeichnis. Die eigentlichen Marktbeobachtungen werden weiterhin ausschließlich vom App-Endpunkt in SQLite geschrieben.

Für einen sofortigen Smoke-Test ohne Warten auf 22:30:

```powershell
docker compose --env-file .env.docker run --rm fred-scheduler --once
```

Der Lauf muss ein FRED-Sync-Ergebnis ausgeben. Ein unmittelbar wiederholter Lauf darf keine bereits gespeicherten Beobachtungen duplizieren.

## 4. Datenhaltung und Backup

Die Datenbank ist eine einzelne bind-gemountete SQLite-Datei im Repository-Unterordner `data/` und wird von Git ignoriert.

Für ein einfaches konsistentes Datei-Backup stoppe die App kurz:

```powershell
docker compose --env-file .env.docker stop fred-scheduler app
Copy-Item data\hedge.db data\hedge-backup.db
docker compose --env-file .env.docker start app fred-scheduler
```

Die MariaDB-Konfiguration in `.env.docker` wird nur noch für die einmalige Migration einer bestehenden Installation benötigt. Der `legacy-db`-Service ist einem Compose-Profil zugeordnet und wird bei normalem `docker compose up` nicht gestartet.

Siehe dazu `docs/SQLITE_MIGRATION.md`.

## 5. Marktdaten manuell aktualisieren

Die automatische Docker-Akquise ist der normale Laufweg. Nach `npm install` kann FRED für Recovery, Diagnose oder Backfills weiterhin direkt aus dem Repository synchronisiert werden:

```powershell
npm run update:market-data -- --env-file .env.docker
```

Das benötigt weder n8n noch einen laufenden Next.js-Server. Standardmäßig werden nur Marktdaten aktualisiert.

Mit Decision Engine:

```powershell
npm run update:market-data -- --env-file .env.docker --decision
```

Oder mit expliziter Hedge-Abdeckung:

```powershell
npm run update:market-data -- --env-file .env.docker --hedge-coverage 0
```

Weitere Optionen und Scheduler-Details: `docs/FRED_MARKET_DATA.md`.

## 6. SQLite lokal administrieren

Für Prisma Studio auf dem Host:

```powershell
$env:DATABASE_URL = "file:../data/hedge.db"
npx prisma studio
```

Alternativ kann jede SQLite-kompatible Desktop-Anwendung die Datei `data/hedge.db` öffnen. Schreibende Fremdtools nur verwenden, wenn die App gestoppt ist oder die Auswirkungen bewusst sind.

## 7. Aktualisieren

```bash
git fetch origin --prune
git merge --ff-only origin/main
npm install
docker compose --env-file .env.docker up -d --build
```

## 8. Stoppen

```bash
docker compose --env-file .env.docker down
```

Die SQLite-Datei unter `data/hedge.db` und der Scheduler-Zustand unter `data/.fred-sync-last-date` bleiben dabei erhalten.

Zum vollständigen Löschen der aktuellen SQLite-Daten muss die Datei bewusst entfernt werden. `docker compose down -v` ist dafür nicht erforderlich.
