# Lokales Deployment mit Docker

## Voraussetzungen

- Docker Engine mit Docker Compose Plugin
- Freier lokaler Port 3000 oder ein anderer Wert in `.env.docker`

## 1. Konfiguration anlegen

```bash
cp .env.docker.example .env.docker
```

Ersetze in `.env.docker` alle `CHANGE_ME`-Werte. Zufallswerte kannst Du unter Linux beispielsweise so erzeugen:

```bash
openssl rand -base64 36
```

## 2. Stack bauen und starten

```bash
docker compose --env-file .env.docker up -d --build
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

## 3. Testdatensatz über die API anlegen

```bash
set -a
. ./.env.docker
set +a

curl --noproxy "*" -X POST "http://localhost:${APP_PORT:-3000}/api/decision" \
  -H "Authorization: Bearer ${N8N_INGEST_TOKEN}" \
  -H "Content-Type: application/json" \
  -d '{
    "ndxNow": 21350.2,
    "ndxHigh2y": 22500.8,
    "drawdownPercent": -5.11,
    "vixNow": 14.2,
    "vixPercentile": 22.4,
    "action": "BUY_OR_ROLL_PUTS",
    "severity": "blue",
    "recommendation": "Lokaler Docker-Testeintrag"
  }'
```

Danach das Dashboard neu laden.

## 4. Optional: Beispieldaten einspielen

```bash
docker compose --env-file .env.docker exec app npx tsx prisma/seed.ts
```

Der produktive Container enthält bewusst nicht alle Entwicklungswerkzeuge. Falls `tsx` dort nicht verfügbar ist, nutze stattdessen den API-Test aus Schritt 3.

## 5. Datenbank lokal administrieren

Der Datenbankport wird standardmäßig **nicht** auf den Host veröffentlicht. Für eine temporäre lokale Administration kannst Du einmalig ausführen:

```bash
docker compose --env-file .env.docker exec db \
  mariadb -u"${MARIADB_USER:-hedge_user}" -p"${MARIADB_PASSWORD}" \
  "${MARIADB_DATABASE:-hedge_decision}"
```

Alternativ kann für Entwicklungszwecke in `docker-compose.override.yml` Port `127.0.0.1:3307:3306` veröffentlicht werden. Diese Freigabe nicht in die Produktionskonfiguration übernehmen.

## 6. Aktualisieren

```bash
git pull
docker compose --env-file .env.docker up -d --build
```

## 7. Stoppen und entfernen

Container stoppen:

```bash
docker compose --env-file .env.docker down
```

Container **und alle Datenbankdaten** löschen:

```bash
docker compose --env-file .env.docker down -v
```

Die Option `-v` nur verwenden, wenn die gespeicherte Historie wirklich gelöscht werden soll.
