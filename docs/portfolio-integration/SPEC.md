# Monthly Portfolio Integration Specification

Status: draft for VI-001
Source issue: #99

## Purpose

Define the stable, versioned contract by which a locally operated `global-portfolio-engine` exports a monthly portfolio snapshot to `hedge-decision-cockpit`. The integration remains decision support only and must not execute orders.

## Scope

This specification covers the contract boundary only: snapshot identity, provenance, strategy metadata, portfolio totals, exposure-level targets and holdings aggregation, purchase scenarios, revisions, source fingerprints and deterministic input fingerprinting.

Out of scope for VI-001: persistence, hedge calculations, live market-data ingestion, GPO scraping, ETF nearest-neighbour scoring, monthly contribution allocation logic, broker APIs and order generation.

## Requirements

### REQ-PI-001 — Monthly snapshot identity
A portfolio export MUST identify a monthly snapshot with `snapshot_id`, `as_of`, `generated_at`, `revision` and `schema_version`.

### REQ-PI-002 — Immutable revisions
A closed snapshot MUST NOT be overwritten. A correction MUST use the same logical `snapshot_id` with a strictly higher positive integer `revision`.

### REQ-PI-003 — Versioned schema
Every export MUST declare `schema_version`. VI-001 defines `portfolio-snapshot/1.0`.

### REQ-PI-004 — Strategy provenance
The export MUST identify the strategy name, strategy version, source observation date, estimation status and confidence.

### REQ-PI-005 — Per-target provenance
Each exposure target MUST state whether its target is `observed`, `estimated` or `manual`.

### REQ-PI-006 — Exposure/instrument separation
Strategic exposures MUST be represented independently of concrete tradable instruments.

### REQ-PI-007 — Multiple mapped instruments
An exposure MAY contain multiple mapped instruments, including legacy holdings, while identifying at most one active purchase instrument for new purchases.

### REQ-PI-008 — Portfolio totals
The snapshot MUST include currency, portfolio market value, monthly contribution, additional cash available, target equity weight, current equity weight and equity gap amount.

### REQ-PI-009 — Exposure drift data
Each exposure MUST include target weight, current weight and gap amount so the downstream system can evaluate portfolio context without reconstructing the portfolio engine's internal state.

### REQ-PI-010 — Purchase scenarios
The export MAY contain one or more named purchase scenarios. Scenarios are recommendations only and MUST NOT be executable orders.

### REQ-PI-011 — Source fingerprints
The export MUST support zero or more source fingerprints to identify underlying source observations or imported inputs.

### REQ-PI-012 — Deterministic input fingerprint
The export MUST contain a SHA-256 `input_fingerprint` computed deterministically from the canonical snapshot payload excluding the `input_fingerprint` field itself.

### REQ-PI-013 — No order execution semantics
The contract MUST NOT contain broker credentials, order identifiers, execution commands or fields whose semantics require automatic order placement.

## Contract v1

The canonical representation is JSON. Field names are stable within schema version `portfolio-snapshot/1.0`.

Top-level fields:

- `schema_version`: constant `portfolio-snapshot/1.0`
- `snapshot_id`: logical monthly identity, e.g. `2026-08`
- `revision`: positive integer beginning at `1`
- `as_of`: ISO 8601 calendar date
- `generated_at`: ISO 8601 date-time with offset or UTC marker
- `strategy`: strategy metadata and provenance
- `portfolio`: aggregate portfolio values
- `exposures`: one or more strategic exposures
- `purchase_scenarios`: zero or more recommendation scenarios
- `source_fingerprints`: zero or more source identities
- `input_fingerprint`: `sha256:<64 lowercase hex characters>`

## Canonicalization for fingerprinting

For VI-001, canonicalization MUST:

1. remove the top-level `input_fingerprint` field;
2. serialize the remaining object as UTF-8 JSON;
3. sort object keys lexicographically at every level;
4. emit no insignificant whitespace;
5. preserve array order;
6. hash the resulting bytes with SHA-256;
7. encode the result as lowercase hexadecimal prefixed with `sha256:`.

The same logical JSON object with different whitespace or object-key ordering MUST yield the same fingerprint. Array reordering is semantically significant and MAY yield a different fingerprint.

## Domain invariants

- Weights are decimal fractions in the closed interval `[0, 1]`.
- Monetary values use decimal numbers in the declared portfolio currency.
- `revision >= 1`.
- `target_source` is one of `observed`, `estimated`, `manual`.
- `strategy.estimation_status` is one of `observed`, `estimated`, `mixed`, `manual`.
- `strategy.confidence` is one of `high`, `medium`, `low`.
- `active_purchase_instrument`, when present, MUST also occur in `mapped_instruments`.
- Exposure IDs within one snapshot MUST be unique.
- Scenario IDs within one snapshot MUST be unique.
- `input_fingerprint` MUST match the canonicalized payload.

## Acceptance criteria for VI-001

1. A versioned JSON Schema for `portfolio-snapshot/1.0` exists in the repository.
2. One valid fixture conforms to the schema.
3. At least three invalid fixtures are rejected, covering distinct invariant classes.
4. A deterministic fingerprint helper produces the documented fingerprint for the valid fixture.
5. Reformatting JSON or changing object-key order does not change the fingerprint.
6. Changing a semantic value changes the fingerprint.
7. The contract contains no order-execution semantics.
8. Tests can run in CI without network access.

## Deferred decisions

The following are intentionally not decided by VI-001:

- persistence model for imported snapshots;
- file import versus HTTP API as the canonical transport;
- authoritative GPO data providers and estimation algorithm;
- nearest-neighbour ETF scoring;
- portfolio contribution allocation and additional-purchase thresholds;
- final monthly orchestration between portfolio and hedge recommendations.

These decisions must be made in later slices or ADRs without breaking `portfolio-snapshot/1.0` unless a new schema version is introduced.
