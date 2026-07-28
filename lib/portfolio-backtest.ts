import { MarketObservation, runBacktest } from './backtest';
import { DEFAULT_STRATEGY_CONFIG, StrategyConfig } from './strategy-config';

export type PortfolioObservation = MarketObservation & {
  hedgeMarketValueEur?: number;
  hedgeCashFlowEur?: number;
  transactionCostEur?: number;
};

export type PortfolioBacktestConfig = {
  initialPortfolioValueEur: number;
  initialHedgeValueEur?: number;
};

export type PortfolioBacktestPoint = {
  observedAt: string;
  unhedgedPortfolioValueEur: number;
  hedgedPortfolioValueEur: number;
  hedgeValueEur: number;
  cumulativeTransactionCostsEur: number;
  drawdownUnhedgedPercent: number;
  drawdownHedgedPercent: number;
};

export type PortfolioBacktestSummary = {
  strategyVersion: string;
  initialPortfolioValueEur: number;
  finalUnhedgedValueEur: number;
  finalHedgedValueEur: number;
  totalHedgeCashFlowsEur: number;
  totalTransactionCostsEur: number;
  maximumUnhedgedDrawdownPercent: number;
  maximumHedgedDrawdownPercent: number;
  hedgeBenefitEur: number;
  points: PortfolioBacktestPoint[];
};

function assertFiniteNonNegative(value: number, label: string) {
  if (!Number.isFinite(value) || value < 0) throw new Error(`${label} must be a finite non-negative number.`);
}

export function runPortfolioBacktest(
  observations: PortfolioObservation[],
  portfolioConfig: PortfolioBacktestConfig,
  strategyConfig: StrategyConfig = DEFAULT_STRATEGY_CONFIG
): PortfolioBacktestSummary {
  assertFiniteNonNegative(portfolioConfig.initialPortfolioValueEur, 'initialPortfolioValueEur');
  if (portfolioConfig.initialPortfolioValueEur === 0) throw new Error('initialPortfolioValueEur must be greater than zero.');

  const initialHedgeValueEur = portfolioConfig.initialHedgeValueEur ?? 0;
  assertFiniteNonNegative(initialHedgeValueEur, 'initialHedgeValueEur');

  const decisionBacktest = runBacktest(observations, strategyConfig);
  const ordered = [...observations].sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));

  let unhedgedValue = portfolioConfig.initialPortfolioValueEur;
  let hedgeValue = initialHedgeValueEur;
  let cumulativeCashFlows = 0;
  let cumulativeCosts = 0;
  let previousNdx = ordered.at(0)?.ndxClose ?? 0;
  let peakUnhedged = unhedgedValue;
  let peakHedged = unhedgedValue + hedgeValue;

  const points = ordered.map((observation, index) => {
    if (index > 0) {
      const marketReturn = observation.ndxClose / previousNdx - 1;
      unhedgedValue *= 1 + marketReturn;
    }
    previousNdx = observation.ndxClose;

    const cashFlow = observation.hedgeCashFlowEur ?? 0;
    const transactionCost = observation.transactionCostEur ?? 0;
    const observedHedgeValue = observation.hedgeMarketValueEur ?? hedgeValue;

    assertFiniteNonNegative(observedHedgeValue, `hedgeMarketValueEur at ${observation.observedAt}`);
    assertFiniteNonNegative(transactionCost, `transactionCostEur at ${observation.observedAt}`);
    if (!Number.isFinite(cashFlow)) throw new Error(`hedgeCashFlowEur at ${observation.observedAt} must be finite.`);

    hedgeValue = observedHedgeValue;
    cumulativeCashFlows += cashFlow;
    cumulativeCosts += transactionCost;

    const hedgedValue = unhedgedValue + hedgeValue + cumulativeCashFlows - cumulativeCosts;
    peakUnhedged = Math.max(peakUnhedged, unhedgedValue);
    peakHedged = Math.max(peakHedged, hedgedValue);

    return {
      observedAt: observation.observedAt,
      unhedgedPortfolioValueEur: Number(unhedgedValue.toFixed(2)),
      hedgedPortfolioValueEur: Number(hedgedValue.toFixed(2)),
      hedgeValueEur: Number(hedgeValue.toFixed(2)),
      cumulativeTransactionCostsEur: Number(cumulativeCosts.toFixed(2)),
      drawdownUnhedgedPercent: Number(((unhedgedValue / peakUnhedged - 1) * 100).toFixed(4)),
      drawdownHedgedPercent: Number(((hedgedValue / peakHedged - 1) * 100).toFixed(4))
    };
  });

  const finalUnhedgedValueEur = points.at(-1)?.unhedgedPortfolioValueEur ?? portfolioConfig.initialPortfolioValueEur;
  const finalHedgedValueEur = points.at(-1)?.hedgedPortfolioValueEur ?? portfolioConfig.initialPortfolioValueEur + initialHedgeValueEur;

  return {
    strategyVersion: decisionBacktest.strategyVersion,
    initialPortfolioValueEur: portfolioConfig.initialPortfolioValueEur,
    finalUnhedgedValueEur,
    finalHedgedValueEur,
    totalHedgeCashFlowsEur: Number(cumulativeCashFlows.toFixed(2)),
    totalTransactionCostsEur: Number(cumulativeCosts.toFixed(2)),
    maximumUnhedgedDrawdownPercent: points.length ? Math.min(...points.map(point => point.drawdownUnhedgedPercent)) : 0,
    maximumHedgedDrawdownPercent: points.length ? Math.min(...points.map(point => point.drawdownHedgedPercent)) : 0,
    hedgeBenefitEur: Number((finalHedgedValueEur - finalUnhedgedValueEur).toFixed(2)),
    points
  };
}
