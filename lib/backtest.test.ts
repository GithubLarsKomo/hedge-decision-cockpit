import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { runBacktest } from './backtest';
import { DEFAULT_STRATEGY_CONFIG, validateStrategyConfig } from './strategy-config';

describe('runBacktest', () => {
  it('sortiert Beobachtungen und zählt Entscheidungen', () => {
    const result = runBacktest([
      { observedAt: '2022-06-01', ndxClose: 70, ndxReferenceHigh: 100, vixPercentile: 70 },
      { observedAt: '2022-01-01', ndxClose: 98, ndxReferenceHigh: 100, vixPercentile: 10 }
    ]);

    assert.equal(result.firstObservationAt, '2022-01-01');
    assert.equal(result.lastObservationAt, '2022-06-01');
    assert.equal(result.actionCounts.BUY_OR_ROLL_PUTS, 1);
    assert.equal(result.actionCounts.REALIZE_25_PERCENT, 1);
    assert.equal(result.maximumDrawdownPercent, -30);
  });

  it('lehnt inkonsistente Referenzhochs ab', () => {
    assert.throws(() => runBacktest([
      { observedAt: '2022-01-01', ndxClose: 101, ndxReferenceHigh: 100, vixPercentile: 20 }
    ]));
  });
});

describe('validateStrategyConfig', () => {
  it('akzeptiert die Standardstrategie', () => {
    assert.doesNotThrow(() => validateStrategyConfig(DEFAULT_STRATEGY_CONFIG));
  });

  it('lehnt vertauschte Drawdown-Schwellen ab', () => {
    assert.throws(() => validateStrategyConfig({
      ...DEFAULT_STRATEGY_CONFIG,
      drawdownHoldPercent: -35,
      drawdownRealizeFirstPercent: -30
    }));
  });
});
