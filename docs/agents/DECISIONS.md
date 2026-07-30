# Repository Decision Register

This file records confirmed repository-level decisions and keeps unresolved points visible. It does not replace dedicated ADRs when a decision needs deeper rationale.

## Confirmed decisions

### D-001 — Decision support, not order execution

The system documents recommendations, decisions and snapshots but does not execute trades. A human review is required before any transaction.

Source: `README.md`.

### D-002 — Versioned deterministic rule engine

The canonical decision engine is implemented in `lib/decision-engine.ts` and carries an explicit rule version. The n8n implementation mirrors the same rules for workflow execution.

Source: `README.md`.

### D-003 — Reproducible and auditable inputs

Historical observations and decision inputs use validation, source metadata, timestamps and SHA-256 fingerprints. Duplicate inputs are rejected or handled idempotently depending on the persistence path.

Sources: `README.md`, `docs/ROADMAP.md`.

### D-004 — Relational persistence through Prisma

The application uses Prisma with MySQL/MariaDB. Monetary values and historical snapshots are persisted using explicit schema models rather than transient dashboard state.

Sources: `README.md`, `package.json`, `docs/ROADMAP.md`.

### D-005 — Historical validation before production readiness

No strategy is production-ready before historical testing and a documented risk review are complete.

Source: `docs/ROADMAP.md`.

### D-006 — CI is the merge quality gate

Pull requests and pushes to `main` run typecheck, lint, tests, production build, runtime smoke tests, container checks and supply-chain evidence checks. Green draft PRs are prepared for squash merge.

Source: `.github/workflows/ci.yml` and established repository workflow.

### D-007 — Human-readable recommendation trace

Decision runs may persist triggered rules, source, observation time and fingerprints so recommendations remain explainable and reproducible.

Source: `README.md`.

## Open decisions

### O-001 — Production database migration policy

The README permits either `prisma db push` or a controlled migration after schema changes. The exact production policy, approval path and rollback mechanism are `offen`.

### O-002 — Canonical historical data providers

CSV import foundations and stress-period coverage exist or are planned, but authoritative providers, licensing constraints and retention rules remain `offen`.

### O-003 — Strategy risk-review format

A documented risk review is required before production readiness, but its template, approvers and acceptance thresholds remain `offen`.

### O-004 — Human approval and execution model

The roadmap calls for approval, actual execution and deviation reasons. Roles, state transitions, immutability and permissions remain `offen`.

### O-005 — Broker integration boundary

Automated order execution is currently outside the product boundary. Any future broker integration requires a new explicit architecture, security and risk decision.

## ADR references

No dedicated ADR directory or confirmed ADR convention was found during bootstrap. Add relative links here when ADRs are introduced.
