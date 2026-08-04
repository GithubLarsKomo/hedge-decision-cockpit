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

## 2. Stack bauen und starten

```bash
docker compose --env-file .env.docker up -d --build
```

Normalerweise startet jetzt nur:

```text
hedge-decision-app
```

Status und Logs:

```bash
docker compose --env-file .env.docker ps
docker compose --env-file .env.docker logs -f app
```

Das Dashboard ist anschließend unter `http://localhost:3000` erreichbar. Wegen möglicher Proxy-Regeln im lokalen Netz nutze für Tests:

```bash
curl --noproxy "*" http://localhost:3000/api/health
```

Erwartete Antwort:

```json
{"status":"ok","database":"reachable"}
```

## 3. Datenhaltung und Backup

Die Datenbank ist eine einzelne bind-gemountete SQLite-Datei im Repository-Unterordner `data/` und wird von Git ignoriert.

Für ein einfaches konsistentes Datei-Backup stoppe die App kurz:

```powershell
docker compose --env-file .env.docker stop app
Copy-Item data\hedge.db data\hedge-backup.db
docker compose --env-file .env.docker start app
```

Die MariaDB-Konfiguration in `.env.docker` wird nur noch für die einmalige Migration einer bestehenden Installation benötigt. Der `legacy-db`-Service ist einem Compose-Profil zugeordnet und wird bei normalem `docker compose up` nicht gestartet.

Siehe dazu `docs/SQLITE_MIGRATION.md`.

## 4. Marktdaten ohne n8n aktualisieren

Nach `npm install` kann FRED direkt aus dem Repository synchronisiert werden:

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

Weitere Optionen und Task-Scheduler-Beispiel: `docs/FRED_MARKET_DATA.md`.

## 5. SQLite lokal administrieren

Für Prisma Studio auf dem Host:

```powershell
$env:DATABASE_URL = "file:../data/hedge.db"
npx prisma studio
```

Alternativ kann jede SQLite-kompatible Desktop-Anwendung die Datei `data/hedge.db` öffnen. Schreibende Fremdtools nur verwenden, wenn die App gestoppt ist oder die Auswirkungen bewusst sind.

## 6. Aktualisieren

```bash
git pull
npm install
docker compose --env-file .env.docker up -d --build
```

## 7. Stoppen

```bash
docker compose --env-file .env.docker down
```

Die SQLite-Datei unter `data/hedge.db` bleibt dabei erhalten.

Zum vollständigen Löschen der aktuellen SQLite-Daten muss die Datei bewusst entfernt werden. `docker compose down -v` ist dafür nicht erforderlich und sollte während der MariaDB-Migrationsphase nicht verwendet werden, weil das Legacy-Volume als Rollback-Kopie erhalten bleiben soll.
