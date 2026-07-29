# Erste Anwendungstestung

## Ziel

Die erste Anwendungstestung prüft, dass die Next.js-Anwendung startet, die deterministische Marktdaten-Pipeline im Browser ausgeführt wird, das Dashboard Seed-Daten anzeigt und der authentifizierte API-Ingest einen neuen Datensatz speichert.

## Vorbereitung

```bash
cp .env.example .env
npm install
npx prisma generate
npx prisma db push
npm run seed:sample
npm run dev
```

Alternativ kann die Docker-Anleitung aus `docs/LOCAL_DOCKER.md` verwendet werden.

## Test 1: automatisierte Qualitätsprüfungen

```bash
npm run typecheck
npm run lint
npm test
npm run build
```

Alle Befehle müssen ohne Fehler enden.

## Test 2: integrierte Testseite

1. `http://localhost:3000/test` öffnen.
2. Das Gesamtergebnis muss `BESTANDEN` anzeigen.
3. In der Aktualitätsprüfung müssen drei Quotes verbleiben.
4. In der Liquiditätsprüfung darf nur `NDX-PUT-A` verbleiben.

Die Testseite verwendet ausschließlich kontrollierte Beispieldaten und schreibt nichts in die Datenbank.

## Test 3: Dashboard

1. `http://localhost:3000` öffnen.
2. Die aktuelle Entscheidung, Historiengrafik und Tabelle prüfen.
3. Darstellung auf Smartphone- und Desktopbreite kontrollieren.

## Test 4: API-Ingest

Den Beispiel-POST aus der README mit dem in `.env` gesetzten Bearer-Token ausführen. Erwartet werden HTTP 201 und eine `requestId`. Nach Neuladen des Dashboards muss der neue Datensatz als aktuellste Entscheidung erscheinen.

## Abnahmekriterien

- CI und lokale Qualitätsprüfungen sind grün.
- `/test` zeigt `BESTANDEN`.
- Seed-Daten werden im Dashboard dargestellt.
- Ein authentifizierter API-POST wird gespeichert und angezeigt.
- Ein doppelter `inputFingerprint` wird mit HTTP 409 abgewiesen.
