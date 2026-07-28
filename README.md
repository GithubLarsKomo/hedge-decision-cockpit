# NASDAQ Hedge Decision Cockpit – Next.js

Versionierbares Dashboard für ein regelbasiertes NASDAQ-Tail-Risk-Hedge-Programm. Das System dokumentiert Entscheidungen und Portfolio-/Hedge-Snapshots, führt aber keine Orders aus.

## Stack

- Next.js App Router, TypeScript und Tailwind CSS
- Chart.js
- Prisma mit MySQL/MariaDB
- n8n API-Ingest über `POST /api/decision`
- Vitest und GitHub Actions

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

Nach Änderungen am Prisma-Schema muss vor dem Deployment `npx prisma db push` oder eine kontrollierte Migration ausgeführt werden.

## Qualitätsprüfungen

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Die GitHub-Action führt diese Prüfungen bei Pull Requests und Pushes auf `main` aus.

## Regelengine

Die kanonische, getestete Regelengine liegt in `lib/decision-engine.ts` und trägt eine explizite `ruleVersion`. Der n8n-Code in `n8n/decision-engine.js` bildet dieselben Regeln für den Workflow ab. Jeder gespeicherte Lauf kann `triggeredRules`, Datenquelle, Beobachtungszeit und einen SHA-256-Fingerprint enthalten.

## API-Ingest

```bash
curl -X POST http://localhost:3000/api/decision \
  -H "Authorization: Bearer replace-with-a-long-random-token" \
  -H "Content-Type: application/json" \
  -d '{
    "observedAt": "2026-07-28T18:00:00.000Z",
    "source": "n8n/yahoo-chart",
    "ruleVersion": "2.0.0",
    "triggeredRules": ["NEAR_HIGH", "VIX_CHEAP"],
    "ndxNow": 21350.2,
    "ndxHigh2y": 22500.8,
    "drawdownPercent": -5.11,
    "vixNow": 14.2,
    "vixPercentile": 22.4,
    "action": "BUY_OR_ROLL_PUTS",
    "severity": "blue",
    "recommendation": "Markt nahe Hoch und VIX niedrig: Hedge-Lücke prüfen.",
    "portfolioMarketValueEur": 1000000,
    "hedgeMarketValueEur": 18000,
    "hedgeCoveragePercent": 70
  }'
```

Erfolgreiche Requests liefern HTTP 201 und eine `requestId`. Ein bereits verwendeter `inputFingerprint` liefert HTTP 409. Fehler werden ebenfalls mit einer `requestId` versehen.

## Dashboard-Schutz

Setze `DASHBOARD_BASIC_AUTH_USER` und `DASHBOARD_BASIC_AUTH_PASSWORD`, um alle Dashboard-Seiten per Basic Auth zu schützen. Der n8n-Ingest bleibt separat über den Bearer-Token abgesichert.

## Hostinger Deployment

Siehe `docs/HOSTINGER_DEPLOY.md`.

## n8n

- Importiere `n8n/hedge-decision-workflow.json`.
- Ersetze im Code Node den Platzhalter durch den Inhalt von `n8n/decision-engine.js`.
- Setze die Ziel-URL auf Deine Domain.
- Hinterlege `N8N_INGEST_TOKEN` als n8n Environment Variable oder direkt im Header.
- Sorge dafür, dass mindestens 400 NDX- und 200 VIX-Schlusskurse verfügbar sind.

## Sicherheit

- Keine DB-Zugangsdaten oder Tokens committen.
- `N8N_INGEST_TOKEN` lang und zufällig wählen.
- Dashboard-Basisschutz im produktiven Betrieb aktivieren.
- MySQL nicht öffentlich öffnen.
- Entscheidungen sind Empfehlungen; vor einer Transaktion ist eine menschliche Prüfung erforderlich.

## Disclaimer

Dieses Projekt ist ein Entscheidungs- und Monitoring-Tool. Es ist keine Anlageberatung und führt keine Orders aus.
