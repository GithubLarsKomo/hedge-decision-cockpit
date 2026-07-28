import { DecisionAction, evaluateDecision } from './decision-engine';
import { DEFAULT_STRATEGY_CONFIG, StrategyConfig } from './strategy-config';

export type MarketObservation = {
  observedAt: string;
  ndxClose: number;
  ndxReferenceHigh: number;
  vixPercentile: number;
  hedgeCoveragePercent?: number | null;
};

export type BacktestDecision = MarketObservation & {
  drawdownPercent: number;
  action: DecisionAction;
  ruleVersion: string;
  triggeredRules: string[];
};

export type BacktestSummary = {
  strategyVersion: string;
  observationCount: number;
  actionCounts: Record<DecisionAction, number>;
  maximumDrawdownPercent: number;
  firstObservationAt: string | null;
  lastObservationAt: string | null;
  decisions: BacktestDecision[];
};

const ACTIONS: DecisionAction[] = [
  'HOLD',
  'BUY_OR_ROLL_PUTS',
  'DO_NOT_BUY_NEW_PUTS',
  'HOLD_HEDGE',
  'REALIZE_25_PERCENT',
  'REALIZE_35_PERCENT_MORE',
  'CLOSE_MOST_HEDGE_AND_BUY_EQUITIES'
];

export function runBacktest(
  observations: MarketObservation[],
  config: StrategyConfig = DEFAULT_STRATEGY_CONFIG
): BacktestSummary {
  const ordered = [...observations].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));
  const actionCounts = Object.fromEntries(ACTIONS.map(action => [action, 0])) as Record<DecisionAction, number>;

  const decisions = ordered.map(observation => {
    if (!Number.isFinite(observation.ndxClose) || observation.ndxClose <= 0) {
      throw new Error(`Invalid NDX close at ${observation.observedAt}.`);
    }
    if (!Number.isFinite(observation.ndxReferenceHigh) || observation.ndxReferenceHigh <= 0) {
      throw new Error(`Invalid NDX reference high at ${observation.observedAt}.`);
    }
    if (observation.ndxClose > observation.ndxReferenceHigh) {
      throw new Error(`NDX close exceeds reference high at ${observation.observedAt}.`);
    }

    const drawdownPercent = (observation.ndxClose / observation.ndxReferenceHigh - 1) * 100;
    const result = evaluateDecision({
      drawdownPercent,
      vixPercentile: observation.vixPercentile,
      hedgeCoveragePercent: observation.hedgeCoveragePercent
    }, config);

    actionCounts[result.action] += 1;
    return {
      ...observation,
      drawdownPercent: Number(drawdownPercent.toFixed(4)),
      action: result.action,
      ruleVersion: result.ruleVersion,
      triggeredRules: result.triggeredRules
    };
  });

  return {
    strategyVersion: config.version,
    observationCount: decisions.length,
    actionCounts,
    maximumDrawdownPercent: decisions.length
      ? Math.min(...decisions.map(decision => decision.drawdownPercent))
      : 0,
    firstObservationAt: decisions.at(0)?.observedAt ?? null,
    lastObservationAt: decisions.at(-1)?.observedAt ?? null,
    decisions
  };
}
