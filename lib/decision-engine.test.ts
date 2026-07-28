import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { evaluateDecision, RULE_VERSION } from './decision-engine';

describe('evaluateDecision', () => {
  it('realisiert bei 30 Prozent Drawdown 25 Prozent', () => {
    assert.equal(
      evaluateDecision({ drawdownPercent: -30, vixPercentile: 50 }).action,
      'REALIZE_25_PERCENT'
    );
  });

  it('kauft bei hohem VIX keine neuen Puts', () => {
    const result = evaluateDecision({ drawdownPercent: -5, vixPercentile: 90 });
    assert.equal(result.action, 'DO_NOT_BUY_NEW_PUTS');
    assert.ok(result.triggeredRules.includes('VIX_EXPENSIVE'));
  });

  it('kauft bei vollständiger Hedge-Abdeckung nicht nach', () => {
    assert.equal(
      evaluateDecision({ drawdownPercent: -2, vixPercentile: 10, hedgeCoveragePercent: 100 }).action,
      'HOLD'
    );
  });

  it('liefert eine Regelversion', () => {
    assert.equal(
      evaluateDecision({ drawdownPercent: 0, vixPercentile: 50 }).ruleVersion,
      RULE_VERSION
    );
  });
});
