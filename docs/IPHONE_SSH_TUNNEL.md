# iPhone SSH-Tunnel mit Termius

## Ziel

Du administrierst MySQL auf Hostinger vom iPhone, ohne den MySQL-Port öffentlich zu öffnen.

## Termius Setup

1. Termius installieren.
2. New Host anlegen.
3. Hostinger SSH-Daten eintragen.
4. SSH-Key bevorzugen.

## Port Forwarding

```text
Type: Local
Local host: 127.0.0.1
Local port: 13306
Destination host: 127.0.0.1
Destination port: 3306
```

Dann SSH-Verbindung offen lassen.

## MySQL Client auf iPhone

In einer MySQL-App:

```text
Host: 127.0.0.1
Port: 13306
User: DB_USER
Password: DB_PASSWORD
Database: DB_NAME
```

## Wichtig

iOS beendet Hintergrundverbindungen. Den Tunnel aktiv lassen, während Du administrierst.
