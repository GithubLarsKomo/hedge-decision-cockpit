import {
  PortfolioBacktestConfig,
  PortfolioBacktestSummary,
  PortfolioObservation,
  runPortfolioBacktest
} from './portfolio-backtest';
import { DEFAULT_STRATEGY_CONFIG, StrategyConfig } from './strategy-config';

export type HedgeStrategyKind =
  | 'NO_HEDGE'
  | 'LONG_PUT'
  | 'PUT_SPREAD'
  | 'COLLAR'
  | 'STAGED_REALIZATION';

export type StrategyScenario = {
  id: string;
  kind: HedgeStrategyKind;
  observations: PortfolioObservation[];
};

export type StrategyComparisonRow = {
  id: string;
  kind: HedgeStrategyKind;
  finalPortfolioValueEur: number;
  hedgeBenefitEur: number;
  totalTransactionCostsEur: number;
  maximumDrawdownPercent: number;
};

export type StrategyComparison = {
  baselineId: string;
  bestFinalValueId: string;
  lowestDrawdownId: string;
  rows: StrategyComparisonRow[];
  summaries: Record<string, PortfolioBacktestSummary>;
};

function assertScenario(scenario: StrategyScenario) {
  if (!scenario.id.trim()) throw new Error('Strategy scenario id must not be empty.');
  if (!Array.isArray(scenario.observations)) throw new Error(`Scenario ${scenario.id} observations must be an array.`);
}

function rankBy<T>(rows: T[], value: (row: T) => number, direction: 'asc' | 'desc') {
  return [...rows].sort((left, right) => {
    const difference = value(left) - value(right);
    return direction === 'asc' ? difference : -difference;
  });
}

export function compareStrategyScenarios(
  scenarios: StrategyScenario[],
  portfolioConfig: PortfolioBacktestConfig,
  strategyConfig: StrategyConfig = DEFAULT_STRATEGY_CONFIG
): StrategyComparison {
  if (scenarios.length < 2) throw new Error('At least two strategy scenarios are required.');

  const ids = new Set<string>();
  for (const scenario of scenarios) {
    assertScenario(scenario);
    if (ids.has(scenario.id)) throw new Error(`Duplicate strategy scenario id: ${scenario.id}`);
    ids.add(scenario.id);
  }

  const baseline = scenarios.find(scenario => scenario.kind === 'NO_HEDGE');
  if (!baseline) throw new Error('A NO_HEDGE baseline scenario is required.');

  const summaries = Object.fromEntries(
    scenarios.map(scenario => [
      scenario.id,
      runPortfolioBacktest(scenario.observations, portfolioConfig, strategyConfig)
    ])
  );

  const rows = scenarios.map(scenario => {
    const summary = summaries[scenario.id];
    return {
      id: scenario.id,
      kind: scenario.kind,
      finalPortfolioValueEur: summary.finalHedgedValueEur,
      hedgeBenefitEur: summary.hedgeBenefitEur,
      totalTransactionCostsEur: summary.totalTransactionCostsEur,
      maximumDrawdownPercent: summary.maximumHedgedDrawdownPercent
    };
  });

  return {
    baselineId: baseline.id,
    bestFinalValueId: rankBy(rows, row => row.finalPortfolioValueEur, 'desc')[0].id,
    lowestDrawdownId: rankBy(rows, row => row.maximumDrawdownPercent, 'desc')[0].id,
    rows,
    summaries
  };
}
