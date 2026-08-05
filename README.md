# NASDAQ Hedge Decision Cockpit – Next.js

Version **1.122.0**. Browser- und CLI-gestütztes Entscheidungs- und Monitoring-Tool für ein regelbasiertes NASDAQ-Tail-Risk-Hedge-Programm. Das Cockpit dokumentiert Markt-, Portfolio-, Mapping-, Hedge- und Review-Zustände reproduzierbar, führt aber keine Broker-Orders aus.

## Aktueller Stack

- Next.js App Router, TypeScript und Tailwind CSS
- Chart.js
- Prisma 6 mit SQLite
- FRED als kanonischer Markt-Datenprovider für `NASDAQ100` und `VIXCLS`
- automatischer Docker-Sidecar für tägliche FRED-Akquise
- Node-Test-Runner über `tsx --test`
- Docker Compose für den lokalen/Server-Betrieb
- GitHub Actions mit Typecheck, Lint, Tests, Build, Runtime-Smoke-Test, Container-Scan, SBOM und Provenance

## Architekturgrenzen

Das Cockpit trennt bewusst vier Verantwortlichkeiten:

1. **Portfolio-Kontext** – versionierte Portfolio-Snapshots, Exposure-Mapping und ETF-Nearest-Neighbour-Artefakte.
2. **Marktdaten** – persistierte tägliche NDX/VIX-Beobachtungen mit Provider-Provenance.
3. **Hedge-Regelengine** – deterministische Ableitung der taktischen Empfehlung aus Marktsignalen und optionaler Hedge-Abdeckung.
4. **Human Review** – Mapping-Review, Decision-Review und expliziter Abschluss eines Monatslaufs.

Es gibt keine automatische ETF-Umschaltung, keine Broker-Order und keine automatische Execution Request.

Die UI trennt die **primäre Strategiestufe** von der Volatilitätsbewertung. Die Hauptskala lautet **Blau → Grün → Gelb → Amber → Orange → Rot**. `VIX_EXPENSIVE` wird zusätzlich als separates **VIX-teuer-Overlay** angezeigt und verändert die primäre Drawdown-Farbe nicht. Diese Darstellungslogik ändert keine Schwellen, Actions oder die kanonische `ruleVersion` 2.1.0.

## Lokal mit Docker starten

```bash
cp .env.docker.example .env.docker
# CHANGE_ME-Werte in .env.docker ersetzen
docker compose --env-file .env.docker up -d --build
```

Dashboard: `http://localhost:3000`

Der Normalbetrieb startet:

```text
hedge-decision-app
hedge-decision-fred-scheduler
```

Die SQLite-Datenbank liegt persistent unter:

```text
data/hedge.db
```

Der Scheduler wartet auf eine gesunde App und ruft standardmäßig täglich um **22:30 Europe/Berlin** die vorhandene FRED-Sync-API auf. Er implementiert weder einen zweiten FRED-Client noch Hedge-Regeln und erzeugt keine automatische Decision.

Ein sofortiger Smoke-Test ist möglich mit:

```powershell
docker compose --env-file .env.docker run --rm fred-scheduler --once
```

MariaDB ist nur noch als opt-in `migration`-Profil für die einmalige Übernahme einer bestehenden Installation vorhanden.

Ausführlich:

- `docs/LOCAL_DOCKER.md`
- `docs/FRED_MARKET_DATA.md`
- `docs/SQLITE_MIGRATION.md`

## Lokal ohne Docker entwickeln

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npm run seed:sample
npm run dev
```

Die lokale `.env` verwendet eine SQLite-URL wie `file:../data/hedge.db`.

## FRED-Marktdaten

Im normalen Docker-Betrieb werden FRED-Marktdaten automatisch durch den Scheduler-Sidecar aktualisiert. Die Synchronisation nutzt das bestehende überlappende Zehn-Tage-Fenster und ist idempotent.

Für Recovery, Diagnose und explizite Backfills bleibt der direkte Host-CLI-Pfad verfügbar:

```powershell
npm run update:market-data -- --env-file .env.docker
```

Expliziter Backfill:

```powershell
npm run update:market-data -- --env-file .env.docker --start 1990-01-02
```

Optional zusätzlich eine Hedge-Decision erzeugen oder wiederverwenden:

```powershell
npm run update:market-data -- --env-file .env.docker --decision
```

Mit bekannter Hedge-Abdeckung:

```powershell
npm run update:market-data -- --env-file .env.docker --hedge-coverage 70
```

Die automatische Docker-Akquise synchronisiert bewusst **nur Marktdaten**. Details, Scheduling und Alternativen: `docs/FRED_MARKET_DATA.md`.

## Kanonische Regelengine

Die **einzige kanonische Hedge-Regelengine** liegt in:

- `lib/decision-engine.ts`
- `lib/strategy-config.ts`

Die aktuelle Strategie trägt `ruleVersion` **2.1.0**. Schwellen, Regelreihenfolge und Rule-IDs werden dort zentral definiert und getestet.

n8n enthält bewusst **keine zweite Kopie der Business Logic**. Der optionale FRED-n8n-Workflow ruft ausschließlich die serverseitigen API-Endpunkte auf.

## Markt-Daten-Pipeline

Kanonischer Datenfluss:

```text
Docker FRED Scheduler
        ↓
POST /api/market-data/fred/sync
        ↓
