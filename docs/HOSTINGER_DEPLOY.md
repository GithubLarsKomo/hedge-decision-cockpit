# Hostinger Deployment – Next.js

## 1. GitHub Repo erstellen

```bash
git init
git add .
git commit -m "Initial Next.js hedge cockpit"
git branch -M main
git remote add origin git@github.com:DEINUSER/hedge-decision-cockpit-nextjs.git
git push -u origin main
```

## 2. Hostinger Node.js App anlegen

Im hPanel:

```text
Websites → Manage → Node.js → Create application
```

Empfohlene Werte:

```text
Node.js version: 20
Application root: hedge-decision-cockpit-nextjs
Application startup file: node_modules/next/dist/bin/next
```

Je nach Hostinger UI kannst Du GitHub direkt importieren oder das Repo per SSH klonen.

## 3. Environment setzen

In Hostinger oder `.env` auf dem Server:

```env
DATABASE_URL="mysql://DB_USER:DB_PASSWORD@127.0.0.1:3306/DB_NAME"
N8N_INGEST_TOKEN="sehr-langer-zufaelliger-token"
```

## 4. Build

Per SSH im Projektordner:

```bash
npm ci
npx prisma generate
npx prisma db push
npm run build
```

## 5. Start command

```bash
npm run start -- -p $PORT
```

Falls Hostinger einen konkreten Port erwartet, den von Hostinger gesetzten Port verwenden.

## 6. n8n verbinden

Im HTTP Request Node:

```text
POST https://DEINE-DOMAIN.de/api/decision
Authorization: Bearer <N8N_INGEST_TOKEN>
Content-Type: application/json
```

## 7. SSH-Tunnel auf dem iPhone

Mit Termius:

```text
Host: HOSTINGER_SSH_HOST
Port: HOSTINGER_SSH_PORT
User: HOSTINGER_USER
Auth: SSH Key bevorzugt
```

Local Port Forward:

```text
Local: 127.0.0.1:13306
Remote/Destination: 127.0.0.1:3306
```

MySQL-App auf dem iPhone:

```text
Host: 127.0.0.1
Port: 13306
User: DB_USER
Password: DB_PASSWORD
Database: DB_NAME
```

## 8. Hinweise

- Remote MySQL nicht öffnen.
- n8n schreibt über die HTTPS-API, nicht direkt in die DB.
- DB-Zugriff nur durch die Next.js-App lokal auf Hostinger oder über SSH-Tunnel.
