# Repository Agent Configuration

## Project

- Repository: `GithubLarsKomo/hedge-decision-cockpit`
- Default branch: `main`
- Purpose: versioned decision and monitoring cockpit for a rules-based NASDAQ tail-risk hedge program.
- Product boundary: the application records recommendations, decisions and portfolio/hedge snapshots; it does not execute orders.

## Technology

- Next.js App Router, React and TypeScript
- Tailwind CSS and Chart.js
- Prisma with MySQL/MariaDB
- n8n ingest through `POST /api/decision`
- Node-based tests and GitHub Actions CI

Sources: `README.md`, `package.json`, `.github/workflows/ci.yml`.

## Verified commands

```bash
npm install
npm run prisma:generate
npm run prisma:push
npm run seed:sample
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run test:runtime
```

Use Docker locally with:

```bash
cp .env.docker.example .env.docker
docker compose --env-file .env.docker up -d --build
```

For localhost requests in proxied environments, bypass the proxy, for example:

```bash
curl --noproxy "*" http://127.0.0.1:3000
```

Sources: `README.md`, `package.json`.

## Important paths

- `app/`: Next.js application and API routes
- `lib/`: domain logic and tests
- `prisma/`: schema and seed data
- `n8n/`: workflow and mirrored decision-engine logic
- `scripts/`: runtime and supply-chain verification scripts
- `docs/`: operating, deployment and roadmap documentation
- `.github/workflows/ci.yml`: canonical CI workflow

## Change rules

- Prefer the smallest safe roadmap increment.
- Add or update tests for changed domain behavior.
- Keep deterministic business rules independent of UI and database adapters where practical.
- Do not commit secrets, credentials, tokens, `.env` files or private URLs.
- Do not expose MySQL publicly.
- Do not introduce automated order execution without an explicit architecture and risk decision.
- Changes to `prisma/schema.prisma` require a documented migration or controlled schema-application plan.
- Keep `lib/decision-engine.ts` and the n8n mirror aligned when decision rules change.

## Pull-request workflow

- Create focused branches using the `agent/` prefix.
- Open work as a draft PR.
- Require green typecheck, lint, tests, build and configured supply-chain checks.
- Mark green drafts ready and merge by squash to `main`.
- Continue roadmap work in a new branch after merge.

## Open configuration points

- Issue labels and milestone conventions: `unbestätigt`.
- Required human reviewer count beyond CI: `offen`.
- Production migration mechanism: `offen`; the README permits `prisma db push` or a controlled migration depending on context.
