import {
  evaluateDecision,
  type DecisionEngineInput,
  type DecisionEngineResult
} from './decision-engine';
import { validatePortfolioSnapshot } from './portfolio-snapshot';

export type PortfolioHedgeEvaluation = {
  snapshot: {
    snapshotId: string;
    revision: number;
    asOf: string;
    inputFingerprint: string;
  };
  portfolio: {
    currency: string;
    marketValue: number;
    targetEquityWeight: number;
    currentEquityWeight: number;
    equityGapAmount: number;
  };
  tacticalInputs: DecisionEngineInput;
  hedgeDecision: DecisionEngineResult;
};

function validateTacticalInputs(input: DecisionEngineInput): DecisionEngineInput {
  if (!Number.isFinite(input.drawdownPercent)) {
    throw new Error('drawdownPercent must be finite.');
  }
  if (!Number.isFinite(input.vixPercentile) || input.vixPercentile < 0 || input.vixPercentile > 100) {
    throw new Error('vixPercentile must be between 0 and 100.');
  }
  if (
    input.hedgeCoveragePercent != null &&
    (!Number.isFinite(input.hedgeCoveragePercent) || input.hedgeCoveragePercent < 0)
  ) {
    throw new Error('hedgeCoveragePercent must be non-negative when supplied.');
  }

  return {
    drawdownPercent: input.drawdownPercent,
    vixPercentile: input.vixPercentile,
    hedgeCoveragePercent: input.hedgeCoveragePercent ?? null
  };
}

export function evaluatePortfolioHedgeDecision(
  snapshotValue: unknown,
  tacticalInputValue: DecisionEngineInput
): PortfolioHedgeEvaluation {
  const snapshot = validatePortfolioSnapshot(snapshotValue);
  const tacticalInputs = validateTacticalInputs(tacticalInputValue);
  const hedgeDecision = evaluateDecision(tacticalInputs);

  return {
    snapshot: {
      snapshotId: snapshot.snapshot_id,
      revision: snapshot.revision,
      asOf: snapshot.as_of,
      inputFingerprint: snapshot.input_fingerprint
    },
    portfolio: {
      currency: snapshot.portfolio.currency,
      marketValue: snapshot.portfolio.market_value,
      targetEquityWeight: snapshot.portfolio.target_equity_weight,
      currentEquityWeight: snapshot.portfolio.current_equity_weight,
      equityGapAmount: snapshot.portfolio.equity_gap_amount
    },
    tacticalInputs,
    hedgeDecision
  };
}
