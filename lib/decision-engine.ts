export const RULE_VERSION = '2.0.0';

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

export function evaluateDecision(input: DecisionEngineInput): DecisionEngineResult {
  const { drawdownPercent, vixPercentile, hedgeCoveragePercent } = input;
  const triggeredRules: string[] = [];

  if (drawdownPercent <= -50) {
    triggeredRules.push('DRAWDOWN_50');
    return {
      action: 'CLOSE_MOST_HEDGE_AND_BUY_EQUITIES', severity: 'red',
      recommendation: 'NASDAQ mindestens 50 % unter Referenzhoch: Tail-Hedge weitgehend schließen und die freigesetzte Liquidität gemäß Reinvestitionsplan einsetzen.',
      triggeredRules, ruleVersion: RULE_VERSION
    };
  }
  if (drawdownPercent <= -40) {
    triggeredRules.push('DRAWDOWN_40');
    return {
      action: 'REALIZE_35_PERCENT_MORE', severity: 'orange',
      recommendation: 'NASDAQ mindestens 40 % unter Referenzhoch: weitere 35 % der Hedge-Gewinne realisieren und gestaffelt reinvestieren.',
      triggeredRules, ruleVersion: RULE_VERSION
    };
  }
  if (drawdownPercent <= -30) {
    triggeredRules.push('DRAWDOWN_30');
    return {
      action: 'REALIZE_25_PERCENT', severity: 'yellow',
      recommendation: 'NASDAQ mindestens 30 % unter Referenzhoch: 25 % der Hedge-Gewinne realisieren und nach festgelegtem Plan reinvestieren.',
      triggeredRules, ruleVersion: RULE_VERSION
    };
  }
  if (drawdownPercent <= -20) {
    triggeredRules.push('DRAWDOWN_20');
    if (vixPercentile > 80) triggeredRules.push('VIX_EXPENSIVE');
    return {
      action: 'HOLD_HEDGE', severity: vixPercentile > 80 ? 'orange' : 'yellow',
      recommendation: 'NASDAQ mindestens 20 % unter Referenzhoch: bestehenden Hedge halten; bei hohem VIX keine neue Absicherung zukaufen.',
      triggeredRules, ruleVersion: RULE_VERSION
    };
  }
  if (vixPercentile > 80) {
    triggeredRules.push('VIX_EXPENSIVE');
    return {
      action: 'DO_NOT_BUY_NEW_PUTS', severity: 'orange',
      recommendation: 'Implizite Volatilität ist historisch hoch: keine neuen Puts kaufen; bestehende Positionen prüfen und Kostenrisiko vermeiden.',
      triggeredRules, ruleVersion: RULE_VERSION
    };
  }
  if (drawdownPercent > -10 && vixPercentile < 25 && (hedgeCoveragePercent == null || hedgeCoveragePercent < 100)) {
    triggeredRules.push('NEAR_HIGH', 'VIX_CHEAP');
    if (hedgeCoveragePercent != null) triggeredRules.push('HEDGE_UNDER_TARGET');
    return {
      action: 'BUY_OR_ROLL_PUTS', severity: 'blue',
      recommendation: 'Markt nahe Referenzhoch und Volatilität günstig: Hedge-Lücke prüfen und Puts regelbasiert aufbauen oder rollen.',
      triggeredRules, ruleVersion: RULE_VERSION
    };
  }

  triggeredRules.push('NO_ACTION');
  return {
    action: 'HOLD', severity: 'green',
    recommendation: 'Keine Aktion. Bestehende Hedge-Struktur und Risikolimits beibehalten.',
    triggeredRules, ruleVersion: RULE_VERSION
  };
}
