const ndx = $('NASDAQ 100').first().json.chart.result[0];
const vix = $('VIX').first().json.chart.result[0];

function closes(series) {
  return series.indicators.quote[0].close.filter(Number.isFinite);
}

const ndxCloses = closes(ndx);
const vixCloses = closes(vix);

if (ndxCloses.length < 400 || vixCloses.length < 200) {
  throw new Error(`Insufficient market history: NDX=${ndxCloses.length}, VIX=${vixCloses.length}`);
}

const ndxNow = ndxCloses.at(-1);
const ndxHigh2y = Math.max(...ndxCloses);
const drawdownPercent = (ndxNow / ndxHigh2y - 1) * 100;
const vixNow = vixCloses.at(-1);
const vixSorted = [...vixCloses].sort((a, b) => a - b);
const vixPercentile = vixSorted.filter(x => x <= vixNow).length / vixSorted.length * 100;
const hedgeCoveragePercent = $json.hedgeCoveragePercent ?? null;

let action = 'HOLD';
let severity = 'green';
let recommendation = 'Keine Aktion. Bestehende Hedge-Struktur und Risikolimits beibehalten.';
const triggeredRules = [];

if (drawdownPercent <= -50) {
  action = 'CLOSE_MOST_HEDGE_AND_BUY_EQUITIES'; severity = 'red'; triggeredRules.push('DRAWDOWN_50');
  recommendation = 'NASDAQ mindestens 50 % unter Referenzhoch: Tail-Hedge weitgehend schließen und die freigesetzte Liquidität gemäß Reinvestitionsplan einsetzen.';
} else if (drawdownPercent <= -40) {
  action = 'REALIZE_35_PERCENT_MORE'; severity = 'orange'; triggeredRules.push('DRAWDOWN_40');
  recommendation = 'NASDAQ mindestens 40 % unter Referenzhoch: weitere 35 % der Hedge-Gewinne realisieren und gestaffelt reinvestieren.';
} else if (drawdownPercent <= -30) {
  action = 'REALIZE_25_PERCENT'; severity = 'yellow'; triggeredRules.push('DRAWDOWN_30');
  recommendation = 'NASDAQ mindestens 30 % unter Referenzhoch: 25 % der Hedge-Gewinne realisieren und nach festgelegtem Plan reinvestieren.';
} else if (drawdownPercent <= -20) {
  action = 'HOLD_HEDGE'; severity = vixPercentile > 80 ? 'orange' : 'yellow'; triggeredRules.push('DRAWDOWN_20');
  if (vixPercentile > 80) triggeredRules.push('VIX_EXPENSIVE');
  recommendation = 'NASDAQ mindestens 20 % unter Referenzhoch: bestehenden Hedge halten; bei hohem VIX keine neue Absicherung zukaufen.';
} else if (vixPercentile > 80) {
  action = 'DO_NOT_BUY_NEW_PUTS'; severity = 'orange'; triggeredRules.push('VIX_EXPENSIVE');
  recommendation = 'Implizite Volatilität ist historisch hoch: keine neuen Puts kaufen; bestehende Positionen prüfen und Kostenrisiko vermeiden.';
} else if (drawdownPercent > -10 && vixPercentile < 25 && (hedgeCoveragePercent == null || hedgeCoveragePercent < 100)) {
  action = 'BUY_OR_ROLL_PUTS'; severity = 'blue'; triggeredRules.push('NEAR_HIGH', 'VIX_CHEAP');
  if (hedgeCoveragePercent != null) triggeredRules.push('HEDGE_UNDER_TARGET');
  recommendation = 'Markt nahe Referenzhoch und Volatilität günstig: Hedge-Lücke prüfen und Puts regelbasiert aufbauen oder rollen.';
} else {
  triggeredRules.push('NO_ACTION');
}

return [{ json: {
  observedAt: new Date().toISOString(), source: 'n8n/yahoo-chart', ruleVersion: '2.0.0', triggeredRules,
  ndxNow, ndxHigh2y, drawdownPercent: Number(drawdownPercent.toFixed(2)),
  vixNow: Number(vixNow.toFixed(2)), vixPercentile: Number(vixPercentile.toFixed(1)),
  hedgeCoveragePercent, action, severity, recommendation
} }];
