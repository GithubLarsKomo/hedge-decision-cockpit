# Hostinger VPS Deployment – Docker + SQLite

Diese Anleitung beschreibt den aktuellen Server-Pfad des Hedge Decision Cockpits. Der Normalbetrieb verwendet **einen App-Container plus die bind-gemountete SQLite-Datei `data/hedge.db`**. Eine separate MariaDB-Instanz ist nicht mehr erforderlich.

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

Status:

```bash
docker compose --env-file .env.docker ps
```

Logs:

```bash
docker compose --env-file .env.docker logs -f app
```

Healthcheck lokal auf dem VPS:

```bash
curl --noproxy "*" http://127.0.0.1:3000/api/health
```

Erwartet:

```json
{"status":"ok","database":"reachable"}
```

## 5. Reverse Proxy / Domain

Für einen öffentlich erreichbaren Betrieb sollte der App-Port nicht unnötig direkt ins Internet exponiert werden. Nutze den vorhandenen Hostinger-/Coolify-/Caddy-/Traefik-/Nginx-Reverse-Proxy und terminiere TLS dort.

Das Dashboard selbst sollte zusätzlich mit `DASHBOARD_USER` und `DASHBOARD_PASSWORD` geschützt bleiben.

API-Endpunkte werden separat über den Bearer-Token abgesichert.

## 6. Marktdaten ohne n8n aktualisieren

### Variante A – empfohlener Server-Pfad über die lokale HTTP-API

Wenn der App-Container ohnehin läuft, kann cron direkt den Server-Endpunkt aufrufen. Dadurch schreibt nur die laufende Anwendung in SQLite.

Marktdaten synchronisieren:

```bash
curl --fail --silent --show-error \
  -X POST http://127.0.0.1:3000/api/market-data/fred/sync \
  -H "Authorization: Bearer ${N8N_INGEST_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{}'
```

Die Variablen können beispielsweise aus einer root-only Environment-Datei geladen werden. Secrets nicht direkt in eine öffentlich lesbare Crontab schreiben.

Beispiel für einen werktäglichen Lauf nach US-Börsenschluss:

```cron
30 22 * * 1-5 /opt/hedge-decision-cockpit/scripts/server-market-update.sh
```

Der konkrete Wrapper sollte `N8N_INGEST_TOKEN` sicher laden und anschließend den lokalen API-Aufruf ausführen.

### Variante B – direkte Repository-CLI

Mit installiertem Node.js/npm:

```bash
npm install
npm run update:market-data -- --env-file .env.docker
```

Dieser Pfad benötigt weder n8n noch den Next.js-Server. Er arbeitet direkt mit `data/hedge.db`.

Standardmäßig werden nur Marktdaten aktualisiert. Eine Decision wird nur mit `--decision` oder `--hedge-coverage` erzeugt.

Weitere Details: `docs/FRED_MARKET_DATA.md`.

## 7. Optionales n8n

n8n ist nicht erforderlich. Falls es bereits betrieben wird, kann weiterhin folgender Workflow importiert werden:

```text
n8n/hedge-market-data-fred-workflow.json
```

Dieser Workflow enthält keine eigene Hedge-Regelengine. Er orchestriert nur die serverseitigen FRED- und Decision-Endpunkte.

## 8. SQLite-Backup

Für ein einfaches konsistentes Datei-Backup die App kurz stoppen:

```bash
docker compose --env-file .env.docker stop app
cp data/hedge.db "data/hedge-$(date +%F-%H%M%S).db"
docker compose --env-file .env.docker start app
```

Backups zusätzlich außerhalb des VPS sichern.

## 9. Aktualisieren

```bash
git pull --ff-only
npm install
docker compose --env-file .env.docker up -d --build
```

`npm install` ist für den Docker-Build selbst nicht erforderlich, aber sinnvoll, wenn die direkte Host-CLI verwendet wird.

## 10. MariaDB-Altbestand migrieren

Nur für bestehende Installationen mit dem früheren MariaDB-Volume:

```bash
npm install
npm run migrate:mariadb-to-sqlite -- --env-file .env.docker
```

Der Migrationspfad startet MariaDB ausschließlich über das Compose-Profil `migration`, kopiert die unterstützten Tabellen nach SQLite und verifiziert die Row-Counts. Das Legacy-Volume wird nicht automatisch gelöscht.

Siehe `docs/SQLITE_MIGRATION.md`.

## 11. Betriebssicherheit

- SQLite-Datei und Backups nicht committen.
- Dashboard nur geschützt beziehungsweise über vertrauenswürdige Netze bereitstellen.
- API-Token und FRED-Key regelmäßig prüfen und sicher speichern.
- MariaDB-Port nicht öffnen; MariaDB ist im Normalbetrieb nicht erforderlich.
- Kein Pfad im Cockpit platziert automatisch Broker-Orders.
