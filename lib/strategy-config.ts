export type StrategyConfig = {
  version: string;
  drawdownHoldPercent: number;
  drawdownRealizeFirstPercent: number;
  drawdownRealizeSecondPercent: number;
  drawdownCloseMostPercent: number;
  nearHighPercent: number;
  cheapVolatilityPercentile: number;
  expensiveVolatilityPercentile: number;
  targetHedgeCoveragePercent: number;
};

export const DEFAULT_STRATEGY_CONFIG: StrategyConfig = Object.freeze({
  version: '2.1.0',
  drawdownHoldPercent: -20,
  drawdownRealizeFirstPercent: -30,
  drawdownRealizeSecondPercent: -40,
  drawdownCloseMostPercent: -50,
  nearHighPercent: -10,
  cheapVolatilityPercentile: 25,
  expensiveVolatilityPercentile: 80,
  targetHedgeCoveragePercent: 100
});

export function validateStrategyConfig(config: StrategyConfig): void {
  const drawdowns = [
    config.drawdownHoldPercent,
    config.drawdownRealizeFirstPercent,
    config.drawdownRealizeSecondPercent,
    config.drawdownCloseMostPercent
  ];

  if (!(drawdowns[0] > drawdowns[1] && drawdowns[1] > drawdowns[2] && drawdowns[2] > drawdowns[3])) {
    throw new Error('Drawdown thresholds must become progressively more negative.');
  }

  for (const percentile of [config.cheapVolatilityPercentile, config.expensiveVolatilityPercentile]) {
    if (percentile < 0 || percentile > 100) throw new Error('Volatility percentiles must be between 0 and 100.');
  }

  if (config.cheapVolatilityPercentile >= config.expensiveVolatilityPercentile) {
    throw new Error('Cheap volatility percentile must be below expensive volatility percentile.');
  }

  if (config.targetHedgeCoveragePercent < 0) throw new Error('Target hedge coverage cannot be negative.');
}
