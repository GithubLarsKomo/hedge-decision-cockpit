import { describe, expect, it } from 'vitest';
import { evaluateDecision, RULE_VERSION } from './decision-engine';

describe('evaluateDecision', () => {
  it('realisiert bei 30 Prozent Drawdown 25 Prozent', () => {
    expect(evaluateDecision({ drawdownPercent: -30, vixPercentile: 50 }).action).toBe('REALIZE_25_PERCENT');
  });

  it('kauft bei hohem VIX keine neuen Puts', () => {
    const result = evaluateDecision({ drawdownPercent: -5, vixPercentile: 90 });
    expect(result.action).toBe('DO_NOT_BUY_NEW_PUTS');
    expect(result.triggeredRules).toContain('VIX_EXPENSIVE');
  });

  it('kauft bei vollständiger Hedge-Abdeckung nicht nach', () => {
    expect(evaluateDecision({ drawdownPercent: -2, vixPercentile: 10, hedgeCoveragePercent: 100 }).action).toBe('HOLD');
  });

  it('liefert eine Regelversion', () => {
    expect(evaluateDecision({ drawdownPercent: 0, vixPercentile: 50 }).ruleVersion).toBe(RULE_VERSION);
  });
});
