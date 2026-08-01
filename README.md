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

## Portfolio-Engine-Integration

Das Cockpit übernimmt **nicht** die Rekonstruktion der strategischen Zielallokation. Die vorgelagerte Portfolio-Engine erzeugt einen versionierten `portfolio-snapshot/1.0`; das Cockpit validiert, persistiert und verwendet diesen Snapshot nur als Portfolio-Kontext für die taktische Hedge-Entscheidung.

Kanonische Grenzen:

- Portfolio-Vertrag und Fingerprint: `lib/portfolio-snapshot.ts`
- lokaler Monatslauf: `npm run run:monthly-portfolio -- <monthly-input.json>`
- kombinierter Monatsbericht: `npm run run:monthly-decision-report -- <monthly-input.json> [hedge-context.json]`
- HTTP-Import: `POST /api/portfolio-snapshots/import`
- Exposure-Aggregation: `lib/exposure-mapping.ts`
- versioniertes ETF-Mapping und Nearest-Neighbour-Ranking: `lib/etf-nearest-neighbour-mapping.ts` und `lib/nearest-neighbour-ranking.ts`
- Portfolio→Hedge-E2E-Seam: `lib/portfolio-hedge-integration.ts`
- taktische Hedge-Regelengine: `lib/decision-engine.ts`

Der monatliche Ablauf ist bewusst zweistufig:

1. strategische Zielallokation und Instrument-Mapping lokal aktualisieren;
2. Snapshot erzeugen und per SHA-256 unveränderlich referenzieren;
3. Snapshot idempotent im Cockpit importieren;
4. Drift, Sparrate und zusätzliche Cash-Varianten berechnen;
5. taktische Marktsignale (`drawdownPercent`, `vixPercentile`, optional `hedgeCoveragePercent`) separat erfassen;
6. validierten Snapshot und diese Signale über `evaluatePortfolioHedgeDecision` an die bestehende Hedge-Regelengine übergeben;
7. Portfolio- und Hedge-Ergebnis dokumentieren und menschlich entscheiden.

Portfolio-Daten erzeugen keine Marktsignale und Marktsignale verändern den Portfolio-Snapshot nicht. Ein ETF-Wechsel wird nicht allein durch eine geringfügig niedrigere TER ausgelöst. Kein Integrationspfad erzeugt automatisch Broker-Orders oder Execution Requests.

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
