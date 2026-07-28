import { DEFAULT_STRATEGY_CONFIG, StrategyConfig, validateStrategyConfig } from './strategy-config';

export const RULE_VERSION = DEFAULT_STRATEGY_CONFIG.version;

export type DecisionAction =
  | 'HOLD'
  | 'BUY_OR_ROLL_PUTS'
  | 'DO_NOT_BUY_NEW_PUTS'
  | 'HOLD_HEDGE'
  | 'REALIZE_25_PERCENT'
  | 'REALIZE_35_PERCENT_MORE'
  | 'CLOSE_MOST_HEDGE_AND_BUY_EQUITIES';

export type DecisionSeverity = 'green' | 'blue' | 'yellow' | 'orange' | 'red';

export type DecisionEngineInput = {
  drawdownPercent: number;
  vixPercentile: number;
  hedgeCoveragePercent?: number | null;
};

export type DecisionEngineResult = {
  action: DecisionAction;
  severity: DecisionSeverity;
  recommendation: string;
  triggeredRules: string[];
  ruleVersion: string;
};

export function evaluateDecision(
  input: DecisionEngineInput,
  config: StrategyConfig = DEFAULT_STRATEGY_CONFIG
): DecisionEngineResult {
  validateStrategyConfig(config);
  const { drawdownPercent, vixPercentile, hedgeCoveragePercent } = input;
  const triggeredRules: string[] = [];

  if (drawdownPercent <= config.drawdownCloseMostPercent) {
    triggeredRules.push('DRAWDOWN_CLOSE_MOST');
    return {
      action: 'CLOSE_MOST_HEDGE_AND_BUY_EQUITIES', severity: 'red',
      recommendation: 'NASDAQ im extremen Drawdown: Tail-Hedge weitgehend schließen und die freigesetzte Liquidität gemäß Reinvestitionsplan einsetzen.',
      triggeredRules, ruleVersion: config.version
    };
  }
  if (drawdownPercent <= config.drawdownRealizeSecondPercent) {
    triggeredRules.push('DRAWDOWN_REALIZE_SECOND');
    return {
      action: 'REALIZE_35_PERCENT_MORE', severity: 'orange',
      recommendation: 'NASDAQ im schweren Drawdown: weitere 35 % der Hedge-Gewinne realisieren und gestaffelt reinvestieren.',
      triggeredRules, ruleVersion: config.version
    };
  }
  if (drawdownPercent <= config.drawdownRealizeFirstPercent) {
    triggeredRules.push('DRAWDOWN_REALIZE_FIRST');
    return {
      action: 'REALIZE_25_PERCENT', severity: 'yellow',
      recommendation: 'NASDAQ im deutlichen Drawdown: 25 % der Hedge-Gewinne realisieren und nach festgelegtem Plan reinvestieren.',
      triggeredRules, ruleVersion: config.version
    };
  }
  if (drawdownPercent <= config.drawdownHoldPercent) {
    triggeredRules.push('DRAWDOWN_HOLD');
    if (vixPercentile > config.expensiveVolatilityPercentile) triggeredRules.push('VIX_EXPENSIVE');
    return {
      action: 'HOLD_HEDGE', severity: vixPercentile > config.expensiveVolatilityPercentile ? 'orange' : 'yellow',
      recommendation: 'NASDAQ im Korrekturregime: bestehenden Hedge halten; bei hoher Volatilität keine neue Absicherung zukaufen.',
      triggeredRules, ruleVersion: config.version
    };
  }
  if (vixPercentile > config.expensiveVolatilityPercentile) {
    triggeredRules.push('VIX_EXPENSIVE');
    return {
      action: 'DO_NOT_BUY_NEW_PUTS', severity: 'orange',
      recommendation: 'Implizite Volatilität ist historisch hoch: keine neuen Puts kaufen; bestehende Positionen prüfen und Kostenrisiko vermeiden.',
      triggeredRules, ruleVersion: config.version
    };
  }
  if (
    drawdownPercent > config.nearHighPercent &&
    vixPercentile < config.cheapVolatilityPercentile &&
    (hedgeCoveragePercent == null || hedgeCoveragePercent < config.targetHedgeCoveragePercent)
  ) {
    triggeredRules.push('NEAR_HIGH', 'VIX_CHEAP');
    if (hedgeCoveragePercent != null) triggeredRules.push('HEDGE_UNDER_TARGET');
    return {
      action: 'BUY_OR_ROLL_PUTS', severity: 'blue',
      recommendation: 'Markt nahe Referenzhoch und Volatilität günstig: Hedge-Lücke prüfen und Puts regelbasiert aufbauen oder rollen.',
      triggeredRules, ruleVersion: config.version
    };
  }

  triggeredRules.push('NO_ACTION');
  return {
    action: 'HOLD', severity: 'green',
    recommendation: 'Keine Aktion. Bestehende Hedge-Struktur und Risikolimits beibehalten.',
    triggeredRules, ruleVersion: config.version
  };
}
