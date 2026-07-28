# Roadmap

## Completed in v1.1 foundation

- CI for typecheck, lint, tests and production build
- Versioned TypeScript decision engine with boundary tests
- Improved n8n validation and conflict handling
- Structured API errors with request IDs and duplicate detection
- Decimal storage for monetary values
- Portfolio and hedge-position snapshots
- Optional dashboard Basic Auth

## Next: backtesting and decision quality

1. Import historical NDX, VIX/VXN and option-chain data into immutable market snapshots.
2. Build a backtest runner covering 2000–2002, 2008–2009, 2020, 2022 and later stress periods.
3. Model premium, spread, slippage, expiry, strike and roll costs.
4. Compare no hedge, long put, put spread, collar and staged realization strategies.
5. Add explicit target hedge coverage and recommended contract quantities.
6. Record human approval, actual execution and deviation reasons.

No strategy should be treated as production-ready before historical tests and a documented risk review are complete.
