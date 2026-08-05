import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  STRATEGY_TONE_ORDER,
  hasExpensiveVixOverlay,
  strategyToneForAction,
  strategyToneStyleForAction
} from '../components/strategy-presentation';
import { actionLabel, explainDecisionForBeginner } from './strategy-explanation';

describe('explainDecisionForBeginner', () => {
  it('explains the observed blue market setup and unknown hedge coverage', () => {
    const result = explainDecisionForBeginner({
      drawdownPercent: -6.144041538652212,
      vixPercentile: 22.6,
      hedgeCoveragePercent: null,
      action: 'BUY_OR_ROLL_PUTS'
    });

    assert.match(result.summary, /Markt ist nahe/);
    assert.ok(result.reasons.some(reason => reason.includes('6,1 %')));
    assert.ok(result.reasons.some(reason => reason.includes('22,6. Perzentil')));
    assert.match(result.coverageNote ?? '', /Hedge-Abdeckung ist unbekannt/);
  });

  it('explains that full target coverage means no hedge gap', () => {
    const result = explainDecisionForBeginner({
      drawdownPercent: -6.1,
      vixPercentile: 22.6,
      hedgeCoveragePercent: 100,
      action: 'HOLD'
    });

    assert.equal(result.coverageNote, null);
    assert.ok(result.reasons.some(reason => reason.includes('erreicht damit das konfigurierte Ziel')));
    assert.equal(result.summary, 'Keine Regel verlangt aktuell eine Änderung. Der bestehende Zustand wird beibehalten.');
  });

  it('provides beginner-friendly action labels', () => {
    assert.equal(actionLabel('BUY_OR_ROLL_PUTS'), 'Puts aufbauen oder rollen');
    assert.equal(actionLabel('HOLD'), 'Halten / nichts ändern');
  });

  it('uses the intuitive primary strategy tone order', () => {
    assert.deepEqual(STRATEGY_TONE_ORDER, ['blue', 'green', 'yellow', 'amber', 'orange', 'red']);
    assert.equal(strategyToneForAction('BUY_OR_ROLL_PUTS'), 'blue');
    assert.equal(strategyToneForAction('HOLD'), 'green');
    assert.equal(strategyToneForAction('HOLD_HEDGE'), 'yellow');
    assert.equal(strategyToneForAction('REALIZE_25_PERCENT'), 'amber');
    assert.equal(strategyToneForAction('REALIZE_35_PERCENT_MORE'), 'orange');
    assert.equal(strategyToneForAction('CLOSE_MOST_HEDGE_AND_BUY_EQUITIES'), 'red');
  });

  it('presents expensive VIX as an overlay instead of an escalation color', () => {
    assert.equal(strategyToneForAction('DO_NOT_BUY_NEW_PUTS'), 'green');
    assert.equal(hasExpensiveVixOverlay(['VIX_EXPENSIVE']), true);
    assert.equal(hasExpensiveVixOverlay(['DRAWDOWN_HOLD']), false);
  });

  it('does not assign a misleading tone to unknown actions', () => {
    assert.equal(strategyToneForAction('UNKNOWN_ACTION'), null);
    assert.equal(strategyToneStyleForAction('UNKNOWN_ACTION'), null);
  });
});