FRED (NASDAQ100 + VIXCLS)
        ↓
MarketSnapshot
        ↓
historische Signalableitung
        ↓
Decision Engine 2.1.0
        ↓
Decision
        ↓
Human Review
```

Der Scheduler endet bewusst bei `MarketSnapshot`; die Decision-Erzeugung ist kein Bestandteil der automatischen Datenakquise.

Die Marktdaten werden unter der Provider-Identität `fred:NASDAQ100+VIXCLS` gespeichert. NDX-Referenzhoch, Drawdown und VIX-Perzentil werden deterministisch aus persistierter Historie abgeleitet.

## Portfolio-Engine-Integration

Das Cockpit rekonstruiert **nicht** selbst die strategische Zielallokation. Eine vorgelagerte Portfolio-Engine erzeugt einen versionierten `portfolio-snapshot/1.0`; das Cockpit validiert, persistiert und verwendet diesen Snapshot als Portfolio-Kontext.

Kanonische Grenzen:

- Portfolio-Vertrag und Fingerprint: `lib/portfolio-snapshot.ts`
- lokaler Monatslauf: `npm run run:monthly-portfolio -- <monthly-input.json>`
- kombinierter Monatsbericht: `npm run run:monthly-decision-report -- <monthly-input.json> [hedge-context.json]`
- HTTP-Import: `POST /api/portfolio-snapshots/import`
- Exposure-Aggregation: `lib/exposure-mapping.ts`
- ETF-Mapping und Nearest-Neighbour-Ranking: `lib/etf-nearest-neighbour-mapping.ts` und `lib/nearest-neighbour-ranking.ts`
- Portfolio→Hedge-Seam: `lib/portfolio-hedge-integration.ts`
- taktische Hedge-Regelengine: `lib/decision-engine.ts`

Portfolio-Daten erzeugen keine Marktsignale und Marktsignale verändern den Portfolio-Snapshot nicht.

## Browser-Monatsworkflow

Der normale Monatslauf kann vollständig im Browser durchgeführt werden:

1. Portfolio-Kontext erfassen bzw. importieren.
2. ETF-Mapping prüfen und bei Bedarf Human Review durchführen.
3. Hedge-Kontext erfassen oder aus gespeicherter Markthistorie ableiten.
4. Decision prüfen.
5. Monatslauf explizit menschlich abschließen.

CLI- und JSON-Pfade bleiben als reproduzierbare Recovery- und Audit-Wege erhalten.

## HTTP-API

Für Integrationen bleiben authentifizierte Endpunkte verfügbar, unter anderem:

```text
POST /api/market-data/fred/sync
POST /api/hedge-decisions/from-history
POST /api/portfolio-snapshots/import
```

Sie verwenden `Authorization: Bearer <N8N_INGEST_TOKEN>` als API-Kompatibilitätstoken. Der Tokenname ist historisch; n8n ist keine Voraussetzung für die Endpunkte. Der Docker-FRED-Scheduler verwendet denselben Token ausschließlich für den internen Aufruf der bestehenden Sync-API.

`POST /api/decision` bleibt als Kompatibilitätsweg für bereits extern berechnete Decisions bestehen, ist aber nicht der bevorzugte Markt-Daten-/Decision-Pfad.

## Optionales n8n

Der einzige gepflegte Markt-Daten-Workflow ist:

```text
n8n/hedge-market-data-fred-workflow.json
```

Er orchestriert die vorhandenen Server-Endpunkte und implementiert **keine** eigene Hedge-Regellogik. Der frühere Yahoo-/Code-Node-Workflow wurde entfernt, um Rule-Drift zwischen n8n und der kanonischen TypeScript-Engine zu verhindern.

Für neue Docker-Installationen ist n8n für die Marktdaten-Automatisierung nicht erforderlich.

## Qualitätsprüfungen

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Die GitHub-Action führt diese Prüfungen bei Pull Requests und Pushes auf `main` aus und ergänzt Runtime-, Container- und Supply-Chain-Prüfungen.

## Dashboard-Schutz

Setze `DASHBOARD_BASIC_AUTH_USER` und `DASHBOARD_BASIC_AUTH_PASSWORD`, um die Dashboard-Seiten per Basic Auth zu schützen. API-Endpunkte verwenden unabhängig davon den Bearer-Token.

## Server-/Hostinger-Deployment

Siehe `docs/HOSTINGER_DEPLOY.md` für den aktuellen Docker-/SQLite-Pfad.

## Sicherheit und Betrieb

- Keine Tokens oder Secrets committen.
- `N8N_INGEST_TOKEN` lang und zufällig wählen, auch wenn n8n nicht verwendet wird.
- `FRED_API_KEY` nur als Environment Variable im App-Container halten; der Scheduler benötigt den Key nicht direkt.
- Dashboard-Basisschutz bei nicht rein lokalem Betrieb aktivieren.
- `data/hedge.db` regelmäßig sichern; für ein einfaches konsistentes Datei-Backup App und Scheduler kurz stoppen.
- Lokale Migrationsexporte unter `backup/` bleiben unversioniert und dürfen nicht ins Repository gelangen.
- Entscheidungen sind Empfehlungen; vor einer Transaktion ist eine menschliche Prüfung erforderlich.

## Disclaimer

Dieses Projekt ist ein persönliches Entscheidungs- und Monitoring-Tool. Es ist keine Anlageberatung und führt keine Orders aus.
