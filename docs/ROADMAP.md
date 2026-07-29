# Roadmap

## Completed in v1.1 foundation

- CI for typecheck, lint, tests and production build
- Versioned TypeScript decision engine with boundary tests
- Improved n8n validation and conflict handling
- Structured API errors with request IDs and duplicate detection
- Decimal storage for monetary values
- Portfolio and hedge-position snapshots
- Optional dashboard Basic Auth

## Completed in v1.2 backtest foundation

- Validated, versioned strategy configuration instead of hard-coded thresholds
- Deterministic backtest runner for chronological market observations
- Action counts, maximum drawdown and rule trace per observation
- Tests for observation ordering, invalid market data and invalid strategy thresholds

## Completed in v1.3 portfolio backtest foundation

- Comparison of hedged and unhedged portfolio values in Euro
- Observed hedge market values and realized hedge cash flows
- Explicit transaction-cost accounting
- Maximum drawdown comparison and hedge-benefit metric
- Validation and tests for portfolio economics inputs

## Completed in v1.4 option pricing foundation

- European call and put valuation with continuous dividend yield
- Delta, gamma and vega calculation
- Deterministic expiry and zero-volatility handling
- Contract multiplier and FX conversion into Euro position values
- Put-call-parity and boundary tests

## Completed in v1.5 option strategies

- Reusable long put, put spread and collar valuation
- Aggregated strategy market value and net Greeks
- Validation for quantities, multipliers and strike ordering

## Completed in v1.6 execution costs

- Bid and ask aware trade execution
- Configurable slippage in basis points
- Per-contract commissions and FX conversion
- Aggregated multi-leg strategy cash flow and execution costs

## Completed in v1.7 market snapshot import foundation

- Canonical normalization of historical market observations
- Deterministic SHA-256 content fingerprints
- Chronological batch ordering and duplicate detection
- Validation of NDX, VIX/VXN, rates and source metadata

## Completed in v1.8 immutable snapshot persistence

- Prisma persistence model for historical market snapshots
- Unique content hashes and source/timestamp constraints
- Idempotent batch insertion with explicit inserted and skipped counts
- Mapping and validation tests independent of the database adapter

## Next: historical datasets and dynamic strategy simulation

1. Add concrete CSV importers for NDX, VIX/VXN and option-chain observations.
2. Cover 2000–2002, 2008–2009, 2020, 2022 and later stress periods.
3. Add expiry selection and scheduled or threshold-based roll rules.
4. Compare no hedge, long put, put spread, collar and staged realization strategies over time.
5. Add explicit target hedge coverage and recommended contract quantities.
6. Record human approval, actual execution and deviation reasons.

No strategy should be treated as production-ready before historical tests and a documented risk review are complete.