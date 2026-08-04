import { DEFAULT_STRATEGY_CONFIG, StrategyConfig } from './strategy-config';

export type StrategyExplanationInput = {
  drawdownPercent: number;
  vixPercentile: number;
  hedgeCoveragePercent: number | null;
  action: string;
};

export type StrategyExplanation = {
  summary: string;
  reasons: string[];
  coverageNote: string | null;
};

function fmt(value: number, digits = 1): string {
  return new Intl.NumberFormat('de-DE', {
    maximumFractionDigits: digits,
    minimumFractionDigits: digits
  }).format(value);
}

export function explainDecisionForBeginner(
  input: StrategyExplanationInput,
  config: StrategyConfig = DEFAULT_STRATEGY_CONFIG
): StrategyExplanation {
  const reasons: string[] = [];

  if (input.drawdownPercent > config.nearHighPercent) {
    reasons.push(
      `Der NASDAQ-100 liegt nur ${fmt(Math.abs(input.drawdownPercent))} % unter seinem 2-Jahres-Hoch. Damit gilt der Markt in dieser Strategie als „nahe am Hoch“ (Schwelle: besser als ${fmt(config.nearHighPercent)} %).`
    );
  } else if (input.drawdownPercent <= config.drawdownCloseMostPercent) {
    reasons.push(
      `Der NASDAQ-100 liegt ${fmt(Math.abs(input.drawdownPercent))} % unter seinem 2-Jahres-Hoch. Das liegt im extremen Drawdown-Bereich ab ${fmt(Math.abs(config.drawdownCloseMostPercent))} %.`
    );
  } else if (input.drawdownPercent <= config.drawdownRealizeSecondPercent) {
    reasons.push(
      `Der NASDAQ-100 liegt ${fmt(Math.abs(input.drawdownPercent))} % unter seinem 2-Jahres-Hoch. Das liegt im schweren Drawdown-Bereich ab ${fmt(Math.abs(config.drawdownRealizeSecondPercent))} %.`
    );
  } else if (input.drawdownPercent <= config.drawdownRealizeFirstPercent) {
    reasons.push(
      `Der NASDAQ-100 liegt ${fmt(Math.abs(input.drawdownPercent))} % unter seinem 2-Jahres-Hoch. Das liegt im deutlichen Drawdown-Bereich ab ${fmt(Math.abs(config.drawdownRealizeFirstPercent))} %.`
    );
  } else if (input.drawdownPercent <= config.drawdownHoldPercent) {
    reasons.push(
      `Der NASDAQ-100 liegt ${fmt(Math.abs(input.drawdownPercent))} % unter seinem 2-Jahres-Hoch. Ab ${fmt(Math.abs(config.drawdownHoldPercent))} % Drawdown wird ein vorhandener Hedge grundsätzlich gehalten.`
    );
  } else {
    reasons.push(
      `Der NASDAQ-100 liegt ${fmt(Math.abs(input.drawdownPercent))} % unter seinem 2-Jahres-Hoch und damit zwischen „nahe am Hoch“ und dem ersten Korrektur-Schwellenwert.`
    );
  }

  if (input.vixPercentile < config.cheapVolatilityPercentile) {
    reasons.push(
      `Der VIX liegt im ${fmt(input.vixPercentile)}. Perzentil der letzten zwei Jahre. Er ist damit im historischen Vergleich relativ günstig (unter ${fmt(config.cheapVolatilityPercentile, 0)} %).`
    );
  } else if (input.vixPercentile > config.expensiveVolatilityPercentile) {
    reasons.push(
      `Der VIX liegt im ${fmt(input.vixPercentile)}. Perzentil der letzten zwei Jahre. Absicherung ist damit im historischen Vergleich teuer (über ${fmt(config.expensiveVolatilityPercentile, 0)} %).`
    );
  } else {
    reasons.push(
      `Der VIX liegt im ${fmt(input.vixPercentile)}. Perzentil der letzten zwei Jahre und damit weder im günstigen noch im besonders teuren Bereich.`
    );
  }

  let coverageNote: string | null = null;
  if (input.hedgeCoveragePercent == null) {
    coverageNote =
      'Die Hedge-Abdeckung ist unbekannt. Ein BUY_OR_ROLL_PUTS-Signal bestätigt deshalb nur das Markt-Setup; ob tatsächlich eine Hedge-Lücke besteht, ist noch nicht positionsbezogen bestätigt.';
  } else if (input.hedgeCoveragePercent < config.targetHedgeCoveragePercent) {
    reasons.push(
      `Die gemeldete Hedge-Abdeckung beträgt ${fmt(input.hedgeCoveragePercent)} % und liegt unter dem konfigurierten Ziel von ${fmt(config.targetHedgeCoveragePercent, 0)} %.`
    );
  } else {
    reasons.push(
      `Die gemeldete Hedge-Abdeckung beträgt ${fmt(input.hedgeCoveragePercent)} % und erreicht damit das konfigurierte Ziel von ${fmt(config.targetHedgeCoveragePercent, 0)} %.`
    );
  }

  const summaries: Record<string, string> = {
    BUY_OR_ROLL_PUTS: 'Der Markt ist nahe am Referenzhoch und Volatilität ist günstig genug, um eine bestehende Hedge-Lücke zu prüfen oder Puts zu rollen.',
    DO_NOT_BUY_NEW_PUTS: 'Volatilität ist historisch teuer. Die Strategie vermeidet deshalb den Kauf neuer Puts.',
    HOLD_HEDGE: 'Der Markt befindet sich in einer stärkeren Korrektur. Ein vorhandener Hedge soll seine Schutzfunktion weiter erfüllen.',
    REALIZE_25_PERCENT: 'Der Drawdown ist groß genug, um einen ersten Teil der Hedge-Gewinne zu realisieren und Liquidität für Reinvestitionen bereitzustellen.',
    REALIZE_35_PERCENT_MORE: 'Der Drawdown ist schwer. Nach der ersten Realisierung soll ein weiterer Teil der Hedge-Gewinne freigesetzt werden.',
    CLOSE_MOST_HEDGE_AND_BUY_EQUITIES: 'Der Markt befindet sich im extremen Drawdown. Der Großteil des Hedges soll laut Regelwerk monetarisiert und für gestaffelte Aktienkäufe verfügbar gemacht werden.',
    HOLD: 'Keine Regel verlangt aktuell eine Änderung. Der bestehende Zustand wird beibehalten.'
  };

  return {
    summary: summaries[input.action] ?? 'Die aktuelle Entscheidung folgt den konfigurierten Hedge-Regeln.',
    reasons,
    coverageNote
  };
}

export function actionLabel(action: string): string {
  const labels: Record<string, string> = {
    HOLD: 'Halten / nichts ändern',
    BUY_OR_ROLL_PUTS: 'Puts aufbauen oder rollen',
    DO_NOT_BUY_NEW_PUTS: 'Keine neuen Puts kaufen',
    HOLD_HEDGE: 'Bestehenden Hedge halten',
    REALIZE_25_PERCENT: '25 % der Hedge-Gewinne realisieren',
    REALIZE_35_PERCENT_MORE: 'Weitere 35 % realisieren',
    CLOSE_MOST_HEDGE_AND_BUY_EQUITIES: 'Großteil des Hedges schließen und Reinvestition vorbereiten'
  };
  return labels[action] ?? action;
}
