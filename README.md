# NASDAQ Hedge Decision Cockpit – Next.js

Ein kleines, versionierbares Dashboard für ein regelbasiertes NASDAQ-Tail-Risk-Hedge-Programm.

## Stack

- Next.js App Router
- TypeScript
- Tailwind CSS
- Chart.js
- Prisma
- MySQL/MariaDB
- n8n API-Ingest über `POST /api/decision`

## Lokal mit Docker starten

```bash
cp .env.docker.example .env.docker
# CHANGE_ME-Werte in .env.docker ersetzen
docker compose --env-file .env.docker up -d --build
```

Dashboard: `http://localhost:3000`

Ausführliche Anleitung: `docs/LOCAL_DOCKER.md`.

## Lokal starten

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npm run seed:sample
npm run dev
```

Dashboard:

```text
http://localhost:3000
```

## API-Ingest

```bash
curl -X POST http://localhost:3000/api/decision \
  -H "Authorization: Bearer replace-with-a-long-random-token" \
  -H "Content-Type: application/json" \
  -d '{
    "ndxNow": 21350.2,
    "ndxHigh2y": 22500.8,
    "drawdownPercent": -5.11,
    "vixNow": 14.2,
    "vixPercentile": 22.4,
    "action": "BUY_OR_ROLL_PUTS",
    "severity": "blue",
    "recommendation": "Markt nahe Hoch und VIX niedrig: günstiges Zeitfenster zum Aufbau/Rollen von NASDAQ-Puts."
  }'
```

## Hostinger Deployment

Siehe `docs/HOSTINGER_DEPLOY.md`.

## n8n

- Importiere `n8n/hedge-decision-workflow.json`.
- Ersetze im Code Node den Platzhalter durch den Inhalt von `n8n/decision-engine.js`.
- Setze die Ziel-URL auf Deine Domain.
- Hinterlege `N8N_INGEST_TOKEN` als n8n Environment Variable oder direkt im Header.

## Sicherheit

- Keine DB-Zugangsdaten ins Git committen.
- `N8N_INGEST_TOKEN` lang und zufällig wählen.
- MySQL nicht öffentlich öffnen.
- Optional Dashboard zusätzlich mit Hostinger-Verzeichnisschutz oder Middleware schützen.

## Disclaimer

Dieses Projekt ist ein Entscheidungs- und Monitoring-Tool. Es ist keine Anlageberatung und führt keine Orders aus.
