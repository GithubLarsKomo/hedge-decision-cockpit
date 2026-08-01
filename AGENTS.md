# Repository agent context

## Product boundary

This repository is a decision-support cockpit for tactical NASDAQ hedge decisions. It may validate, persist, compare and report portfolio and hedge data, but it must not execute broker orders automatically.

The upstream portfolio-engine responsibility is strategic portfolio construction: monthly target allocations, exposure aggregation, versioned ETF nearest-neighbour mappings, drift, contribution allocation and reproducible `portfolio-snapshot/1.0` exports.

The hedge-decision-cockpit responsibility is downstream: validate/import the portfolio snapshot, preserve its identity and fingerprint, evaluate tactical hedge rules from explicit market inputs, document decisions, and later document human-approved execution outcomes.

## Canonical modules

- `lib/portfolio-snapshot.ts`: versioned portfolio contract, validation and SHA-256 fingerprinting.
- `lib/portfolio-snapshot-import.ts`: idempotent snapshot persistence.
- `lib/portfolio-snapshot-generator.ts`: local deterministic monthly snapshot generation.
- `lib/exposure-mapping.ts`: instrument holdings aggregated to strategic exposures.
- `lib/nearest-neighbour-ranking.ts`: transparent deterministic candidate scorer.
- `lib/etf-nearest-neighbour-mapping.ts`: versioned ETF mapping contract and adapter.
- `lib/portfolio-allocation.ts`: drift and monthly contribution allocation.
- `lib/portfolio-decision-variants.ts`: additional-cash variants; hedge context is metadata only.
- `lib/monthly-portfolio-workflow.ts`: canonical monthly portfolio orchestration.
- `lib/monthly-decision-report.ts`: stable reporting wrapper around the canonical workflow.
- `lib/portfolio-hedge-integration.ts`: explicit seam from validated portfolio snapshot + tactical market inputs to the hedge rule engine.
- `lib/decision-engine.ts`: canonical tactical hedge rules.

## Invariants

1. A completed monthly snapshot is immutable; corrections use a new revision.
2. The same `input_fingerprint` is idempotent and must never refer to contradictory content.
3. Strategic exposures and concrete tradable instruments remain separate concepts.
4. Legacy holdings may contribute to an exposure without being eligible for new purchases.
5. Exposure/index fidelity dominates marginal TER differences in nearest-neighbour selection.
6. Portfolio data must not silently generate tactical market signals.
7. Tactical hedge inputs must not mutate the portfolio snapshot.
8. Portfolio and hedge logic return recommendations/variants only; final transaction decisions remain human.
9. Do not introduce automatic broker/order execution through portfolio integration work.
10. New integration behavior should be deterministic, versioned where policy changes matter, and covered by acceptance-first tests.

## Engineering workflow

Prefer small vertical slices. Before adding a new module, inspect existing canonical paths to avoid duplicate orchestration. For CI failures, fix the observed root cause only. Preserve stable serialization and explicit fingerprints at integration boundaries.
