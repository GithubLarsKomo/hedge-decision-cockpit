import assert from 'node:assert/strict';
import test from 'node:test';
import {
  STRATEGY_TONE_ORDER,
  hasExpensiveVixOverlay,
  strategyToneForAction,
  strategyToneStyleForAction
} from '../components/strategy-presentation';

test('primary strategy tones follow the intuitive escalation order', () => {
  assert.deepEqual(STRATEGY_TONE_ORDER, ['blue', 'green', 'yellow', 'amber', 'orange', 'red']);
  assert.equal(strategyToneForAction('BUY_OR_ROLL_PUTS'), 'blue');
  assert.equal(strategyToneForAction('HOLD'), 'green');
  assert.equal(strategyToneForAction('HOLD_HEDGE'), 'yellow');
  assert.equal(strategyToneForAction('REALIZE_25_PERCENT'), 'amber');
  assert.equal(strategyToneForAction('REALIZE_35_PERCENT_MORE'), 'orange');
  assert.equal(strategyToneForAction('CLOSE_MOST_HEDGE_AND_BUY_EQUITIES'), 'red');
});

test('expensive VIX is presented as an overlay instead of an escalation color', () => {
  assert.equal(strategyToneForAction('DO_NOT_BUY_NEW_PUTS'), 'green');
  assert.equal(hasExpensiveVixOverlay(['VIX_EXPENSIVE']), true);
  assert.equal(hasExpensiveVixOverlay(['DRAWDOWN_HOLD']), false);
});

test('unknown actions do not receive a misleading strategy tone', () => {
  assert.equal(strategyToneForAction('UNKNOWN_ACTION'), null);
  assert.equal(strategyToneStyleForAction('UNKNOWN_ACTION'), null);
});
