# Hostinger VPS Deployment – Docker + SQLite

Diese Anleitung beschreibt den aktuellen Server-Pfad des Hedge Decision Cockpits. Der Normalbetrieb verwendet **einen App-Container, einen kleinen FRED-Scheduler-Sidecar und die bind-gemountete SQLite-Datei `data/hedge.db`**. Eine separate MariaDB-Instanz ist nicht mehr erforderlich.

## 1. Voraussetzungen

Auf dem VPS:

- Docker Engine
- Docker Compose Plugin
- Git
- freier lokaler oder veröffentlichter App-Port

Optional für direkte CLI-Marktupdates aus dem Repository:

- Node.js 22
- npm

## 2. Repository klonen

```bash
git clone https://github.com/GithubLarsKomo/hedge-decision-cockpit.git
cd hedge-decision-cockpit
```

## 3. Environment anlegen

```bash
cp .env.docker.example .env.docker
```

Mindestens setzen:

```dotenv
APP_PORT=3000
N8N_INGEST_TOKEN=<sehr-langer-zufaelliger-token>
FRED_API_KEY=<fred-api-key>
DASHBOARD_USER=admin
DASHBOARD_PASSWORD=<starkes-passwort>
```

Die automatische FRED-Akquise verwendet standardmäßig:

```dotenv
FRED_SYNC_TIME=22:30
FRED_SYNC_TIMEZONE=Europe/Berlin
FRED_SYNC_POLL_SECONDS=60
```

`DATABASE_URL` wird für Docker absichtlich nicht in `.env.docker` gepflegt. Compose setzt intern:

```text
file:/app/data/hedge.db
```

Die persistente Host-Datei liegt unter:

```text
data/hedge.db
```

Die MariaDB-Variablen in `.env.docker` werden nur für eine einmalige Altbestandsmigration benötigt.

## 4. Starten

```bash
docker compose --env-file .env.docker up -d --build
```

Normalerweise laufen anschließend:

```text
hedge-decision-app
hedge-decision-fred-scheduler
```

Status:

```bash
docker compose --env-file .env.docker ps
```

Logs:

```bash
docker compose --env-file .env.docker logs -f app
docker compose --env-file .env.docker logs -f fred-scheduler
```

Healthcheck lokal auf dem VPS:

```bash
curl --noproxy "*" http://127.0.0.1:3000/api/health
```

Erwartet wird ein `ready`-Status mit erreichbarer SQLite-Datenbank und aktueller App-Version.

## 5. Reverse Proxy / Domain

Für einen öffentlich erreichbaren Betrieb sollte der App-Port nicht unnötig direkt ins Internet exponiert werden. Nutze den vorhandenen Hostinger-/Coolify-/Caddy-/Traefik-/Nginx-Reverse-Proxy und terminiere TLS dort.

Das Dashboard selbst sollte zusätzlich mit `DASHBOARD_USER` und `DASHBOARD_PASSWORD` geschützt bleiben.

API-Endpunkte werden separat über den Bearer-Token abgesichert.

Der FRED-Scheduler verwendet ausschließlich das interne Compose-Netz und ruft `http://app:3000/api/market-data/fred/sync` auf. Dafür muss kein zusätzlicher Port veröffentlicht werden.

## 6. Automatische FRED-Akquise

Der Sidecar wartet auf den App-Healthcheck und ruft danach einmal täglich nach dem konfigurierten Zeitpunkt den vorhandenen FRED-Sync-Endpunkt auf. Er schreibt nicht direkt in SQLite und enthält keine eigene Markt- oder Hedge-Regellogik.

Der Scheduler synchronisiert bewusst **nur Marktdaten**. Eine Hedge-Decision wird nicht automatisch erzeugt.

Der letzte erfolgreiche geplante Lauf wird lokal vermerkt unter:

```text
data/.fred-sync-last-date
```

Für einen sofortigen Smoke-Test:

```bash
docker compose --env-file .env.docker run --rm fred-scheduler --once
```

Ein wiederholter Lauf ist sicher; bereits gespeicherte Beobachtungen werden aufgrund der bestehenden Idempotenz übersprungen.

## 7. Manuelle Marktaktualisierung / Recovery

### Variante A – lokale HTTP-API

Marktdaten manuell synchronisieren:

```bash
curl --fail --silent --show-error \
  -X POST http://127.0.0.1:3000/api/market-data/fred/sync \
  -H "Authorization: Bearer ${N8N_INGEST_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

### Variante B – direkte Repository-CLI

Mit installiertem Node.js/npm:

```bash
npm install
npm run update:market-data -- --env-file .env.docker
```

Dieser Pfad benötigt weder n8n noch den Next.js-Server. Er arbeitet direkt mit `data/hedge.db`.

Standardmäßig werden nur Marktdaten aktualisiert. Eine Decision wird nur mit `--decision` oder `--hedge-coverage` erzeugt.

Weitere Details: `docs/FRED_MARKET_DATA.md`.

## 8. Optionales n8n

n8n ist nicht erforderlich. Falls es bereits betrieben wird, kann weiterhin folgender Workflow importiert werden:

```text
n8n/hedge-market-data-fred-workflow.json
```

Dieser Workflow enthält keine eigene Hedge-Regelengine. Er orchestriert nur die serverseitigen FRED- und Decision-Endpunkte.

Für neue Deployments sollte die FRED-Akquise nicht zusätzlich über n8n oder Host-cron geplant werden, solange der Docker-Scheduler aktiv ist.

## 9. SQLite-Backup

Für ein einfaches konsistentes Datei-Backup App und Scheduler kurz stoppen:

```bash
docker compose --env-file .env.docker stop fred-scheduler app
cp data/hedge.db "data/hedge-$(date +%F-%H%M%S).db"
docker compose --env-file .env.docker start app fred-scheduler
```

Backups zusätzlich außerhalb des VPS sichern.

## 10. Aktualisieren

```bash
git fetch origin --prune
git merge --ff-only origin/main
npm install
docker compose --env-file .env.docker up -d --build
```

`npm install` ist für den Docker-Build selbst nicht erforderlich, aber sinnvoll, wenn die direkte Host-CLI verwendet wird.

## 11. MariaDB-Altbestand migrieren

Nur für bestehende Installationen mit dem früheren MariaDB-Volume:

```bash
npm install
npm run migrate:mariadb-to-sqlite -- --env-file .env.docker
```

Der Migrationspfad startet MariaDB ausschließlich über das Compose-Profil `migration`, kopiert die unterstützten Tabellen nach SQLite und verifiziert die Row-Counts. Das Legacy-Volume wird nicht automatisch gelöscht.

Siehe `docs/SQLITE_MIGRATION.md`.

## 12. Betriebssicherheit

- SQLite-Datei und Backups nicht committen.
- Dashboard nur geschützt beziehungsweise über vertrauenswürdige Netze bereitstellen.
- API-Token und FRED-Key regelmäßig prüfen und sicher speichern.
- MariaDB-Port nicht öffnen; MariaDB ist im Normalbetrieb nicht erforderlich.
- Nicht parallel zusätzlich n8n/cron für denselben täglichen FRED-Lauf aktivieren, sofern dies nicht bewusst gewünscht ist.
- Kein Pfad im Cockpit platziert automatisch Broker-Orders.
