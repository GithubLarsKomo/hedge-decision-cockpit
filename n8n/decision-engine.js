const ndx = $('NASDAQ 100').first().json.chart.result[0];
const vix = $('VIX').first().json.chart.result[0];

function closes(series) {
  return series.indicators.quote[0].close.filter(x => x !== null);
}

const ndxCloses = closes(ndx);
const vixCloses = closes(vix);

const ndxNow = ndxCloses.at(-1);
const ndxHigh2y = Math.max(...ndxCloses);
const drawdown = (ndxNow / ndxHigh2y - 1) * 100;

const vixNow = vixCloses.at(-1);
const vixSorted = [...vixCloses].sort((a, b) => a - b);
const vixPercentile = vixSorted.filter(x => x <= vixNow).length / vixSorted.length * 100;

let action = 'HOLD';
let severity = 'green';
let recommendation = 'Keine Aktion. Bestehende Hedge-Struktur beibehalten.';

if (drawdown <= -50) {
  action = 'CLOSE_MOST_HEDGE_AND_BUY_EQUITIES';
  severity = 'red';
  recommendation = 'NASDAQ ≥50 % unter 2J-Hoch: Tail-Hedge weitgehend schließen und Aktienquote aggressiv erhöhen.';
} else if (drawdown <= -40) {
  action = 'REALIZE_35_PERCENT_MORE';
  severity = 'orange';
  recommendation = 'NASDAQ ≥40 % unter 2J-Hoch: weitere 35 % der Hedge-Gewinne realisieren und gestaffelt reinvestieren.';
} else if (drawdown <= -30) {
  action = 'REALIZE_25_PERCENT';
  severity = 'yellow';
  recommendation = 'NASDAQ ≥30 % unter 2J-Hoch: 25 % der Hedge-Gewinne realisieren und Qualitätsaktien kaufen.';
} else if (drawdown <= -20) {
  action = 'HOLD_HEDGE';
  severity = 'yellow';
  recommendation = 'NASDAQ ≥20 % unter 2J-Hoch: Hedge halten, noch nicht voreilig schließen.';
} else if (drawdown > -10 && vixPercentile < 25) {
  action = 'BUY_OR_ROLL_PUTS';
  severity = 'blue';
  recommendation = 'Markt nahe Hoch und VIX niedrig: günstiges Zeitfenster zum Aufbau/Rollen von NASDAQ-Puts.';
} else if (vixPercentile > 80) {
  action = 'DO_NOT_BUY_NEW_PUTS';
  severity = 'orange';
  recommendation = 'VIX hoch: keine neuen Puts kaufen; Versicherung ist wahrscheinlich teuer.';
}

return [{
  json: {
    ndxNow,
    ndxHigh2y,
    drawdownPercent: Number(drawdown.toFixed(2)),
    vixNow: Number(vixNow.toFixed(2)),
    vixPercentile: Number(vixPercentile.toFixed(1)),
    action,
    severity,
    recommendation
  }
}];
