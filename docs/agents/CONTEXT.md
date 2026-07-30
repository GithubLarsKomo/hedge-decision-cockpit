# Repository Domain Context

## Mission

The repository supports a rules-based NASDAQ tail-risk hedge process. It combines market observations, deterministic recommendations, historical simulation and documented human decisions. It is a decision-support and monitoring system, not an execution venue or investment-advice service.

Sources: `README.md`, `docs/ROADMAP.md`.

## Core domain objects

- **Market observation / snapshot:** timestamped NDX, volatility-index, rate and source data with validation and deterministic fingerprints.
- **Decision run:** evaluation of a market observation against a versioned rule set.
- **Triggered rule:** named condition that explains why an action or severity was produced.
- **Portfolio snapshot:** observed portfolio market value at a point in time.
- **Hedge snapshot / position:** observed hedge value, coverage and option-strategy state.
- **Strategy configuration:** validated thresholds and parameters used by deterministic simulations.
- **Option chain observation:** timestamped option contract data including expiry, strike, type and market prices.
- **Stress period:** defined historical interval used to verify dataset coverage and strategy behavior.
- **Backtest:** chronological simulation with explicit costs, cash flows, drawdown and rule trace.
- **Human approval / execution record:** planned roadmap object for documenting approval, actual execution and deviation reasons.

## Strategies in scope

- No hedge
- Long put
- Put spread
- Collar
- Staged realization

The roadmap requires comparison over time and explicit hedge-coverage and contract-sizing recommendations before any strategy is considered production-ready.

## Actors

- **Human decision-maker:** reviews recommendations and remains responsible for any transaction.
- **Dashboard user:** inspects current and historical decisions, portfolio and hedge state.
- **n8n workflow:** collects market data, mirrors decision logic and submits decision runs through the ingest API.
- **Application API:** validates, fingerprints and persists incoming decision data.
- **CI pipeline:** verifies code quality, runtime behavior, container security and supply-chain evidence.

## Important terminology

- **NDX:** NASDAQ-100 index.
- **VIX/VXN:** volatility indices used as market-risk inputs; VXN is NASDAQ-oriented.
- **Tail-risk hedge:** protection intended for severe market declines rather than ordinary volatility.
- **Hedge coverage:** protected share of portfolio exposure, expressed as a percentage or target amount.
- **DTE:** days to expiry for an option contract.
- **Roll:** closing or replacing an option position because of time or threshold rules.
- **Greeks:** option sensitivities such as delta, gamma and vega.
- **Input fingerprint:** SHA-256 identity used for duplicate detection and reproducibility.
- **Rule version:** explicit version identifying the decision logic used for a run.

## System boundaries

In scope:

- market-data normalization and import,
- deterministic decision rules,
- historical and portfolio backtests,
- option pricing and strategy valuation,
- transaction-cost modelling,
- persistence and auditability,
- dashboard presentation,
- human approval and execution documentation.

Out of scope unless explicitly decided:

- broker connectivity,
- autonomous order placement,
- discretionary investment advice,
- secret storage in repository files,
- treating simulated performance as production validation.

## Current roadmap context

Completed foundations include decision rules, portfolio backtesting, option pricing and strategies, execution costs, market-snapshot import and immutable persistence. The active roadmap expands historical datasets and dynamic strategy simulation through stress-period coverage, expiry and roll rules, strategy comparison, contract sizing and human approval records.

Source: `docs/ROADMAP.md`.
